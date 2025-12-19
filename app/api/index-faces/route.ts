import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  RekognitionClient, 
  IndexFacesCommand,
  CreateCollectionCommand
} from "@aws-sdk/client-rekognition";

// --- KONFIGURASI ---
// Batasi jumlah foto yang diproses per request agar server tidak timeout (Vercel limit 10-60 detik)
const BATCH_LIMIT = 50; 

// Inisialisasi Supabase (SERVICE ROLE - Bypass RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Inisialisasi AWS Rekognition
const rekognitionClient = new RekognitionClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Helper: Pastikan Collection AWS Ada
async function ensureCollectionExists(collectionId: string) {
  try {
    const createCommand = new CreateCollectionCommand({ CollectionId: collectionId });
    await rekognitionClient.send(createCommand);
    // console.log(`Collection ${collectionId} created/checked.`);
  } catch (error: any) {
    if (error.name !== 'ResourceAlreadyExistsException') {
      console.error("Error creating collection:", error);
      throw error;
    }
  }
}

// Helper: Proses 1 Foto
async function processSinglePhoto(photo: any, collectionId: string) {
  try {
    // 1. Download dari Supabase Storage
    // ⚠️ Pastikan nama bucket sesuai ('event-photos')
    const { data: photoData, error: storageError } = await supabase.storage
      .from('event-photos') 
      .download(photo.file_path);

    if (storageError) throw new Error(`Storage download fail: ${storageError.message}`);

    // 2. Convert ke Buffer
    const arrayBuffer = await photoData.arrayBuffer();
    const imageBytes = Buffer.from(arrayBuffer);

    // 3. Kirim ke AWS Rekognition
    const command = new IndexFacesCommand({
      CollectionId: collectionId,
      Image: { Bytes: imageBytes },
      ExternalImageId: photo.id, // ID Foto dari DB
      MaxFaces: 10,
      DetectionAttributes: ["DEFAULT"],
    });

    const response = await rekognitionClient.send(command);
    const facesCount = response.FaceRecords?.length || 0;

    // 4. Update Database (PENTING: Set is_processed = TRUE)
    await supabase
      .from('photos')
      .update({ 
          faces_indexed: facesCount,
          indexed_at: new Date().toISOString(),
          is_processed: true // ✅ TANDAI SUDAH SELESAI
      })
      .eq('id', photo.id);

    return { success: true, id: photo.id, faces: facesCount };

  } catch (error: any) {
    console.error(`❌ Gagal foto ID ${photo.id}:`, error.message);
    // Tetap update status processed walau gagal, atau beri flag error (opsional)
    // Disini kita biarkan false agar bisa diretry nanti, tapi hati-hati infinite loop.
    return { success: false, id: photo.id, error: error.message };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { eventId } = body;

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID wajib ada' }, { status: 400 });
    }

    // 1. Pastikan Collection AWS siap
    const collectionId = `event-${eventId}`;
    await ensureCollectionExists(collectionId);

    // 2. AMBIL FOTO YANG BELUM DIPROSES (Batching)
    // Kita ambil max 50 foto dulu agar tidak timeout.
    // Nanti API ini bisa dipanggil berulang-ulang (Recursive/Cron) jika mau full otomatis.
    const { data: photos, error: dbError } = await supabase
      .from('photos')
      .select('*')
      .eq('event_id', eventId)
      .eq('is_processed', false) // 🔥 HANYA YANG BELUM DIPROSES
      .limit(BATCH_LIMIT);

    if (dbError) throw dbError;

    if (!photos || photos.length === 0) {
      return NextResponse.json({ message: "Semua foto sudah terproses / Tidak ada foto baru." });
    }

    console.log(`🤖 Mulai memproses ${photos.length} foto untuk Event ${eventId}...`);

    // 3. LOOPING PROSES (Parallel dengan Promise.all)
    // Kita jalankan semua sekaligus agar cepat
    const results = await Promise.all(
      photos.map(photo => processSinglePhoto(photo, collectionId))
    );

    const successCount = results.filter(r => r.success).length;

    console.log(`✅ Batch selesai. Sukses: ${successCount}, Gagal: ${results.length - successCount}`);

    // 4. Cek apakah masih ada sisa?
    // Jika user upload 1600, batch ini cuma kerjain 50.
    // Di sistem Production yang canggih, kita bisa panggil API ini lagi (rekursif) di sini.
    // Tapi untuk sekarang, return success dulu.
    
    return NextResponse.json({
      success: true,
      processed: results.length,
      successCount,
      remaining: "Cek DB untuk sisa antrian"
    });

  } catch (error: any) {
    console.error('System Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}