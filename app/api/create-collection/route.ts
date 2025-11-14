// app/api/create-collection/route.ts
import { NextResponse } from 'next/server';
import { RekognitionClient, CreateCollectionCommand } from "@aws-sdk/client-rekognition";

const rekognitionClient = new RekognitionClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: Request) {
  
  // ========= PERBAIKAN: Pindahkan deklarasi ke sini =========
  const body = await request.json();
  const eventId = body.eventId;
  // =======================================================

  try {
    // const body = await request.json(); // <-- Sudah dipindah ke atas
    // const eventId = body.eventId; // <-- Sudah dipindah ke atas

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID diperlukan' },
        { status: 400 }
      );
    }

    const collectionId = `event-${eventId}`;

    console.log('Creating collection:', collectionId);

    const command = new CreateCollectionCommand({
      CollectionId: collectionId,
    });

    const response = await rekognitionClient.send(command);

    console.log('Collection created successfully:', collectionId);

    return NextResponse.json({
      success: true,
      collectionId: collectionId,
      statusCode: response.StatusCode,
    });

  } catch (error: any) {
    console.error('Create collection error:', error);
    
    // If collection already exists, that's fine
    if (error.name === 'ResourceAlreadyExistsException') {
      
      // Sekarang 'eventId' BISA DIAKSES di sini
      return NextResponse.json({
        success: true,
        message: 'Collection already exists',
        collectionId: `event-${eventId}`, // <-- INI SEKARANG AMAN
      });
    }

    return NextResponse.json(
      { error: 'Gagal membuat collection: ' + error.message },
      { status: 500 }
    );
  }
}