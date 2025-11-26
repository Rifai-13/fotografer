// app/dashboard/events/[eventId]/upload/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MAX_CONCURRENT_UPLOADS = 10;

export default function UploadPhotos({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number[]>([]);
  const [uploadResults, setUploadResults] = useState<
    Array<{
      fileName: string;
      success: boolean;
      facesIndexed?: number;
      message?: string;
    }>
  >([]);
  const [eventId, setEventId] = useState<string | null>(null);
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
      setUploadProgress((prev) => [
        ...prev,
        ...Array(filesArray.length).fill(0),
      ]);
      setUploadResults([]);
    }
  };

  // FUNGSI UTAMA UNTUK MEMPROSES SATU FILE
  const processSingleFile = async (
    file: File,
    index: number,
    photographerId: string,
    eventId: string
  ) => {
    try {
      console.log(
        `🔄 START Uploading ${index + 1}/${selectedFiles.length}: ${file.name}`
      );

      // 1️⃣ DAPATKAN SIGNED URL DARI API BARU
      setUploadProgress((prev) => {
        const newProgress = [...prev];
        newProgress[index] = 5;
        return newProgress;
      });

      const signedUrlResponse = await fetch("/api/get-signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          eventId: eventId,
        }),
      });

      const signedUrlResult = await signedUrlResponse.json();

      if (!signedUrlResponse.ok || !signedUrlResult.signedUrl) {
        throw new Error(
          signedUrlResult.error || "Gagal mendapatkan Signed URL dari server"
        );
      }

      const { signedUrl, file_path: storagePath } = signedUrlResult;

      setUploadProgress((prev) => {
        const newProgress = [...prev];
        newProgress[index] = 20;
        return newProgress;
      });

      // 2️⃣ DIRECT UPLOAD MENGGUNAKAN SIGNED URL (PUT Request)
      const directUploadResponse = await fetch(signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!directUploadResponse.ok) {
        const errorText = await directUploadResponse.text();
        throw new Error(
          `Direct Upload gagal (Status ${
            directUploadResponse.status
          }): ${errorText.substring(0, 100)}...`
        );
      }

      setUploadProgress((prev) => {
        const newProgress = [...prev];
        newProgress[index] = 75;
        return newProgress;
      });

      // 3️⃣ REGISTER METADATA FOTO
      const { data: urlData } = supabase.storage
        .from("event-photos")
        .getPublicUrl(storagePath);

      if (!urlData.publicUrl) {
        throw new Error("Gagal mendapatkan URL public");
      }

      const registerResponse = await fetch("/api/register-photo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          storage_url: urlData.publicUrl,
          file_path: storagePath,
          file_name: file.name,
          file_size: file.size,
          event_id: eventId,
          photographer_id: photographerId,
        }),
      });

      const registerResult = await registerResponse.json();

      if (!registerResponse.ok) {
        throw new Error(registerResult.error || "Gagal register photo");
      }

      setUploadProgress((prev) => {
        const newProgress = [...prev];
        newProgress[index] = 100;
        return newProgress;
      });

      return {
        fileName: file.name,
        success: true,
        facesIndexed: 0,
        message: registerResult.message,
      };
    } catch (error: any) {
      console.error(`❌ Upload gagal untuk ${file.name}:`, error);

      setUploadProgress((prev) => {
        const newProgress = [...prev];
        newProgress[index] = 100; // Tandai selesai (gagal)
        return newProgress;
      });

      return {
        fileName: file.name,
        success: false,
        message: error.message,
      };
    }
  };

  // 🚀 FUNGSI UTAMA DIRECT UPLOAD
  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !eventId) return;

    setUploading(true);
    setUploadResults([]);

    const session = await supabase.auth.getSession();
    const photographerId = session.data.session?.user.id;

    if (!photographerId) {
      setUploading(false);
      alert("❌ Photographer tidak terautentikasi. Silahkan login ulang.");
      return;
    }

    try {
      const filePromises: (() => Promise<any>)[] = [];
      const finalResults: any[] = [];

      // 1. Buat array Promise factories untuk setiap file
      selectedFiles.forEach((file, index) => {
        filePromises.push(() =>
          processSingleFile(file, index, photographerId, eventId)
        );
      });

      // 2. Kontrol konkurensi (Antrian)
      // 💡 FIX 1: Ubah tipe Promise menjadi Promise<any>[]
      const activePromises: Promise<any>[] = [];
      let promiseIndex = 0;

      const runNext = () => {
        if (promiseIndex >= filePromises.length) {
          return; // Semua pekerjaan sudah antri
        }

        const currentPromiseFactory = filePromises[promiseIndex++];
        const currentPromise = currentPromiseFactory()
          .then((result) => {
            finalResults.push(result);
            // 💡 FIX 2: Jangan gunakan .finally(), gunakan .then() untuk memastikan tipe Promise konsisten
          })
          .then(() => {
            // Setelah selesai (sukses/gagal), hapus dari daftar aktif
            const index = activePromises.indexOf(currentPromise);
            if (index !== -1) {
              activePromises.splice(index, 1);
            }
            // Mulai yang berikutnya
            runNext();
          });

        // Tambahkan ke daftar yang sedang aktif
        activePromises.push(currentPromise);
      };

      // 3. Mulai 10 upload pertama (atau sebanyak yang ada)
      for (
        let i = 0;
        i < MAX_CONCURRENT_UPLOADS && i < filePromises.length;
        i++
      ) {
        runNext();
      }

      // 4. Tunggu sampai semua janji selesai
      while (activePromises.length > 0 || promiseIndex < filePromises.length) {
        // 💡 FIX 3: Tambahkan penentuan tipe 'void' secara eksplisit pada resolve()
        const delayPromise = new Promise<void>((resolve) =>
          setTimeout(resolve, 50)
        );

        // Kita tunggu Promise.race dari semua yang aktif + delay promise
        // Menggunakan Promise<any> pada activePromises memastikan Promise.race tidak error
        await Promise.race(activePromises.concat(delayPromise));
      }
      setUploadResults(finalResults);

      const successfulUploads = finalResults.filter((r: any) => r.success);
      const totalSuccessful = successfulUploads.length;

      if (totalSuccessful > 0) {
        alert(
          `✅ ${totalSuccessful}/${selectedFiles.length} foto berhasil diupload\n💡 Processing wajah akan berjalan di background.`
        );
      } else {
        alert("❌ Semua upload gagal");
      }

      if (totalSuccessful > 0) {
        setTimeout(() => {
          router.push(`/dashboard/events/${eventId}/manage`);
        }, 2000);
      }
    } catch (error) {
      console.error("Upload process failed:", error);
      alert(
        `Upload process failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setUploading(false);
    }
  };
  // ❌ Hapus fungsi convertFileToBase64 di sini

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setUploadProgress((prev) => prev.filter((_, i) => i !== index));
    setUploadResults([]);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  if (!eventId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg
            className="animate-spin h-10 w-10 text-blue-600 mx-auto"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p className="mt-2 text-gray-600">Memuat halaman...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Upload Foto untuk Event</h1>
            <button
              onClick={() => router.back()}
              className="text-gray-500 hover:text-gray-700 py-2 px-4 rounded-md border border-gray-300"
            >
              Kembali
            </button>
          </div>

          {/* Upload Area */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-6">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept="image/*"
              className="hidden"
            />

            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>

            <p className="text-lg font-medium text-gray-700 mb-2">
              Pilih foto untuk diupload
            </p>
            <p className="text-gray-500 mb-4">
              Format yang didukung: JPG, PNG, JPEG (Maks. 10MB per foto)
            </p>

            <button
              onClick={triggerFileInput}
              disabled={uploading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition duration-200 disabled:opacity-50"
            >
              Pilih File
            </button>
          </div>

          {/* Upload Results */}
          {uploadResults.length > 0 && (
            <div className="mb-6 bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Hasil Upload:</h3>
              <div className="space-y-2">
                {uploadResults.map((result, index) => (
                  <div
                    key={index}
                    className={`flex justify-between items-center p-2 rounded ${
                      result.success
                        ? "bg-green-50 text-green-800"
                        : "bg-red-50 text-red-800"
                    }`}
                  >
                    <span className="text-sm">{result.fileName}</span>
                    <div className="text-xs">
                      {result.success ? (
                        <span>✅ Processing</span>
                      ) : (
                        <span>❌ Gagal</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedFiles.length > 0 && (
            <div className="mb-6 border-b pb-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">
                  Foto yang akan diupload ({selectedFiles.length})
                </h2>
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setSelectedFiles([]);
                      setUploadResults([]);
                    }}
                    disabled={uploading}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Batalkan Semua
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={uploading || selectedFiles.length === 0}
                    className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-md disabled:opacity-50 flex items-center"
                  >
                    {uploading ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Mengupload...
                      </>
                    ) : (
                      "Upload Semua"
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div className="mb-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="relative border rounded-lg overflow-hidden bg-gray-100"
                  >
                    <div className="aspect-square flex items-center justify-center">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="object-cover w-full h-full"
                      />
                    </div>

                    <div className="p-2">
                      <p className="text-sm font-medium truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>

                    {uploading && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gray-200 h-2">
                        <div
                          className="bg-blue-600 h-2 transition-all duration-300"
                          style={{ width: `${uploadProgress[index]}%` }}
                        ></div>
                      </div>
                    )}

                    <button
                      onClick={() => removeFile(index)}
                      disabled={uploading}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 disabled:opacity-50"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
