import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Setup Supabase Service Role Client (Bypass RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;

    if (!eventId) {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 }
      );
    }

    // Fetch public event details only
    const { data: event, error } = await supabase
      .from("events")
      .select("id, name, description, date, location, status")
      .eq("id", eventId)
      .single();

    if (error) {
      console.error("Supabase Error:", error);
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    // Check if event is active (optional, depends on business logic)
    // allowing 'inactive' events to be viewed but maybe not scanned is a UI decision.
    // Here we just return the data.

    return NextResponse.json(event);

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
