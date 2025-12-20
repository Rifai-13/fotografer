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
    // 1. AMBIL FOTO ANTRIAN (PRIORITAS: TERBARU DULUAN)
    const { data: photos, error: fetchError } = await supabase
      .from("photos")
      .select("id, file_path, event_id")
      .eq("is_processed", false)
      // 🔥 BARIS AJAIB: Urutkan dari created_at TERBARU (Descending)
      // Jadi foto yang baru diupload 5 detik lalu akan langsung diambil
      // Foto yang upload bulan lalu akan menunggu belakangan.
      .order("created_at", { ascending: false }) 
      .limit(20); // Ambil 20 biji

    if (fetchError) throw fetchError;

    if (!photos || photos.length === 0) {
      return NextResponse.json({ message: "Zzz... Tidak ada antrian foto." });
    }

    console.log(`[CRON] Memproses ${photos.length} foto TERBARU...`);

    const limit = pLimit(5); 

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

            // C. SUKSES
            await supabase
              .from("photos")
              .update({
                is_processed: true,
                faces_indexed: faceCount,
                indexed_at: new Date().toISOString(),
                error_log: null 
              })
              .eq("id", photo.id);

            return { id: photo.id, status: "success", faces: faceCount };

          } catch (err: any) {
            console.error(`[CRON GAGAL] Photo ${photo.id}:`, err.message);
            
            // D. GAGAL
            await supabase
              .from("photos")
              .update({
                is_processed: true, 
                faces_indexed: 0,
                error_log: err.message 
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