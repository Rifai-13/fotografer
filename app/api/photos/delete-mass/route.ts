import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  RekognitionClient,
  DeleteCollectionCommand,
} from "@aws-sdk/client-rekognition";

// Init AWS (Untuk hapus collection juga biar bersih total)
const rekognitionClient = new RekognitionClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function DELETE(req: Request) {
  // 🛡️ MODE ADMIN (Service Role)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    const { eventId } = await req.json();

    if (!eventId) {
      return NextResponse.json(
        { error: "Event ID wajib ada" },
        { status: 400 }
      );
    }

    console.log(`🗑️ Memulai penghapusan massal untuk Event: ${eventId}`);

    // 1. HAPUS COLLECTION DI AWS DULU (Biar bersih)
    // Kita hapus collectionnya, nanti saat upload baru dia akan auto-create lagi
    try {
      const collectionId = `event-${eventId}`;
      await rekognitionClient.send(
        new DeleteCollectionCommand({ CollectionId: collectionId })
      );
      console.log("✅ AWS Collection dihapus.");
    } catch (awsError: any) {
      // Abaikan jika errornya "ResourceNotFoundException" (artinya emang udah gak ada)
      if (awsError.name !== "ResourceNotFoundException") {
        console.error("⚠️ AWS Delete Warning:", awsError.message);
      }
    }

    // 2. LOOPING HAPUS DATABASE & STORAGE (BATCHING)
    // Kita hapus per 100 foto agar tidak Timeout / Fetch Failed
    let isDeleting = true;
    let totalDeleted = 0;

    while (isDeleting) {
      // Ambil 100 foto
      const { data: photos, error: fetchError } = await supabase
        .from("photos")
        .select("id, file_path")
        .eq("event_id", eventId)
        .limit(100);

      if (fetchError) throw fetchError;

      // Jika tidak ada foto tersisa, stop loop
      if (!photos || photos.length === 0) {
        isDeleting = false;
        break;
      }

      // Hapus File di Storage Supabase
      const filePaths = photos.map((p) => p.file_path);
      if (filePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("event-photos")
          .remove(filePaths);

        if (storageError) console.error("Storage delete error:", storageError);
      }

      // Hapus Row di Database
      const photoIds = photos.map((p) => p.id);
      const { error: dbError } = await supabase
        .from("photos")
        .delete()
        .in("id", photoIds);

      if (dbError) throw dbError;

      totalDeleted += photos.length;
      console.log(
        `🔥 Menghapus batch ${photos.length} foto... (Total: ${totalDeleted})`
      );

      // Istirahat dikit biar database napas
      await new Promise((r) => setTimeout(r, 200));
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil menghapus total ${totalDeleted} foto dan reset AI.`,
    });
  } catch (error: any) {
    console.error("❌ Server Delete Mass Photo error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
