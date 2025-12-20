import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  RekognitionClient,
  IndexFacesCommand,
  CreateCollectionCommand,
} from "@aws-sdk/client-rekognition";
import pLimit from "p-limit";

export const maxDuration = 60; // Force Vercel Pro Timeout
export const dynamic = "force-dynamic";

const rekognitionClient = new RekognitionClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

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
    const body = await req.json().catch(() => ({})); // Handle jika body kosong
    const { eventId } = body;

    // --- LOGIC QUERY DATABASE ---
    let query = supabase
      .from("photos")
      .select("id, file_path, event_id") // Ambil event_id juga
      .eq("is_processed", false)
      .order("created_at", { ascending: false }) // Prioritas Terbaru
      .limit(25); // Batch size 25 (Aman anti timeout)

    // JIKA ada Event ID spesifik -> Filter event itu saja
    // JIKA TIDAK ada -> Ambil dari semua event (Global Mode)
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
    
    const limit = pLimit(5); // Speed limit aman

    const results = await Promise.all(
      photos.map((photo) => {
        return limit(async () => {
          // Pastikan Collection ID sesuai event fotonya
          const collectionId = `event-${photo.event_id}`; 

          try {
            // A. Download
            const { data: fileData, error: downloadError } =
              await supabase.storage
                .from("event-photos")
                .download(photo.file_path);

            if (downloadError) throw new Error("Download failed");

            const buffer = Buffer.from(await fileData.arrayBuffer());

            // B. Indexing
            const indexPhotoToAWS = async () => {
              const command = new IndexFacesCommand({
                CollectionId: collectionId,
                Image: { Bytes: buffer },
                ExternalImageId: photo.id,
                MaxFaces: 15,
                QualityFilter: "AUTO",
              });
              return await rekognitionClient.send(command);
            };

            let awsResponse;
            try {
              awsResponse = await indexPhotoToAWS();
            } catch (awsErr: any) {
              if (awsErr.name === "ResourceNotFoundException") {
                try {
                  await rekognitionClient.send(
                    new CreateCollectionCommand({ CollectionId: collectionId })
                  );
                } catch (e) {}
                awsResponse = await indexPhotoToAWS();
              } else {
                throw awsErr;
              }
            }

            const faceCount = awsResponse.FaceRecords
              ? awsResponse.FaceRecords.length
              : 0;

            // C. SUKSES UPDATE DB
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
            console.error(`❌ GAGAL ${photo.id}:`, err.message);
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