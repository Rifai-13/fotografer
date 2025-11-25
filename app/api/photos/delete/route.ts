// app/api/events/delete-full/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Klien Admin menggunakan SERVICE_ROLE_KEY
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

// 🚨 Pastikan ini adalah nama bucket yang terlihat di gambar Anda
const BUCKET_NAME = "event-photos";

export async function DELETE(request: Request) {
  try {
    const { eventId } = await request.json();

    if (!eventId) {
      return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
    }

    // 1. Ambil ID Foto untuk penghapusan DB (Kita tetap perlu ini)
    const { data: photos, error: selectError } = await supabaseAdmin
      .from("photos")
      .select("id")
      .eq("event_id", eventId);

    if (selectError) {
      throw new Error(`Database SELECT error: ${selectError.message}`);
    }

    const photoIds = photos.map((p) => p.id) as string[];

    // 🎯 FIX KRITIS: Hapus Seluruh Folder Event
    // Path yang dibutuhkan Supabase adalah "event_id/"
    const eventFolderPath = `${eventId}/`; // Tambahkan '/' di akhir

    // 2. Hapus dari Storage menggunakan SERVICE ROLE KEY

    // 🚨 PENTING: Untuk menghapus semua yang ada di dalam folder,
    // kita perlu menggunakan list() terlebih dahulu untuk mendapatkan semua file paths.

    const { data: listData, error: listError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .list(eventId, {
        // List semua file di dalam folder eventId
        limit: 1000, // Atur batas ini sesuai jumlah maksimal foto per event
        offset: 0,
        search: "",
      });

    if (listError) {
      console.error("❌ Storage LIST error:", listError);
    }

    const filesToDelete =
      listData?.map((file) => `${eventId}/${file.name}`) || [];

    console.log(`Files to be deleted (found via list):`, filesToDelete);

    if (filesToDelete.length > 0) {
      const { error: storageError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .remove(filesToDelete); // Kirim array of path

      if (storageError) {
        console.error("❌ Final Storage delete error:", storageError);
        // Log error tapi tetap lanjutkan ke database delete
      } else {
        console.log(
          `✅ ${filesToDelete.length} files successfully deleted from Storage.`
        );
      }
    } else {
      console.log(`⚠️ No files found for deletion in folder: ${eventId}`);
    }

    // 3. Hapus foto dari database
    if (photoIds.length > 0) {
      await supabaseAdmin.from("photos").delete().in("id", photoIds);
    }

    // 4. Hapus Event
    const { error: deleteEventError } = await supabaseAdmin
      .from("events")
      .delete()
      .eq("id", eventId);

    if (deleteEventError) {
      throw new Error(`Gagal menghapus event: ${deleteEventError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: `Event dan ${filesToDelete.length} foto berhasil dihapus permanen.`,
    });
  } catch (error: any) {
    console.error("❌ Server Delete error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete event and associated files" },
      { status: 500 }
    );
  }
}
