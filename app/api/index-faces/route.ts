import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  RekognitionClient,
  IndexFacesCommand,
  CreateCollectionCommand,
} from "@aws-sdk/client-rekognition";
import pLimit from "p-limit";

export const maxDuration = 60; // ⚡ FORCE VERCEL PRO (60 Detik Timeout)
export const dynamic = "force-dynamic";

// Init AWS
const rekognitionClient = new RekognitionClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    const { eventId } = await req.json();

    // 1. AMBIL LEBIH BANYAK (50 FOTO SEKALIGUS)
    // Karena kita pakai p-limit, 50 foto masih aman dalam 60 detik.
    const { data: photos, error: fetchError } = await supabase
      .from("photos")
      .select("id, file_path")
      .eq("event_id", eventId)
      .eq("is_processed", false)
      .limit(50); // 🚀 NAIKKAN JADI 50

    if (fetchError) throw fetchError;

    if (!photos || photos.length === 0) {
      return NextResponse.json({
        success: true,
        processedCount: 0,
        message: "Semua foto sudah selesai!",
      });
    }

    console.log(`🚀 TURBO MODE: Processing ${photos.length} photos...`);
    const collectionId = `event-${eventId}`;

    // 🔥 NAIKKAN CONCURRENCY JADI 10
    // Artinya: 10 Foto diproses BERSAMAAN.
    // 50 foto akan selesai dalam 5 gelombang (sangat cepat).
    const limit = pLimit(10); 

    const results = await Promise.all(
      photos.map((photo) => {
        return limit(async () => {
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
                MaxFaces: 15, // Deteksi max 15 wajah per foto
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

            // C. SUKSES
            await supabase
              .from("photos")
              .update({
                is_processed: true,
                faces_indexed: faceCount,
                indexed_at: new Date().toISOString(),
                error_log: null,
              })
              .eq("id", photo.id);

            return { id: photo.id, status: "success", faces: faceCount };
          } catch (err: any) {
            console.error(`❌ GAGAL ${photo.id}:`, err.message);
            // Simpan error, tandai processed biar ga macet
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