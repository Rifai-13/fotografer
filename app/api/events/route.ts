// app/api/events/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Gunakan RPC function untuk performa optimal
    const { data: events, error } = await supabase
      .rpc('get_photographer_events', { 
        p_photographer_id: session.user.id 
      });

    if (error) {
      console.error('RPC error:', error);
      // Fallback ke query biasa
      return await getEventsFallback(supabase, session.user.id);
    }

    return NextResponse.json({ events });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Fallback function
async function getEventsFallback(supabase: any, userId: string) {
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .eq('photographer_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return NextResponse.json({ events });
}