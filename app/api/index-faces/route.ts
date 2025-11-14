// app/api/index-faces/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  RekognitionClient,
  IndexFacesCommand,
} from "@aws-sdk/client-rekognition";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const rekognitionClient = new RekognitionClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { eventId, photoId } = body;

    if (!eventId || !photoId) {
      return NextResponse.json(
        { error: "Event ID dan Photo ID diperlukan" },
        { status: 400 }
      );
    }

    console.log("Indexing faces for event:", eventId, "photo:", photoId);

    // Get photo data from database
    const { data: photo, error: photoError } = await supabase
      .from("photos")
      .select("*")
      .eq("id", photoId)
      .single();

    if (photoError || !photo) {
      console.error("Photo not found:", photoError);
      return NextResponse.json(
        { error: "Foto tidak ditemukan" },
        { status: 404 }
      );
    }

    // Download photo from storage
    const { data: photoData, error: storageError } = await supabase.storage
      .from("event-photos")
      .download(photo.file_path);

    if (storageError) {
      console.error("Storage error:", storageError);
      return NextResponse.json(
        { error: "Gagal mengunduh foto dari storage" },
        { status: 500 }
      );
    }

    if (!photoData) {
      return NextResponse.json(
        { error: "File foto tidak ditemukan di storage" },
        { status: 404 }
      );
    }

    // Convert to buffer
    const arrayBuffer = await photoData.arrayBuffer();
    const imageBytes = Buffer.from(arrayBuffer);

    const collectionId = `event-${eventId}`;

    console.log("Indexing faces to collection:", collectionId);

    // Index faces in the photo
    const command = new IndexFacesCommand({
      CollectionId: collectionId,
      Image: {
        Bytes: imageBytes,
      },
      ExternalImageId: photoId,
      DetectionAttributes: ["DEFAULT"],
      MaxFaces: 10,
      QualityFilter: "AUTO",
    });

    const response = await rekognitionClient.send(command);

    console.log("Faces indexed:", response.FaceRecords?.length);

    // Update photo record with face indexing info
    try {
      await supabase
        .from("photos")
        .update({
          faces_indexed: response.FaceRecords?.length || 0,
          indexed_at: new Date().toISOString(),
        })
        .eq("id", photoId);
    } catch (updateError) {
      console.log(
        "⚠️ Cannot update faces_indexed (column may not exist):",
        updateError
      );
    }

    return NextResponse.json({
      success: true,
      facesIndexed: response.FaceRecords?.length || 0,
      faceRecords: response.FaceRecords,
    });
  } catch (error: any) {
    console.error("Index faces error:", error);
    return NextResponse.json(
      { error: "Gagal mengindex wajah: " + error.message },
      { status: 500 }
    );
  }
}
