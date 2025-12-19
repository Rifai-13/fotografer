import { createClient } from "@supabase/supabase-js"; // ⚠️ Pakai import ini, jangan dari @/lib/...
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // 🛡️ INISIALISASI SUPABASE MODE ADMIN (BYPASS RLS)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Pastikan variable ini ada di file .env.local
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  try {
    const body = await req.json();
    const { photos } = body;

    // Validasi
    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json({ error: "Data kosong" }, { status: 400 });
    }

    console.log(`📦 Admin Mode: Menyimpan ${photos.length} foto ke DB...`);

    // Insert ke tabel 'photos'
    const { data, error } = await supabase
      .from("photos")
      .insert(photos)
      .select();

    if (error) {
      console.error("❌ DB ERROR (Detail):", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("✅ Sukses simpan ke DB!");
    return NextResponse.json({ success: true, count: photos.length, data });

  } catch (error: any) {
    console.error("❌ Server Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}