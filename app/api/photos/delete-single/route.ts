// app/api/photos/delete-single/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

const BUCKET_NAME = "event-photos";

export async function DELETE(request: Request) {
  try {
    const { photoId } = await request.json(); // Menerima photoId dari frontend

    if (!photoId) {
      return NextResponse.json({ error: "Missing photoId" }, { status: 400 });
    }

    console.log(`Starting single photo deletion for Photo ID: ${photoId}`);

    // --- 1. Ambil file_path dari database ---
    const { data: photo, error: selectError } = await supabaseAdmin
      .from("photos")
      .select("file_path")
      .eq("id", photoId)
      .single();

    if (selectError) {
      // Jika foto tidak ditemukan atau error select, log dan lanjutkan ke langkah 3
      console.error("❌ Database SELECT error for single photo:", selectError);
    }

    const filePath = photo?.file_path;

    // --- 2. Hapus dari Storage (hanya jika filePath ditemukan) ---
    if (filePath) {
      const { error: storageError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .remove([filePath]); // Kirim path tunggal dalam array

      if (storageError) {
        console.error(
          "❌ Storage delete error for single photo:",
          storageError
        );
        // Log error tapi tetap lanjutkan ke database delete
      } else {
        console.log(`✅ File ${filePath} successfully deleted from Storage.`);
      }
    } else {
      console.log(
        `⚠️ file_path not found in DB for photoId: ${photoId}. Skipping Storage delete.`
      );
    }

    // --- 3. Hapus foto dari database (KRITIS: harus dihapus) ---
    const { error: deletePhotoError } = await supabaseAdmin
      .from("photos")
      .delete()
      .eq("id", photoId);

    if (deletePhotoError) {
      throw new Error(
        `Gagal menghapus data foto di DB: ${deletePhotoError.message}`
      );
    }
    console.log(`✅ Photo record deleted from database.`);

    return NextResponse.json({
      success: true,
      message: `Foto tunggal berhasil dihapus.`,
    });
  } catch (error: any) {
    console.error("❌ Server Delete Single Photo error (500):", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete single photo" },
      { status: 500 }
    );
  }
}
