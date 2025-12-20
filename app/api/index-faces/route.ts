import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  RekognitionClient,
  IndexFacesCommand,
  CreateCollectionCommand,
} from "@aws-sdk/client-rekognition";
import pLimit from "p-limit";

export const maxDuration = 60; 
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
  // 🔍 DEBUG: Cek apakah Service Role Key terbaca?
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ FATAL: SUPABASE_SERVICE_ROLE_KEY Hilang/Undefined!");
    return NextResponse.json({ error: "Server Misconfiguration: Missing Key" }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    const { eventId } = await req.json();

    const { data: photos, error: fetchError } = await supabase
      .from("photos")
      .select("id, file_path")
      .eq("event_id", eventId)
      .eq("is_processed", false)
      .limit(50);

    if (fetchError) throw fetchError;

    if (!photos || photos.length === 0) {
      return NextResponse.json({
        success: true,
        processedCount: 0,
        message: "Semua foto sudah selesai!",
      });
    }

    console.log(`🚀 Processing ${photos.length} photos...`);
    const collectionId = `event-${eventId}`;
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

            // B. Indexing AWS
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

            // C. SUKSES - UPDATE DB (DENGAN CEK ERROR)
            const { error: updateError } = await supabase
              .from("photos")
              .update({
                is_processed: true,
                faces_indexed: faceCount,
                indexed_at: new Date().toISOString(),
                error_log: null,
              })
              .eq("id", photo.id);
            
            // 🚨 CEK JIKA UPDATE GAGAL
            if (updateError) {
                console.error(`❌ DB UPDATE ERROR photo ${photo.id}:`, updateError.message);
                throw new Error(`DB Update Failed: ${updateError.message}`);
            }

            return { id: photo.id, status: "success", faces: faceCount };

          } catch (err: any) {
            console.error(`❌ GAGAL photo ${photo.id}:`, err.message);
            
            // Coba simpan error log (tapi kalau key salah, ini juga bakal gagal)
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
    console.error("Main API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}