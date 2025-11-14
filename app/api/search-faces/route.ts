// app/api/search-faces/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { RekognitionClient, SearchFacesByImageCommand } from "@aws-sdk/client-rekognition";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const rekognitionClient = new RekognitionClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { eventId, image } = body;

    if (!eventId || !image) {
      return NextResponse.json(
        { error: 'Event ID dan gambar diperlukan' },
        { status: 400 }
      );
    }

    console.log('Starting face search for event:', eventId);

    const imageBytes = Buffer.from(image, 'base64');
    const collectionId = `event-${eventId}`;

    try {
      const command = new SearchFacesByImageCommand({
        CollectionId: collectionId,
        Image: { Bytes: imageBytes },
        FaceMatchThreshold: 80, // Kamu sudah turunkan, jadi pakai ini
        MaxFaces: 100, // Tetap 100
      });

      const response = await rekognitionClient.send(command);

      console.log('AWS Rekognition response:', {
        faceMatches: response.FaceMatches?.length,
        searchedFace: response.SearchedFaceConfidence
      });

      if (!response.FaceMatches || response.FaceMatches.length === 0) {
        console.log('No face matches found from Rekognition.');
        return NextResponse.json({
          success: true,
          matches: [],
          total_matches: 0,
          searched_face_confidence: response.SearchedFaceConfidence,
        });
      }

      // 1. Kumpulkan semua ExternalImageId dari hasil Rekognition
      const rekognitionMatchData = new Map<string, { similarity: number, boundingBox: any, faceId: string }>();
      for (const match of response.FaceMatches) {
        if (match.Face?.ExternalImageId && match.Similarity) {
          const photoId = match.Face.ExternalImageId;
          // Simpan data match terbaik (tertinggi similarity) jika ada duplikat ExternalImageId
          if (!rekognitionMatchData.has(photoId) || match.Similarity > rekognitionMatchData.get(photoId)!.similarity) {
            rekognitionMatchData.set(photoId, {
              similarity: match.Similarity,
              boundingBox: match.Face.BoundingBox || {},
              faceId: match.Face.FaceId || '',
            });
          }
        }
      }

      const uniquePhotoIds = Array.from(rekognitionMatchData.keys());

      if (uniquePhotoIds.length === 0) {
        console.log('No unique photo IDs extracted from Rekognition matches.');
        return NextResponse.json({
          success: true,
          matches: [],
          total_matches: 0,
          searched_face_confidence: response.SearchedFaceConfidence,
        });
      }

      // 2. Ambil data foto dari Supabase SATU KALI SAJA berdasarkan uniquePhotoIds
      const { data: photos, error: photoError } = await supabase
        .from('photos')
        .select('id, image_url') // Pastikan mengambil image_url
        .in('id', uniquePhotoIds);

      if (photoError) {
        console.error('Error fetching matched photos from Supabase:', photoError.message);
        throw new Error('Gagal mengambil data foto yang cocok dari database');
      }

      // 3. Gabungkan data dari Rekognition dan Supabase
      const finalMatches = photos.map(photo => {
        const matchData = rekognitionMatchData.get(photo.id);
        if (!matchData) {
          // Seharusnya tidak terjadi, tapi untuk safety
          console.warn(`Photo ID ${photo.id} found in Supabase but not in Rekognition matches.`);
          return null; 
        }

        return {
          photo_id: photo.id,
          image_url: photo.image_url, // <-- Dapatkan langsung dari Supabase
          similarity: matchData.similarity,
          bounding_box: matchData.boundingBox,
          face_id: matchData.faceId,
          confidence: response.SearchedFaceConfidence,
        };
      }).filter(Boolean); // Hapus null entries jika ada (dari `return null` di atas)
      
      // Sort matches by similarity (highest first)
      finalMatches.sort((a, b) => b!.similarity - a!.similarity); // Tambah ! untuk memastikan bukan null

      console.log(`Found ${finalMatches.length} final matches after merging and filtering.`);

      return NextResponse.json({
        success: true,
        matches: finalMatches,
        total_matches: finalMatches.length,
        searched_face_confidence: response.SearchedFaceConfidence,
      });

    } catch (awsError: any) {
      if (awsError.name === 'ResourceNotFoundException') {
        return NextResponse.json(
          { 
            error: 'Collection untuk event ini belum dibuat atau kosong',
            code: 'COLLECTION_NOT_FOUND',
            matches: [] 
          },
          { status: 404 }
        );
      }
      console.error('AWS Rekognition service error:', awsError.message);
      throw awsError; // Dilempar lagi ke catch terluar
    }

  } catch (error: any) {
    console.error('Face search API general error:', error.message);
    return NextResponse.json(
      { error: 'Terjadi kesalahan umum saat mencari wajah: ' + error.message },
      { status: 500 }
    );
  }
}