// app/api/photos/delete-mass/route.ts

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

const BUCKET_NAME = 'event-photos';

export async function DELETE(request: Request) {
    try {
        const { photoIds } = await request.json(); // Hanya menerima Photo IDs

        if (!photoIds || photoIds.length === 0) {
            return NextResponse.json({ error: 'Missing or empty photoIds' }, { status: 400 });
        }
        
        console.log(`Starting mass photo deletion for ${photoIds.length} photos.`);

        // --- 1. Ambil file_path dari database ---
        const { data: photos, error: selectError } = await supabaseAdmin
            .from("photos")
            .select("file_path")
            .in("id", photoIds);

        if (selectError) {
            throw new Error(`Database SELECT error: ${selectError.message}`);
        }

        const filePaths = photos.map(p => p.file_path).filter(path => path !== null) as string[];
        
        // --- 2. Hapus dari Storage ---
        let filesDeletedCount = 0;
        if (filePaths.length > 0) {
            const { error: storageError } = await supabaseAdmin.storage
                .from(BUCKET_NAME) 
                .remove(filePaths);

            if (storageError) {
                console.error('❌ Storage delete error (mass):', storageError);
                // Log error tapi tetap lanjutkan ke database delete
            } else {
                filesDeletedCount = filePaths.length;
                console.log(`✅ ${filesDeletedCount} files successfully deleted from Storage.`);
            }
        }
        
        // --- 3. Hapus foto dari database (berdasarkan Photo ID) ---
        const { error: deletePhotosError } = await supabaseAdmin.from('photos')
            .delete()
            .in('id', photoIds); // 💡 KRITIS: Menghapus hanya berdasarkan photo ID, bukan event ID

        if (deletePhotosError) {
            throw new Error(`Gagal menghapus data foto di DB: ${deletePhotosError.message}`);
        }
        console.log(`✅ ${photoIds.length} Photo records deleted from database.`);

        // 💡 Catatan: Jika Anda menggunakan kolom `photo_count` di tabel `events`, 
        // Anda perlu membuat RPC/trigger untuk mengurangi jumlahnya di sini.

        return NextResponse.json({ 
            success: true,
            message: `${photoIds.length} foto berhasil dihapus.`,
            deletedCount: photoIds.length
        });

    } catch (error: any) {
        console.error('❌ Server Delete Mass Photo error (500):', error);
        return NextResponse.json(
            { error: error.message || 'Failed to delete mass photos' },
            { status: 500 }
        );
    }
}