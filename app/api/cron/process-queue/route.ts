import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  RekognitionClient,
  IndexFacesCommand,
  CreateCollectionCommand,
} from "@aws-sdk/client-rekognition";
import pLimit from "p-limit";

// Setup AWS
const rekognitionClient = new RekognitionClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const dynamic = "force-dynamic";

// ✨ Helper: Fungsi Tidur
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    // 1. Ambil 20 Foto Antrian (Sedikit saja buat background process)
    const { data: photos, error } = await supabase
      .from("photos")
      .select("id, file_path, event_id")
      .eq("is_processed", false)
      .limit(20);

    if (error) throw error;
    if (!photos || photos.length === 0) {
      return NextResponse.json({ message: "No photos to process" });
    }

    console.log(`[CRON] Memproses ${photos.length} foto TERBARU...`);

    const limit = pLimit(3); // Cron jalan santai saja (Speed 3)

    const results = await Promise.all(
      photos.map((photo) =>
        limit(async () => {
          const collectionId = `event-${photo.event_id}`;

          try {
            // A. Download
            const { data: fileData, error: downloadError } =
              await supabase.storage
                .from("event-photos")
                .download(photo.file_path);

            if (downloadError) throw new Error("Download failed");
            const buffer = Buffer.from(await fileData.arrayBuffer());

            // ✨ B. Indexing dengan RETRY (Anti-Nyerah)
            const sendToAwsWithRetry = async (attempt = 1): Promise<any> => {
              try {
                const command = new IndexFacesCommand({
                  CollectionId: collectionId,
                  Image: { Bytes: buffer },
                  ExternalImageId: photo.id,
                  MaxFaces: 15,
                  QualityFilter: "NONE", // Ikut aturan baru
                });
                return await rekognitionClient.send(command);
              } catch (err: any) {
                // Create Collection jika belum ada
                if (err.name === "ResourceNotFoundException") {
                   try {
                     await rekognitionClient.send(new CreateCollectionCommand({ CollectionId: collectionId }));
                   } catch (e) {}
                   return sendToAwsWithRetry(attempt);
                }

                // Rate Limit -> Tunggu & Retry
                if (
                   (err.name === "ProvisionedThroughputExceededException" || 
                    err.name === "ThrottlingException") && 
                   attempt <= 3
                ) {
                   // Cron ngalah lebih lama (2 detik * attempt)
                   console.log(`[CRON] ⚠️ Rate Limit ${photo.id}. Nunggu ${attempt * 2}s...`);
                   await wait(2000 * attempt); 
                   return sendToAwsWithRetry(attempt + 1);
                }
                throw err;
              }
            };

            const awsResponse = await sendToAwsWithRetry();
            const faceCount = awsResponse.FaceRecords ? awsResponse.FaceRecords.length : 0;

            // C. Update DB
            await supabase
              .from("photos")
              .update({
                is_processed: true,
                faces_indexed: faceCount,
                indexed_at: new Date().toISOString(),
                error_log: null,
              })
              .eq("id", photo.id);

            return { id: photo.id, status: "success" };

          } catch (err: any) {
            console.error(`[CRON GAGAL] Photo ${photo.id}: ${err.message}`);
            // Catat error biar tau
            await supabase
              .from("photos")
              .update({ is_processed: true, faces_indexed: 0, error_log: err.message })
              .eq("id", photo.id);
            return { id: photo.id, status: "failed", error: err.message };
          }
        })
      )
    );

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}