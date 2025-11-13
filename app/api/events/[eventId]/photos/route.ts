// app/api/events/[eventId]/photos/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('Fetching photos for event:', eventId);

    // Ambil foto dari database berdasarkan event_id
    const { data: photos, error } = await supabase
      .from('photos')
      .select('*')
      .eq('event_id', eventId)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    console.log(`Found ${photos?.length || 0} photos for event ${eventId}`);

    // Transform data ke format yang diharapkan frontend
    const transformedPhotos = photos?.map(photo => ({
      id: photo.id,
      url: photo.image_url || photo.storage_url || photo.url, // Coba beberapa kemungkinan kolom URL
      filename: photo.file_name,
      uploadedAt: photo.uploaded_at,
      size: photo.file_size
    })) || [];

    return NextResponse.json({
      photos: transformedPhotos,
      count: transformedPhotos.length
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}