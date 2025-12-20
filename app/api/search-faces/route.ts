// app/api/search-faces/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  RekognitionClient,
  SearchFacesByImageCommand,
} from "@aws-sdk/client-rekognition";

// 1. Setup AWS Client
const rekognitionClient = new RekognitionClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const file = data.get("file") as File;
    const eventId = data.get("eventId") as string;

    if (!file || !eventId) {
      return NextResponse.json(
        { error: "File dan Event ID diperlukan" },
        { status: 400 }
      );
    }

    // 2. Setup Supabase ADMIN MODE (Bypass RLS & Auth Error)
    // Kita pakai Service Role agar tamu yang tidak login tetap bisa search foto
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 3. Convert File ke Buffer untuk AWS
    const buffer = Buffer.from(await file.arrayBuffer());

    console.log(`Starting face search for event: ${eventId}`);

    // 4. Kirim ke AWS Rekognition
    const collectionId = `event-${eventId}`;

    const command = new SearchFacesByImageCommand({
      CollectionId: collectionId,
      Image: { Bytes: buffer },
      MaxFaces: 100,      // Cari sampai 100 wajah mirip
      FaceMatchThreshold: 90, // Tingkat kemiripan minimal 80%
      QualityFilter: "HIGH",
    });

    const response = await rekognitionClient.send(command);

    console.log(
      "AWS Rekognition response:",
      JSON.stringify(
        {
          faceMatches: response.FaceMatches?.length,
          searchedFace: response.SearchedFaceConfidence,
        },
        null,
        2
      )
    );

    if (!response.FaceMatches || response.FaceMatches.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    // 5. Ambil ID Foto dari hasil AWS
    // Saat indexing, kita set ExternalImageId = photo.id
    const faceMatches = response.FaceMatches;
    
    // Kumpulkan semua Photo ID yang ditemukan AWS
    const photoIds = faceMatches
      .map((match) => match.Face?.ExternalImageId)
      .filter((id): id is string => !!id); // Hapus yang undefined

    if (photoIds.length === 0) {
      console.log("No valid ExternalImageId found in AWS response");
      return NextResponse.json({ matches: [] });
    }

    // 6. Ambil Data Detail Foto dari Database Supabase
    // Menggunakan Admin Client, jadi pasti dapat datanya walau token user error
    const { data: photos, error } = await supabase
      .from("photos")
      .select("*")
      .in("id", photoIds);

    if (error) {
      console.error("Supabase Error:", error);
      throw error;
    }

    console.log(
      `Found ${photos?.length || 0} final matches after merging and filtering.`
    );

    // 7. Gabungkan Data AWS (Score Kemiripan) dengan Data Database (URL Gambar)
    const results = photos?.map((photo) => {
      // Cari data match dari AWS untuk foto ini
      const awsMatch = faceMatches.find(
        (m) => m.Face?.ExternalImageId === photo.id
      );

      return {
        photo_id: photo.id,
        image_url: photo.storage_url || photo.image_url, // Pakai public URL
        similarity: awsMatch?.Similarity || 0, // % Kemiripan
        confidence: awsMatch?.Face?.Confidence || 0,
        face_id: awsMatch?.Face?.FaceId,
        bounding_box: awsMatch?.Face?.BoundingBox,
      };
    });

    // Urutkan dari yang paling mirip
    results?.sort((a, b) => b.similarity - a.similarity);

    return NextResponse.json({ matches: results });

  } catch (error: any) {
    console.error("Search error details:", error);
    
    // Handling error jika Collection belum dibuat (Event baru belum ada foto terindex)
    if (error.name === 'ResourceNotFoundException') {
        return NextResponse.json({ matches: [] }); // Anggap kosong, jangan error 500
    }

    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}