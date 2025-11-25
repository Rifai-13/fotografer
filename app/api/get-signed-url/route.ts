// app/api/get-signed-url/route.ts

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Klien Admin menggunakan SERVICE_ROLE_KEY untuk akses Storage penuh
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, 
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// 🚨 Ganti 'event-photos' dengan nama bucket Supabase Anda
const BUCKET_NAME = 'event-photos'; 

export async function POST(request: Request) {
  try {
    const { fileName, fileType, eventId } = await request.json();

    if (!fileName || !fileType || !eventId) {
      return NextResponse.json(
        { error: 'Missing required fields: fileName, fileType, and eventId' },
        { status: 400 }
      );
    }
    
    // Path: events/event-id/timestamp-namafile.jpg
    const safeFileName = fileName.replace(/\s/g, '_');
    const filePath = `${eventId}/${Date.now()}-${safeFileName}`;

    console.log(`🔑 Generating signed URL for: ${filePath}`);

    // Masa berlaku URL upload (misalnya 600 detik = 10 menit)
    const expiresIn = 600; 

    // Panggil fungsi Supabase Storage untuk membuat URL upload yang ditandatangani
    // Catatan: Supabase createSignedUploadUrl tidak menerima expiresIn di versi terbaru.
    // Kita anggap default Supabase sudah cukup untuk upload.
    const { data, error } = await supabaseAdmin
      .storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error('❌ Error generating signed URL:', error);
      return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 });
    }

    // Mengembalikan Signed URL dan path file (file_path ini PENTING)
    return NextResponse.json({
      success: true,
      signedUrl: data.signedUrl,
      file_path: data.path, // Ini adalah path lengkap di Storage
    });

  } catch (error: any) {
    console.error('❌ ERROR get-signed-url:', error);
    return NextResponse.json(
      { error: `Failed to generate upload URL: ${error.message}` },
      { status: 500 }
    );
  }
}