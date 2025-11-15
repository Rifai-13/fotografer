// app/api/index-faces/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  RekognitionClient, 
  IndexFacesCommand,
  CreateCollectionCommand
} from "@aws-sdk/client-rekognition";

// Inisialisasi Supabase client (ADMIN/SERVICE ROLE)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Inisialisasi AWS Rekognition client
const rekognitionClient = new RekognitionClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

/**
 * Fungsi helper untuk memastikan Collection di AWS ada.
 */
async function ensureCollectionExists(collectionId: string) {
  try {
    const createCommand = new CreateCollectionCommand({ CollectionId: collectionId });
    await rekognitionClient.send(createCommand);
    console.log(`Collection ${collectionId} created.`);
  } catch (error: any) {
    if (error.name === 'ResourceAlreadyExistsException') {
      console.log(`Collection ${collectionId} already exists.`);
    } else {
      console.error("Error ensuring collection exists:", error);
      throw error;
    }
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    // ========= LOGIKA UNTUK DETEKSI WEBHOOK =========
    let eventId: string, photoId: string, filePath: string;

    if (payload.type === 'INSERT' && payload.record) {
      // Ini adalah payload dari Supabase Webhook
      console.log('Processing Supabase INSERT webhook...');
      eventId = payload.record.event_id;
      photoId = payload.record.id;
      filePath = payload.record.file_path;
    } else {
      // Ini adalah payload manual (dari /api/setup-event)
      console.log('Processing manual API call...');
      eventId = payload.eventId;
      photoId = payload.photoId;
      filePath = payload.filePath; 
    }
    // ================================================

    if (!eventId || !photoId || !filePath) {
      return NextResponse.json(
        { error: 'eventId, photoId, dan filePath diperlukan' },
        { status: 400 }
      );
    }

    const collectionId = `event-${eventId}`;

    // 1. Pastikan Collection-nya ada
    await ensureCollectionExists(collectionId);

    // 2. Download foto dari Supabase Storage
    console.log(`Downloading photo: ${filePath}`);
    const { data: photoData, error: storageError } = await supabase.storage
      .from('event-photos') // Ganti jika nama bucket-mu beda
      .download(filePath);

    if (storageError) {
      console.error('Error downloading photo from Supabase:', storageError);
      return NextResponse.json({ error: 'Gagal download foto dari storage' }, { status: 500 });
    }

    // 3. Ubah foto jadi Buffer
    const arrayBuffer = await photoData.arrayBuffer();
    const imageBytes = Buffer.from(arrayBuffer);

    // 4. Buat Perintah "IndexFaces"
    const command = new IndexFacesCommand({
      CollectionId: collectionId,
      Image: { Bytes: imageBytes },
      ExternalImageId: photoId,
      MaxFaces: 10,
      DetectionAttributes: ["DEFAULT"],
    });

    const response = await rekognitionClient.send(command);
    const indexedFacesCount = response.FaceRecords?.length || 0;
    console.log(`Successfully indexed ${indexedFacesCount} faces for photo ${photoId}`);

    // 5. Update kolom 'faces_indexed' dan 'indexed_at' di database
    const { error: updateError } = await supabase
      .from('photos')
      .update({ 
          faces_indexed: indexedFacesCount,
          indexed_at: new Date().toISOString()
      })
      .eq('id', photoId);

    if (updateError) {
      console.error('Error updating photo metadata:', updateError);
    }

    return NextResponse.json({
      success: true,
      indexedFaces: indexedFacesCount,
      photoId: photoId,
    });

  } catch (error: any) {
    console.error('Indexing error:', error.message);
    return NextResponse.json(
      { error: 'Gagal mengindeks wajah: ' + error.message },
      { status: 500 }
    );
  }
}