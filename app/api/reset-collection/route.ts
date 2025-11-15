// app/api/admin/reset-collection/route.ts
import { NextResponse } from 'next/server';
import { RekognitionClient, DeleteCollectionCommand, CreateCollectionCommand } from "@aws-sdk/client-rekognition";

const rekognitionClient = new RekognitionClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: Request) {
  try {
    const { eventId } = await request.json();
    
    if (!eventId) {
      return NextResponse.json({ error: 'Event ID required' }, { status: 400 });
    }

    const collectionId = `event-${eventId}`;

    // Coba hapus collection lama
    try {
      await rekognitionClient.send(new DeleteCollectionCommand({
        CollectionId: collectionId
      }));
      console.log(`🗑️ Collection ${collectionId} deleted`);
    } catch (deleteError: any) {
      if (deleteError.name !== 'ResourceNotFoundException') {
        console.error('Error deleting collection:', deleteError);
      }
    }

    // Buat collection baru
    await rekognitionClient.send(new CreateCollectionCommand({
      CollectionId: collectionId
    }));
    console.log(`✅ Collection ${collectionId} created`);

    return NextResponse.json({ 
      success: true, 
      message: 'Collection reset successfully',
      collectionId: collectionId
    });

  } catch (error: any) {
    console.error('Reset collection error:', error);
    return NextResponse.json(
      { error: 'Failed to reset collection: ' + error.message },
      { status: 500 }
    );
  }
}