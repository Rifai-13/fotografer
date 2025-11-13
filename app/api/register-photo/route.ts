// app/api/register-photo/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
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
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('Registering photo for event:', event_id);

    // Buat base data terlebih dahulu
    const baseData = {
      event_id,
      photographer_id,
      image_url: storage_url,
      file_name: file_name || 'unknown',
      file_size: parseInt(file_size) || 0,
      uploaded_at: new Date().toISOString(),
    };

    // Tambahkan file_path jika ada menggunakan spread operator
    const photoData = file_path 
      ? { ...baseData, file_path }
      : baseData;

    // Insert photo dan update photo_count dalam transaction-like manner
    const [{ data: photo, error: photoError }, { error: countError }] = await Promise.all([
      // Insert photo
      supabaseAdmin
        .from('photos')
        .insert(photoData)
        .select()
        .single(),
      
      // Update photo_count menggunakan RPC function (lebih cepat)
      supabaseAdmin.rpc('increment_photo_count', { p_event_id: event_id })
    ]);

    if (photoError) {
      console.error('Photo insert error:', photoError);
      return NextResponse.json(
        { error: `Failed to insert photo: ${photoError.message}` },
        { status: 500 }
      );
    }

    if (countError) {
      console.error('Photo count update error:', countError);
      // Tidak return error di sini karena foto sudah berhasil diinsert
    }

    console.log('Photo registered successfully:', photo?.id);

    return NextResponse.json({ 
      success: true, 
      photo: photo 
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}