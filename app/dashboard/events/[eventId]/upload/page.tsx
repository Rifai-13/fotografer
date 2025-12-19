"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import imageCompression from "browser-image-compression";
import pLimit from "p-limit"; // ✅ WAJIB IMPORT INI

// CONFIGURATION DEFAULT
const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.3, // Target compress ke 300KB
  maxWidthOrHeight: 1920,
  useWebWorker: true,
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

  // 🛠️ HELPER: Pecah array jadi chunks
  function chunkArray<T>(array: T[], size: number): T[][] {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
    }
    return result;
  }

  // 🚀 LOGIC ADAPTIVE UPLOAD
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

    // 1. TENTUKAN STRATEGI BERDASARKAN RATA-RATA SIZE FILE
    // Kita cek file pertama/rata-rata untuk menentukan mode
    const totalSize = selectedFiles.reduce((acc, file) => acc + file.size, 0);
    const avgSize = totalSize / selectedFiles.length;
    const isHeavyLoad = avgSize > 300 * 1024; // Di atas 300KB dianggap 'Berat'

    // KONFIGURASI DINAMIS
    const BATCH_SIZE = isHeavyLoad ? 5 : 30; // 5 foto kalau gede, 30 kalau kecil
    const CONCURRENCY = isHeavyLoad ? 5 : 30; // Limit koneksi bersamaan

    setStatusLog(
      isHeavyLoad
        ? `🐢 Mode High-Res Detected: Upload per ${BATCH_SIZE} file...`
        : `🐇 Mode Turbo: Upload per ${BATCH_SIZE} file...`
    );

    // Setup Limitasi Koneksi
    const limit = pLimit(CONCURRENCY);

    // 2. Pecah jadi Batch
    const fileChunks = chunkArray(selectedFiles, BATCH_SIZE);
    let totalUploaded = 0;

    // 3. Loop per Batch
    for (const [batchIndex, currentBatch] of fileChunks.entries()) {
      setStatusLog(
        `📦 Batch ${batchIndex + 1}/${fileChunks.length} (${
          isHeavyLoad ? "High-Res" : "Turbo"
        })...`
      );

      const batchSuccessData: any[] = [];

      // 4. Proses Upload dalam Batch (Concurrent tapi Terlimit)
      const batchPromises = currentBatch.map((file) => {
        return limit(async () => {
          const originalIndex = selectedFiles.indexOf(file);

          try {
            // A. KOMPRESI
            // Kita tetap coba kompres, kalau file sudah kecil dia lewat cepat
            setProgressMap((prev) => ({ ...prev, [originalIndex]: 10 }));

            let fileToUpload = file;
            try {
              // Selalu kompres agar hemat storage & bandwidth
              fileToUpload = await imageCompression(file, COMPRESSION_OPTIONS);
            } catch (e) {
              console.warn("Skip compress", e);
            }

            // B. UPLOAD
            setProgressMap((prev) => ({ ...prev, [originalIndex]: 40 }));
            const fileNameClean = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
            const storagePath = `${eventId}/${Date.now()}_${fileNameClean}`;

            const { error: uploadError } = await supabase.storage
              .from("event-photos")
              .upload(storagePath, fileToUpload, {
                cacheControl: "3600",
                upsert: false,
              });

            if (uploadError) throw uploadError;

            // C. URL
            const { data: urlData } = supabase.storage
              .from("event-photos")
              .getPublicUrl(storagePath);

            // Push data
            batchSuccessData.push({
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

            setProgressMap((prev) => ({ ...prev, [originalIndex]: 100 }));
          } catch (error) {
            console.error(`Gagal: ${file.name}`, error);
            setProgressMap((prev) => ({ ...prev, [originalIndex]: -1 }));
          }
        });
      });

      // Tunggu batch ini selesai (sesuai limit concurrency)
      await Promise.all(batchPromises);

      // 5. Simpan ke Database
      if (batchSuccessData.length > 0) {
        try {
          const res = await fetch("/api/photos/bulk-register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photos: batchSuccessData }),
          });

          if (!res.ok) throw new Error("Gagal DB");

          // 6. 🔥 TRIGGER AI (Fire & Forget)
          // Langsung colek AI, jangan ditunggu
          fetch("/api/index-faces", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId: eventId }),
          }).catch((err) => console.error("Auto-index trigger failed", err));

          totalUploaded += batchSuccessData.length;
        } catch (err) {
          console.error("Batch DB Error", err);
        }
      }
    }

    setUploading(false);
    setStatusLog("✅ Selesai!");
    alert(`Upload Selesai! ${totalUploaded} foto berhasil.`);

    setTimeout(() => {
      router.push(`/dashboard/events/${eventId}/manage`);
    }, 1500);
  };

  // --- UI PART ---
  if (!eventId) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Upload Foto</h1>
          <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            Auto-Adaptive Mode ⚡
          </div>
        </div>

        {/* ... INPUT FILE AREA (Copy dari code sebelumnya) ... */}
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

        {/* ... ACTION BAR & GRID PREVIEW (Copy dari code sebelumnya) ... */}
        {selectedFiles.length > 0 && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-4 border-b pb-2 sticky top-0 bg-white z-10">
              <span className="font-bold">{selectedFiles.length} Foto</span>
              {statusLog && (
                <span className="text-blue-600 text-sm animate-pulse">
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
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold"
                >
                  {uploading ? "Processing..." : "START UPLOAD"}
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
