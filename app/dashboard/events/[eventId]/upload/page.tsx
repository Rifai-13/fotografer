"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import imageCompression from "browser-image-compression";
import pLimit from "p-limit";

// --- KONFIGURASI SMART COMPRESSION ---

// 1. Mode Turbo (File Kecil) -> Target 300KB
const OPTIONS_TURBO = {
  maxSizeMB: 0.3,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  fileType: "image/jpeg",
};

// 2. Mode High Quality (File Besar/Original) -> Target 1.5MB
// MacBook user aman pakai ini. Kualitas tajam, size hemat.
const OPTIONS_HQ = {
  maxSizeMB: 1.5,
  maxWidthOrHeight: 3000,
  useWebWorker: true,
  fileType: "image/jpeg",
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

  // Helper chunk array
  function chunkArray<T>(array: T[], size: number): T[][] {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
    }
    return result;
  }

  // 🚀 LOGIC UTAMA
  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !eventId) return;

    setUploading(true);
    setStatusLog("🚀 Menganalisis ukuran file...");

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const photographerId = session?.user?.id;

    if (!photographerId) {
      alert("Sesi habis, silakan login ulang.");
      setUploading(false);
      return;
    }

    // 1. ANALISA FILE (Berat vs Ringan)
    const totalSize = selectedFiles.reduce((acc, file) => acc + file.size, 0);
    const avgSize = totalSize / selectedFiles.length;
    // Ambang batas: rata-rata di atas 2MB dianggap berat
    const isHeavyLoad = avgSize > 2 * 1024 * 1024; 

    // 2. CONFIG STRATEGI (UPDATED FOR MACBOOK)
    // - Jika Heavy (Original): Upload 8 file sekaligus (Permintaan User)
    // - Jika Light (Kecil): Upload 30 file sekaligus
    const BATCH_SIZE = isHeavyLoad ? 8 : 30; 
    const CONCURRENCY = isHeavyLoad ? 8 : 30; 
    const COMPRESSION_SETTING = isHeavyLoad ? OPTIONS_HQ : OPTIONS_TURBO;

    setStatusLog(
      isHeavyLoad
        ? `💎 Mode HQ (MacBook Optimized): Batch ${BATCH_SIZE} file...`
        : `🐇 Mode Turbo: Batch ${BATCH_SIZE} file...`
    );

    const limit = pLimit(CONCURRENCY);
    const fileChunks = chunkArray(selectedFiles, BATCH_SIZE);
    let totalUploaded = 0;

    // 3. LOOP UPLOAD (TANPA INDEXING DI DALAMNYA)
    for (const [batchIndex, currentBatch] of fileChunks.entries()) {
      setStatusLog(
        `📦 Upload Batch ${batchIndex + 1}/${fileChunks.length} sedang berjalan...`
      );

      const batchSuccessData: any[] = [];

      const batchPromises = currentBatch.map((file) => {
        return limit(async () => {
          const originalIndex = selectedFiles.indexOf(file);

          try {
            // A. Compress
            setProgressMap((prev) => ({ ...prev, [originalIndex]: 10 }));
            let fileToUpload = file;
            try {
              fileToUpload = await imageCompression(file, COMPRESSION_SETTING);
            } catch (e) {
              console.warn("Gagal kompresi, pakai file asli", e);
            }

            // B. Upload Storage
            setProgressMap((prev) => ({ ...prev, [originalIndex]: 50 }));
            const fileNameClean = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
            const storagePath = `${eventId}/${Date.now()}_${fileNameClean}`;

            const { error: uploadError } = await supabase.storage
              .from("event-photos")
              .upload(storagePath, fileToUpload, {
                cacheControl: "3600",
                upsert: false,
              });

            if (uploadError) throw uploadError;

            // C. Get URL
            const { data: urlData } = supabase.storage
              .from("event-photos")
              .getPublicUrl(storagePath);

            // Push Data
            batchSuccessData.push({
              event_id: eventId,
              photographer_id: photographerId,
              file_name: file.name,
              file_path: storagePath,
              storage_url: urlData.publicUrl,
              image_url: urlData.publicUrl,
              file_size: fileToUpload.size,
              created_at: new Date().toISOString(),
              is_processed: false, // Penting: False biar nanti diambil indexing loop
            });

            setProgressMap((prev) => ({ ...prev, [originalIndex]: 90 }));
          } catch (error) {
            console.error(`Gagal: ${file.name}`, error);
            setProgressMap((prev) => ({ ...prev, [originalIndex]: -1 }));
          }
        });
      });

      // Tunggu 1 batch (8 foto) selesai semua
      await Promise.all(batchPromises);

      // Save Batch ke Database
      if (batchSuccessData.length > 0) {
        try {
          const res = await fetch("/api/photos/bulk-register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photos: batchSuccessData }),
          });

          if (!res.ok) throw new Error("Gagal DB");

          // Update progress jadi 100% (Centang hijau)
          currentBatch.forEach((file) => {
            const idx = selectedFiles.indexOf(file);
            if (progressMap[idx] !== -1) {
              setProgressMap((prev) => ({ ...prev, [idx]: 100 }));
            }
          });

          totalUploaded += batchSuccessData.length;
        } catch (err) {
          console.error("Batch DB Error", err);
        }
      }
    }

    // 4. SMART INDEXING LOOP (SETELAH SEMUA UPLOAD SELESAI)
    // Ini biar server gak timeout kalau upload 10k foto
    if (totalUploaded > 0) {
      setStatusLog("✅ Upload Selesai! AI akan memproses di background...");
    }

    setTimeout(() => {
      router.push(`/dashboard/events/${eventId}/manage`);
    }, 500);
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