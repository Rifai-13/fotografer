// app/api/events/delete-full/route.ts

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Pastikan Environment Variables ini sudah disetel:
// NEXT_PUBLIC_SUPABASE_URL
// SUPABASE_SERVICE_ROLE_KEY (Kunci rahasia untuk akses Admin)

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

// 🚨 KRITIS: Pastikan nama bucket ini sesuai (event-photos)
const BUCKET_NAME = 'event-photos';

export async function DELETE(request: Request) {
    try {
        const { eventId } = await request.json();

        if (!eventId) {
            return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
        }
        
        console.log(`Starting full deletion process for Event ID: ${eventId}`);

        // --- 1. HAPUS FOTO DARI STORAGE (REKURSIF) ---
        
        // Dapatkan list semua file yang ada di dalam folder eventId
        const { data: listData, error: listError } = await supabaseAdmin.storage
            .from(BUCKET_NAME)
            .list(eventId, { // Mencari di folder dengan nama eventId
                limit: 5000, // Tambahkan batas (max 5000 foto per event)
                offset: 0,
                search: ''
            });

        if (listError && listError.message !== 'The specified folder does not exist') {
            console.error('❌ Storage LIST error:', listError);
            // Lanjutkan, mungkin folder sudah kosong, tapi kita harus menghapus data DB
        }

        let filesDeletedCount = 0;
        const filesToDelete = listData?.map(file => `${eventId}/${file.name}`) || [];
        
        console.log(`Found ${filesToDelete.length} files to delete in Storage.`); 

        if (filesToDelete.length > 0) {
            const { error: storageError } = await supabaseAdmin.storage
                .from(BUCKET_NAME) 
                .remove(filesToDelete); // Hapus semua path sekaligus

            if (storageError) {
                console.error('❌ Final Storage delete error:', storageError);
                // Kita log error, tapi tetap lanjutkan ke database delete
            } else {
                filesDeletedCount = filesToDelete.length;
                console.log(`✅ ${filesDeletedCount} files successfully deleted from Storage.`);
            }
        } else {
             console.log(`⚠️ No files found for deletion in folder: ${eventId}`);
        }
        
        // --- 2. HAPUS FOTO DARI DATABASE (photos table) ---

        // Menghapus data di tabel 'photos' berdasarkan event_id
        const { error: deletePhotosError } = await supabaseAdmin.from('photos')
            .delete()
            .eq('event_id', eventId);
        
        if (deletePhotosError) {
            throw new Error(`Gagal menghapus data foto di DB: ${deletePhotosError.message}`);
        }
        console.log(`✅ Photo records deleted from database.`);


        // --- 3. HAPUS EVENT DARI DATABASE (events table) ---
        
        const { error: deleteEventError } = await supabaseAdmin
            .from("events")
            .delete()
            .eq("id", eventId);

        if (deleteEventError) {
            throw new Error(`Gagal menghapus event utama: ${deleteEventError.message}`);
        }
        console.log(`✅ Event record deleted from database.`);


        return NextResponse.json({ 
            success: true,
            message: `Event dan ${filesDeletedCount} foto berhasil dihapus permanen.`
        });

    } catch (error: any) {
        console.error('❌ Server Delete error (500):', error);
        return NextResponse.json(
            { error: error.message || 'Failed to delete event and associated files' },
            { status: 500 }
        );
    }
}