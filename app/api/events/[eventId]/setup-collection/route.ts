// app/api/events/[eventId]/setup-collection/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { setupEventCollection } from '@/lib/aws-rekognition';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> } // params adalah Promise
) {
  try {
    // UNWRAP PARAMS DENGAN AWAIT
    const { eventId } = await params;

    console.log('Setting up collection for event:', eventId);

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID tidak valid' },
        { status: 400 }
      );
    }

    // Cek apakah event exists dan aktif
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, name, status')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event tidak ditemukan' },
        { status: 404 }
      );
    }

    if (event.status !== 'active') {
      return NextResponse.json(
        { error: 'Event tidak aktif' },
        { status: 400 }
      );
    }

    // Cek apakah event sudah ada foto
    const { count, error: countError } = await supabase
      .from('photos')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId);

    if (countError) {
      throw countError;
    }

    if (count === 0) {
      return NextResponse.json(
        { error: 'Tidak ada foto di event ini' },
        { status: 400 }
      );
    }

    console.log(`Event ${event.name} memiliki ${count} foto`);

    // Setup collection hanya untuk event ini
    const setupResult = await setupEventCollection(eventId);

    return NextResponse.json({
      success: true,
      eventId: eventId,
      eventName: event.name,
      photoCount: count,
      ...setupResult
    });

  } catch (error: any) {
    console.error('Setup collection error:', error);
    return NextResponse.json(
      { error: 'Gagal setup collection: ' + error.message },
      { status: 500 }
    );
  }
}