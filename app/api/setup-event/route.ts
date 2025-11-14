// app/api/setup-event/route.ts
import { NextResponse } from 'next/server';
import { setupEventCollection } from '@/lib/aws-rekognition';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { eventId } = body;

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID diperlukan' },
        { status: 400 }
      );
    }

    const result = await setupEventCollection(eventId);

    // Gabungkan result dengan success: true tanpa overwrite
    return NextResponse.json({
      ...result,
      success: true
    });

  } catch (error: any) {
    console.error('Setup event error:', error);
    return NextResponse.json(
      { error: 'Gagal setup event: ' + error.message },
      { status: 500 }
    );
  }
}