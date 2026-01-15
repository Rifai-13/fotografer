"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import imageCompression from "browser-image-compression";
import pLimit from "p-limit";

// --- KONFIGURASI SMART COMPRESSION ---

// --- KONFIGURASI SMART COMPRESSION (UPDATED) ---

// MODE TURBO (For User Face Scan/Selfie) -> Target ~300KB
const OPTIONS_TURBO = {
  maxSizeMB: 0.3,         // Max 300KB (Fastest for recognition)
  maxWidthOrHeight: 1280, // 720p is sufficient
  useWebWorker: true,
  fileType: "image/jpeg",
  initialQuality: 0.7,
};

// MODE HQ (For Photographer Uploads) -> Target ~1.5MB
const OPTIONS_HQ = {
  maxSizeMB: 1.0,         // Paksa di bawah 1MB
  maxWidthOrHeight: 2160, // Resolusi 4K (Sangat tajam, tapi hemat size)
  useWebWorker: true,
  fileType: "image/jpeg",
  initialQuality: 0.8,    // 80% quality (best balance)
};

export default function UploadPhotos({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const [eventId, setEventId] = useState<string | null>(null);

  // State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progressMap, setProgressMap] = useState<Record<number, number>>({});
  const [statusLog, setStatusLog] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function unwrapParams() {
      const unwrappedParams = await params;
      setEventId(unwrappedParams.eventId);
    }
    unwrapParams();
  }, [params]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...filesArray]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setProgressMap((prev) => {
      const newMap = { ...prev };
      delete newMap[index];
      return newMap;
    });
  };

  // 🚀 LOGIC UTAMA (REFACTORED FOR SPEED)
  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !eventId) return;

    setUploading(true);
    setStatusLog("🚀 Menyiapkan antrian upload...");

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const photographerId = session?.user?.id;

    if (!photographerId) {
      alert("Sesi habis, silakan login ulang.");
      setUploading(false);
      return;
    }

    // KONFIGURASI QUEUE
    const CONCURRENCY = 5; // Best for browser
    const limit = pLimit(CONCURRENCY);
    
    // BUFFER UNTUK DB (Batch Insert)
    let dbBuffer: any[] = [];
    const DB_BATCH_SIZE = 50;
    
    const flushDbBuffer = async () => {
        if (dbBuffer.length === 0) return;
        const batchToInsert = [...dbBuffer];
        dbBuffer = []; // Clear local buffer immediately

        try {
            console.log(`💾 Saving ${batchToInsert.length} photos to DB...`);
            await fetch("/api/photos/bulk-register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ photos: batchToInsert }),
            });
            
            // Update UI: Centang hijau untuk batch ini
            batchToInsert.forEach(photoItem => {
                 // Cari index asli dari URL atau nama (disini kita pakai nama file utk matching sederhana di demo ini, idealnya pakai ID unik)
                 // Karena logic simple, kita skip update state complex, asumsikan upload storage = progress 90%, DB = 100%
                 // Kita update manual logicnya di bawah via progressMap
            });
        } catch (err) {
            console.error("❌ DB Batch Error:", err);
        }
    };

    setStatusLog(`⚡ Mengupload dengan Concurrency ${CONCURRENCY}...`);

    const promises = selectedFiles.map((file, originalIndex) => {
        return limit(async () => {
            try {
                // 1. COMPRESS (Pakai HQ buat Photographer)
                setProgressMap((prev) => ({ ...prev, [originalIndex]: 10 }));
                let fileToUpload = file;
                try {
                    // Cek Smart Skip Compression
                    const fileSizeLimitBytes = OPTIONS_HQ.maxSizeMB * 1024 * 1024;
                    if (file.size < fileSizeLimitBytes) {
                        console.log(`⏩ File is small (${(file.size / 1024).toFixed(1)} KB), skipping compression for speed.`);
                        fileToUpload = file;
                    } else {
                        fileToUpload = await imageCompression(file, OPTIONS_HQ);
                    }
                } catch (e) {
                    console.warn("Compression fallback:", e);
                }

                // 2. UPLOAD STORAGE
                setProgressMap((prev) => ({ ...prev, [originalIndex]: 40 }));
                const fileNameClean = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
                const storagePath = `${eventId}/${Date.now()}_${Math.random().toString(36).substring(7)}_${fileNameClean}`;

                const { error: uploadError } = await supabase.storage
                    .from("event-photos")
                    .upload(storagePath, fileToUpload, {
                        cacheControl: "3600",
                        upsert: false,
                    });

                if (uploadError) throw uploadError;

                // 3. GET URL
                const { data: urlData } = supabase.storage
                    .from("event-photos")
                    .getPublicUrl(storagePath);

                // 4. BUFFER DATA
                dbBuffer.push({
                    event_id: eventId,
                    photographer_id: photographerId,
                    file_name: file.name,
                    file_path: storagePath,
                    storage_url: urlData.publicUrl,
                    image_url: urlData.publicUrl,
                    file_size: fileToUpload.size,
                    created_at: new Date().toISOString(),
                    is_processed: false,
                });

                setProgressMap((prev) => ({ ...prev, [originalIndex]: 80 }));

                // Cek apakah buffer sudah penuh?
                if (dbBuffer.length >= DB_BATCH_SIZE) {
                    await flushDbBuffer();
                }

            } catch (error) {
                console.error(`Filed ${file.name}:`, error);
                setProgressMap((prev) => ({ ...prev, [originalIndex]: -1 }));
            }
        });
    });

    // TUNGGU SEMUA UPLOAD SELESAI
    await Promise.all(promises);

    // FLUSH SISA BUFFER TERAKHIR
    if (dbBuffer.length > 0) {
        setStatusLog("💾 Menyimpan data terakhir ke database...");
        await flushDbBuffer();
    }

    // Set semua yang berhasil (progress 80+) jadi 100
    setProgressMap((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((key: any) => {
            if (next[key] >= 80) next[key] = 100;
        });
        return next;
    });

    setStatusLog("✅ Upload Selesai!");
    setTimeout(() => {
      router.push(`/dashboard/events/${eventId}/manage`);
    }, 1000);
  };

  // --- UI PART ---
  if (!eventId) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Upload Foto</h1>
          <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            MacBook Optimized ⚡
          </div>
        </div>

        {!uploading && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-blue-200 bg-blue-50 rounded-lg p-10 text-center cursor-pointer hover:bg-blue-100 transition"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept="image/*"
              className="hidden"
            />
            <p className="text-blue-600 font-semibold text-lg">
              Klik untuk pilih foto
            </p>
            <p className="text-gray-400 text-sm mt-2">JPG, PNG</p>
          </div>
        )}

        {selectedFiles.length > 0 && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-4 border-b pb-2 sticky top-0 bg-white z-10">
              <span className="font-bold">{selectedFiles.length} Foto</span>
              {statusLog && (
                <span className="text-blue-600 text-sm animate-pulse font-medium">
                  {statusLog}
                </span>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedFiles([])}
                  disabled={uploading}
                  className="text-red-500 px-3 py-1"
                >
                  Reset
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold disabled:bg-blue-300"
                >
                  {uploading ? "Memproses..." : "START UPLOAD"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {selectedFiles.map((file, index) => {
                const progress = progressMap[index] || 0;
                return (
                  <div
                    key={index}
                    className="relative aspect-square bg-gray-100 rounded overflow-hidden border"
                  >
                    <img
                      src={URL.createObjectURL(file)}
                      className={`w-full h-full object-cover ${
                        progress === 100 ? "opacity-50" : ""
                      }`}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      {progress > 0 && progress < 100 && (
                        <span className="text-xs font-bold bg-white/80 px-1 rounded">
                          {progress}%
                        </span>
                      )}
                      {progress === 100 && <span>✅</span>}
                      {progress === -1 && <span>❌</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}