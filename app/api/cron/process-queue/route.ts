import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  RekognitionClient,
  IndexFacesCommand,
  CreateCollectionCommand,
} from "@aws-sdk/client-rekognition";
import pLimit from "p-limit";

export const dynamic = "force-dynamic";

// Init AWS
const rekognitionClient = new RekognitionClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function GET(req: Request) {
  // 🛡️ SECURITY Check
  const authHeader = req.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
      // Pass
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    // 1. TURUNKAN LIMIT JADI 20 (Biar Vercel Gak Timeout)
    const { data: photos, error: fetchError } = await supabase
      .from("photos")
      .select("id, file_path, event_id")
      .eq("is_processed", false)
      .limit(20); // 👈 TURUNKAN DARI 50 KE 20

    if (fetchError) throw fetchError;

    if (!photos || photos.length === 0) {
      return NextResponse.json({ message: "Zzz... Tidak ada antrian foto." });
    }

    console.log(`[CRON] Menemukan ${photos.length} foto antrian...`);

    const limit = pLimit(5); // Concurrency tetap 5

    const results = await Promise.all(
      photos.map((photo) => {
        return limit(async () => {
          const collectionId = `event-${photo.event_id}`;

          try {
            // A. Download
            const { data: fileData, error: downloadError } =
              await supabase.storage
                .from("event-photos")
                .download(photo.file_path);

            if (downloadError) throw new Error(`Download Failed: ${downloadError.message}`);

            const buffer = Buffer.from(await fileData.arrayBuffer());

            // B. Indexing
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
                error_log: null // Reset error jika sebelumnya ada
              })
              .eq("id", photo.id);

            return { id: photo.id, status: "success", faces: faceCount };

          } catch (err: any) {
            console.error(`[CRON GAGAL] Photo ${photo.id}:`, err.message);
            
            // D. GAGAL -> Simpan Pesan Errornya!
            await supabase
              .from("photos")
              .update({
                is_processed: true, // Tetap true biar antrian jalan
                faces_indexed: 0,
                // indexed_at biarkan NULL (Tanda Gagal)
                error_log: err.message // 👈 SIMPAN ERRORNYA DISINI
              })
              .eq("id", photo.id);

            return { id: photo.id, status: "failed", error: err.message };
          }
        });
      })
    );

    return NextResponse.json({
      success: true,
      processed: results.length,
      details: results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}