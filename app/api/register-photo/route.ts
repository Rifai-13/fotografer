// app/api/register-photo/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  RekognitionClient,
  CreateCollectionCommand,
  DescribeCollectionCommand,
} from "@aws-sdk/client-rekognition";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const rekognitionClient = new RekognitionClient({
  region: process.env.AWS_REGION || "ap-southeast-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: Request) {
  try {
    const {
      storage_url,
      file_path,
      file_name,
      file_size,
      event_id,
      photographer_id,
    } = await request.json();

    // Validasi input
    if (!event_id || !photographer_id || !storage_url) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: event_id, photographer_id, storage_url",
        },
        { status: 400 }
      );
    }

    console.log("📸 Registering photo for event:", event_id);

    // ✅ STEP 1: SIMPAN KE DATABASE DULU UNTUK DAPAT ID
    const currentTime = new Date().toISOString();

    const photoData = {
      event_id,
      photographer_id,
      image_url: storage_url,
      storage_url: storage_url,
      file_name: file_name || "unknown",
      file_size: parseInt(file_size) || 0,
      file_path: file_path,
      uploaded_at: currentTime,
      faces_indexed: 0, // Default 0
      is_processed: false, // Default false
      created_at: currentTime,
    };

    console.log("💾 Saving to database first...");

    const { data: photo, error: photoError } = await supabaseAdmin
      .from("photos")
      .insert(photoData)
      .select()
      .single();

    if (photoError) {
      console.error("❌ Database insert error:", photoError);
      return NextResponse.json(
        { error: `Failed to insert photo: ${photoError.message}` },
        { status: 500 }
      );
    }

    console.log("✅ Photo saved to database with ID:", photo.id);

    // Update photo_count
    try {
      await supabaseAdmin.rpc("increment_photo_count", {
        p_event_id: event_id,
      });
    } catch (countError) {
      console.error("⚠️ Photo count update error:", countError);
    }

    // ✅ STEP 2: AUTO SETUP COLLECTION
    const collectionId = `event-${event_id}`;

    try {
      await rekognitionClient.send(
        new DescribeCollectionCommand({
          CollectionId: collectionId,
        })
      );
      console.log(
        `✅ Collection ${collectionId} sudah ada (Deskripsi berhasil)`
      );
    } catch (error: any) {
      if (error.name === "ResourceNotFoundException") {
        console.log(
          `🆕 Collection tidak ditemukan, mencoba membuat: ${collectionId}`
        );

        try {
          // Coba buat koleksi baru
          await rekognitionClient.send(
            new CreateCollectionCommand({
              CollectionId: collectionId,
            })
          );
          console.log(`✅ Collection ${collectionId} berhasil dibuat`);
        } catch (createError: any) {
          // 🎯 FIX UTAMA DI SINI: Tangkap error jika koleksi sudah ada
          if (createError.name === "ResourceAlreadyExistsException") {
            console.log(
              `⚠️ Koleksi sudah dibuat oleh proses paralel lainnya: ${collectionId}. Lanjut.`
            );
          } else {
            // Throw error lain jika bukan duplikat
            console.error("Error saat membuat collection:", createError);
            // Kita tetap lanjut, karena foto sudah disimpan di DB
          }
        }
      } else {
        console.error("Error checking collection:", error);
        // Kita tetap lanjut, karena foto sudah disimpan di DB
      }
    }

    return NextResponse.json({
      success: true,
      photo: photo,
      message: "Photo metadata registered. Processing will start soon.",
    });
  } catch (error: any) {
    console.error("❌ ERROR register-photo:", error);
    return NextResponse.json(
      { error: `Gagal mendaftarkan foto: ${error.message}` },
      { status: 500 }
    );
  }
}
