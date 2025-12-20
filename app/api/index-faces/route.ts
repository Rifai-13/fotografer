import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  RekognitionClient,
  IndexFacesCommand,
  CreateCollectionCommand,
} from "@aws-sdk/client-rekognition";
import pLimit from "p-limit";

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

    // 1. AMBIL FOTO (TURUNKAN LIMIT JADI 20 BIAR AMAN DARI TIMEOUT)
    const { data: photos, error: fetchError } = await supabase
      .from("photos")
      .select("id, file_path")
      .eq("event_id", eventId)
      .eq("is_processed", false)
      .limit(20); // 👈 UBAH DARI 50 KE 20

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

    // Limit concurrency AWS
    const limit = pLimit(5);

    // 2. LOOPING
    const results = await Promise.all(
      photos.map((photo) => {
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

            // C. SUKSES -> Simpan Data & Kosongkan Error Log
            await supabase
              .from("photos")
              .update({
                is_processed: true,
                faces_indexed: faceCount,
                indexed_at: new Date().toISOString(),
                error_log: null, // Reset error jika ada
              })
              .eq("id", photo.id);

            return { id: photo.id, status: "success", faces: faceCount };
          } catch (err: any) {
            console.error(`❌ GAGAL photo ${photo.id}:`, err.message);

            // D. GAGAL -> Simpan Pesan Error
            await supabase
              .from("photos")
              .update({
                is_processed: true,
                faces_indexed: 0,
                error_log: err.message, // 👈 Simpan error biar tau kenapa gagal
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