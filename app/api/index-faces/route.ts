import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  RekognitionClient,
  IndexFacesCommand,
  CreateCollectionCommand,
} from "@aws-sdk/client-rekognition";
import pLimit from "p-limit"; // 👈 WAJIB INSTALL INI

// Init AWS
const rekognitionClient = new RekognitionClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(req: Request) {
  // 🛡️ MODE ADMIN
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    const { eventId } = await req.json();

    // 1. AMBIL FOTO (Ambil yang faces_indexed 0 juga jika mau retry otomatis)
    // Trik: Kita ambil yang is_processed = false
    const { data: photos, error: fetchError } = await supabase
      .from("photos")
      .select("id, file_path")
      .eq("event_id", eventId)
      .eq("is_processed", false)
      .limit(50); // Batch 50 foto

    if (fetchError) throw fetchError;

    if (!photos || photos.length === 0) {
      return NextResponse.json({
        success: true,
        processedCount: 0,
        message: "Semua foto sudah selesai!",
      });
    }

    console.log(`Processing ${photos.length} photos...`);
    const collectionId = `event-${eventId}`;

    // 🔥 LIMIT CONCURRENCY: Cuma boleh 5 request AWS bersamaan
    // Biar server gak timeout dan AWS gak nolak request
    const limit = pLimit(5); 

    // 2. LOOPING DENGAN LIMITER
    const results = await Promise.all(
      photos.map((photo) => {
        // Bungkus logic dalam limit()
        return limit(async () => {
          try {
            // A. Download Gambar
            const { data: fileData, error: downloadError } =
              await supabase.storage
                .from("event-photos")
                .download(photo.file_path);

            if (downloadError) throw downloadError;

            const buffer = Buffer.from(await fileData.arrayBuffer());

            // B. Fungsi Helper Indexing
            const indexPhotoToAWS = async () => {
               const command = new IndexFacesCommand({
                  CollectionId: collectionId,
                  Image: { Bytes: buffer },
                  ExternalImageId: photo.id,
                  MaxFaces: 10,
                  QualityFilter: "AUTO",
                });
                return await rekognitionClient.send(command);
            };

            let awsResponse;
            try {
              awsResponse = await indexPhotoToAWS();
            } catch (awsErr: any) {
              // Retry jika collection belum ada
              if (awsErr.name === 'ResourceNotFoundException') {
                  try {
                      await rekognitionClient.send(new CreateCollectionCommand({ CollectionId: collectionId }));
                  } catch (e) {}
                  awsResponse = await indexPhotoToAWS();
              } else {
                  throw awsErr;
              }
            }
            
            const faceCount = awsResponse.FaceRecords ? awsResponse.FaceRecords.length : 0;

            // C. UPDATE DATABASE (SUKSES)
            await supabase
              .from("photos")
              .update({ 
                  is_processed: true,
                  faces_indexed: faceCount,
                  indexed_at: new Date().toISOString(),
              })
              .eq("id", photo.id);

            return { id: photo.id, status: "success", faces: faceCount };

          } catch (err: any) {
            console.error(`❌ GAGAL photo ${photo.id}:`, err.message);

            // D. JIKA ERROR: Jangan set true selamanya, atau kasih flag error
            // Disini kita set processed true TAPI faces 0, biar gak looping infinite di frontend
            // Nanti bisa direset manual via SQL kalau mau coba lagi
            await supabase
              .from("photos")
              .update({
                is_processed: true, 
                faces_indexed: 0,
                // indexed_at DIBIARKAN NULL sebagai penanda error
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