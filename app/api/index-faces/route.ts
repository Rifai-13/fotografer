import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  RekognitionClient,
  IndexFacesCommand,
  CreateCollectionCommand,
} from "@aws-sdk/client-rekognition";
import pLimit from "p-limit";

export const maxDuration = 60; // Timeout Vercel Pro
export const dynamic = "force-dynamic";

// Init AWS Client
const rekognitionClient = new RekognitionClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// ✨ HELPER BARU: Fungsi untuk "Tidur" sebentar (Pause)
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: Request) {
  // Cek Env Var Wajib
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server Misconfiguration" }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    const body = await req.json().catch(() => ({})); 
    const { eventId } = body;

    // --- LOGIC QUERY DATABASE ---
    let query = supabase
      .from("photos")
      .select("id, file_path, event_id")
      .eq("is_processed", false)
      .order("created_at", { ascending: false }) // Prioritas Terbaru
      .limit(25); // Batch size 25

    if (eventId) {
      query = query.eq("event_id", eventId);
    }

    const { data: photos, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    if (!photos || photos.length === 0) {
      return NextResponse.json({
        success: true,
        processedCount: 0,
        message: "Semua foto sudah selesai!",
      });
    }

    console.log(`🚀 TURBO MODE: Processing ${photos.length} photos (${eventId ? 'Event Specific' : 'Global'})...`);
    
    // Limit concurrency 5 (Biar AWS gak kaget)
    const limit = pLimit(5);

    const results = await Promise.all(
      photos.map((photo) => {
        return limit(async () => {
          const collectionId = `event-${photo.event_id}`; 

          try {
            // A. Download Foto
            const { data: fileData, error: downloadError } =
              await supabase.storage
                .from("event-photos")
                .download(photo.file_path);

            if (downloadError) throw new Error("Download failed");
            const buffer = Buffer.from(await fileData.arrayBuffer());

            // ✨ LOGIC BARU: Kirim ke AWS dengan RETRY (3x Percobaan)
            const sendToAwsWithRetry = async (attempt = 1): Promise<any> => {
              try {
                const command = new IndexFacesCommand({
                  CollectionId: collectionId,
                  Image: { Bytes: buffer },
                  ExternalImageId: photo.id,
                  MaxFaces: 15,
                  QualityFilter: "NONE", // Tetap NONE sesuai requestmu
                });
                return await rekognitionClient.send(command);

              } catch (err: any) {
                // Kasus 1: Collection Belum Ada -> Buat & Coba Lagi
                if (err.name === "ResourceNotFoundException") {
                  try {
                    await rekognitionClient.send(new CreateCollectionCommand({ CollectionId: collectionId }));
                  } catch (e) {} 
                  return sendToAwsWithRetry(attempt); // Coba lagi langsung
                }

                // Kasus 2: RATE LIMIT (Ngebut) -> Tunggu & Coba Lagi
                if (
                   (err.name === "ProvisionedThroughputExceededException" || 
                    err.name === "ThrottlingException") && 
                   attempt <= 3 // Maksimal 3x coba
                ) {
                   console.log(`⚠️ Rate Limit di foto ${photo.id}. Tunggu ${attempt} detik...`);
                   await wait(1000 * attempt); // Tunggu 1 detik, lalu 2 detik...
                   return sendToAwsWithRetry(attempt + 1); // Coba lagi (rekursif)
                }

                throw err; // Lempar error lain (file rusak dll)
              }
            };

            // Jalankan fungsi sakti
            const awsResponse = await sendToAwsWithRetry();

            const faceCount = awsResponse.FaceRecords ? awsResponse.FaceRecords.length : 0;

            // C. SUKSES - Update DB
            const { error: updateError } = await supabase
              .from("photos")
              .update({
                is_processed: true,
                faces_indexed: faceCount,
                indexed_at: new Date().toISOString(),
                error_log: null,
              })
              .eq("id", photo.id);

            if (updateError) throw new Error(updateError.message);

            return { id: photo.id, status: "success", faces: faceCount };

          } catch (err: any) {
            console.error(`❌ GAGAL FINAL ${photo.id}:`, err.message);
            // Simpan error log jika sudah mentok gagal 3x
            await supabase
              .from("photos")
              .update({
                is_processed: true,
                faces_indexed: 0,
                error_log: err.message,
              })
              .eq("id", photo.id);

            return { id: photo.id, status: "failed", error: err.message };
          }
        });
      })
    );

    return NextResponse.json({
      success: true,
      processedCount: photos.length,
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}