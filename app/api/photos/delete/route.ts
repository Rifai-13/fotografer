// app/api/photos/delete/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function DELETE(request: Request) {
  try {
    const { photoIds, eventId } = await request.json();

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

    // Hapus dari database
    const { error: dbError } = await supabaseAdmin
      .from('photos')
      .delete()
      .in('id', photoIds);

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    // Hapus dari storage (opsional)
    // const { error: storageError } = await supabaseAdmin.storage
    //   .from('event-photos')
    //   .remove(photoIds.map(id => `${eventId}/${id}`));

    return NextResponse.json({ 
      success: true,
      message: `${photoIds.length} photos deleted successfully`
    });

  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete photos' },
      { status: 500 }
    );
  }
}