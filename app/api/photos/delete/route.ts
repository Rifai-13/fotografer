// app/api/photos/delete/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function DELETE(request: Request) {
  try {
    const { photoIds } = await request.json(); // eventId tidak perlu jika file_path sudah lengkap

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

    // 1️⃣ STEP BARU: AMBIL PATH FILE SEBELUM DATA TERHAPUS
    console.log('🔍 Fetching file paths from database...');
    const { data: photos, error: selectError } = await supabaseAdmin
      .from('photos')
      .select('file_path')
      .in('id', photoIds);
      
    if (selectError) {
      throw new Error(`Database SELECT error: ${selectError.message}`);
    }

    const filePaths = photos.map(p => p.file_path).filter(path => path !== null) as string[];

    if (filePaths.length === 0) {
        console.log('⚠️ No file paths found in database or all already deleted.');
    } else {
        // 2️⃣ STEP BARU: HAPUS DARI STORAGE
        console.log(`🗑️ Deleting ${filePaths.length} files from storage...`);
        const { error: storageError } = await supabaseAdmin.storage
            .from('event-photos') // 🚨 Pastikan nama bucket sudah benar
            .remove(filePaths);

        if (storageError) {
            console.error('❌ Storage delete error:', storageError);
            // 💡 Catatan: Kita tidak throw error di sini, karena data DB masih bisa dihapus.
        } else {
            console.log('✅ Files successfully deleted from storage.');
        }
    }


    // 3️⃣ STEP LAMA: Hapus dari database (Setelah file Storage dihapus)
    console.log(`🗑️ Deleting ${photoIds.length} records from database...`);
    const { error: dbError } = await supabaseAdmin
      .from('photos')
      .delete()
      .in('id', photoIds);

    if (dbError) {
      throw new Error(`Database DELETE error: ${dbError.message}`);
    }

    // 💡 Opsional: Hapus dari AWS Rekognition/Index Faces jika perlu
    // ...

    return NextResponse.json({ 
      success: true,
      message: `${photoIds.length} photos deleted successfully from DB and storage.`
    });

  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete photos' },
      { status: 500 }
    );
  }
}