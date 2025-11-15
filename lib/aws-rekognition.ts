// lib/aws-rekognition.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper function untuk mendapatkan base URL (SUDAH DIPERBAIKI)
function getBaseUrl() {
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }
  
  // Fallback untuk Vercel (saat production)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Fallback untuk development (lokal)
  return 'http://localhost:3000';
}

export async function setupEventCollection(eventId: string) {
  try {
    console.log('🔧 Setting up collection for event:', eventId);

    const baseUrl = getBaseUrl();
    console.log('🌐 Base URL:', baseUrl);

    // 1. Create collection - gunakan absolute URL
    console.log('📦 Step 1: Creating collection...');
    const createCollectionResponse = await fetch(`${baseUrl}/api/create-collection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ eventId }),
    });

    if (!createCollectionResponse.ok) {
      const errorText = await createCollectionResponse.text();
      console.log('❌ Collection creation failed:', errorText);
      
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message?.includes('already exists')) {
          console.log('✅ Collection already exists');
        } else {
          throw new Error(errorJson.error || 'Gagal membuat collection');
        }
      } catch {
        throw new Error(`HTTP ${createCollectionResponse.status}: ${errorText}`);
      }
    } else {
      // Hanya parsing JSON jika createCollectionResponse.ok
      // Jika tidak ok dan "already exists", tidak ada JSON untuk di-parse
      const collectionResult = await createCollectionResponse.json();
      console.log('📦 Collection result:', collectionResult);
    }

    // 2. Get photos untuk event ini
    console.log('🖼️ Step 2: Getting photos...');
    const { data: photos, error } = await supabase
      .from('photos')
      .select('id, file_path, faces_indexed') 
      .eq('event_id', eventId);

    if (error) {
      throw error;
    }

    if (!photos || photos.length === 0) {
      console.log('🖼️ No photos found for this event. Setup complete.');
      return {
        collectionCreated: true,
        photosIndexed: 0,
        photosFailed: 0,
        totalPhotos: 0
      };
    }

    console.log(`🖼️ Found ${photos.length} total photos in DB`);

    let successfulIndexes = 0;
    let failedIndexes = 0;

    // Filter foto yang belum di-index
    const photosToIndex = photos.filter(
      (photo: any) => !photo.faces_indexed || photo.faces_indexed === 0
    );
    const photosAlreadyIndexed = photos.length - photosToIndex.length;

    console.log(`👉 Photos to index: ${photosToIndex.length}, Already indexed: ${photosAlreadyIndexed}`);

    // 3. Index faces (HANYA FOTO YANG BARU)
    if (photosToIndex.length > 0) {
      // Loop HANYA pada photosToIndex
      for (const photo of photosToIndex) { 
        try {
          console.log(`📸 Indexing photo: ${photo.id}`);
          
          const indexResponse = await fetch(`${baseUrl}/api/index-faces`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              eventId,
              photoId: photo.id,
              filePath: photo.file_path // Kirim ini jika /api/index-faces butuh
            }),
          });

          if (indexResponse.ok) {
            successfulIndexes++;
            console.log(`✅ Successfully indexed photo ${photo.id}`);
            
            // Update 'faces_indexed' di database jadi 1
            await supabase
              .from('photos')
              .update({ faces_indexed: 1 }) 
              .eq('id', photo.id);

          } else {
            failedIndexes++;
            const errorResult = await indexResponse.json();
            console.error(`❌ Failed to index photo ${photo.id}:`, errorResult.error);
          }
          
          // Delay kecil
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (photoError: any) { // <-- Perbaikan Tipe Error Kedua
          failedIndexes++;
          console.error(`💥 Error indexing photo ${photo.id}:`, photoError.message);
        }
      }
    }

    console.log(`🎉 Indexing completed. New: ${successfulIndexes}, Failed: ${failedIndexes}, Already Indexed: ${photosAlreadyIndexed}`);

    return {
      collectionCreated: true,
      photosIndexed: successfulIndexes, // Foto baru yang diindeks
      photosFailed: failedIndexes,
      totalPhotos: photos.length
    };

  } catch (error: any) {
    console.error('💥 Setup event collection error:', error.message);
    throw error;
  }
}