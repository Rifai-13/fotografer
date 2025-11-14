// lib/event-utils.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function checkEventReady(eventId: string) {
  try {
    // Cek apakah event ada dan aktif
    const { data: event, error } = await supabase
      .from('events')
      .select('id, name, status')
      .eq('id', eventId)
      .single();

    if (error || !event || event.status !== 'active') {
      return { ready: false, reason: 'Event tidak aktif atau tidak ditemukan' };
    }

    // Cek apakah ada foto di event ini
    const { count } = await supabase
      .from('photos')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId);

    if (count === 0) {
      return { ready: false, reason: 'Tidak ada foto di event ini' };
    }

    // Cek apakah collection sudah dibuat (optional)
    try {
      const response = await fetch('/api/search-faces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          image: 'dummy'
        }),
      });
      
      const result = await response.json();
      const collectionExists = result.code !== 'COLLECTION_NOT_FOUND';
      
      return { 
        ready: collectionExists, 
        reason: collectionExists ? 'Ready' : 'Collection belum dibuat'
      };
    } catch {
      return { ready: false, reason: 'Error checking collection' };
    }

  } catch (error) {
    console.error('Check event ready error:', error);
    return { ready: false, reason: 'Error checking event status' };
  }
}