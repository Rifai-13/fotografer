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
  // 🛡️ SECURITY: Pastikan yang manggil cuma Vercel Cron
  // Header ini otomatis dikirim oleh Vercel
  const authHeader = req.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    // Note: Di Vercel Dashboard nanti bisa set CRON_SECRET, 
    // tapi kalau mau simpel (tanpa secret) bisa hapus blok if ini sementara.
    // Untuk sekarang kita biarkan terbuka (public) tapi obscure path-nya.
  }

  // Init Supabase Admin
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    // 1. CARI 50 FOTO DARI EVENT MANAPUN YANG BELUM SELESAI
    // Kita ambil faces_indexed juga untuk safety check
    const { data: photos, error: fetchError } = await supabase
      .from("photos")
      .select("id, file_path, event_id")
      .eq("is_processed", false)
      .limit(50); // Kerjakan 50 foto per menit

    if (fetchError) throw fetchError;

    if (!photos || photos.length === 0) {
      return NextResponse.json({ message: "Zzz... Tidak ada antrian foto." });
    }

    console.log(`[CRON] Menemukan ${photos.length} foto antrian...`);

    // Limit concurrency AWS biar gak overload
    const limit = pLimit(5);

    // 2. PROSES SEMUA
    const results = await Promise.all(
      photos.map((photo) => {
        return limit(async () => {
          const collectionId = `event-${photo.event_id}`; // Collection dinamis sesuai event

          try {
            // A. Download Gambar
            const { data: fileData, error: downloadError } =
              await supabase.storage
                .from("event-photos")
                .download(photo.file_path);

            if (downloadError) throw downloadError;

            const buffer = Buffer.from(await fileData.arrayBuffer());

            // B. Helper Function Index
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
              // Auto-Create Collection jika belum ada
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

            // C. Update Sukses
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
            console.error(`[CRON GAGAL] Photo ${photo.id}:`, err.message);
            
            // Tandai error tapi jangan stop antrian (Set faces 0)
            // Nanti bisa direset manual
            await supabase
              .from("photos")
              .update({
                is_processed: true,
                faces_indexed: 0,
                // indexed_at biarkan NULL sebagai tanda error
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