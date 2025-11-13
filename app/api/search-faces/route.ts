// app/api/search-faces/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { RekognitionClient, SearchFacesByImageCommand } from "@aws-sdk/client-rekognition";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize AWS Rekognition client
const rekognitionClient = new RekognitionClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: Request) {
  try {
    const { eventId, image, imageType = 'JPEG' } = await request.json();

    if (!eventId || !image) {
      return NextResponse.json(
        { error: 'Event ID dan gambar diperlukan' },
        { status: 400 }
      );
    }

    console.log('Starting face search for event:', eventId);

    // Get all photos from the event
    const { data: photos, error: photosError } = await supabase
      .from('photos')
      .select('id, image_url, file_path')
      .eq('event_id', eventId);

    if (photosError) {
      console.error('Error fetching photos:', photosError);
      return NextResponse.json(
        { error: 'Gagal mengambil data foto' },
        { status: 500 }
      );
    }

    if (!photos || photos.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada foto ditemukan untuk event ini' },
        { status: 404 }
      );
    }

    console.log(`Found ${photos.length} photos to search`);

    // Convert base64 image to buffer
    const imageBytes = Buffer.from(image, 'base64');

    const matches: any[] = [];

    // Search faces in each photo
    for (const photo of photos) {
      try {
        // Get the photo from Supabase Storage
        const { data: photoData, error: storageError } = await supabase.storage
          .from('event-photos')
          .download(photo.file_path);

        if (storageError) {
          console.error('Error downloading photo:', storageError);
          continue;
        }

        // Convert downloaded photo to buffer
        const arrayBuffer = await photoData.arrayBuffer();
        const targetImageBytes = Buffer.from(arrayBuffer);

        // Search faces using AWS Rekognition
        const command = new SearchFacesByImageCommand({
          CollectionId: `event-${eventId}`, // You might want to create collections per event
          Image: {
            Bytes: imageBytes,
          },
          FaceMatchThreshold: 80, // Minimum similarity threshold (0-100)
          MaxFaces: 10,
        });

        const response = await rekognitionClient.send(command);

        if (response.FaceMatches && response.FaceMatches.length > 0) {
          for (const match of response.FaceMatches) {
            if (match.Face && match.Similarity) {
              matches.push({
                photo_id: photo.id,
                image_url: photo.image_url,
                similarity: match.Similarity,
                bounding_box: match.Face.BoundingBox,
                face_id: match.Face.FaceId,
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error processing photo ${photo.id}:`, error);
        // Continue with next photo
      }
    }

    // Sort matches by similarity (highest first)
    matches.sort((a, b) => b.similarity - a.similarity);

    console.log(`Found ${matches.length} face matches`);

    return NextResponse.json({
      success: true,
      matches: matches.slice(0, 20), // Return top 20 matches
      total_photos_searched: photos.length,
      total_matches: matches.length,
    });

  } catch (error) {
    console.error('Face search error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mencari wajah' },
      { status: 500 }
    );
  }
}