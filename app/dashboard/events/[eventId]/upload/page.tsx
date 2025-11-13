// app/dashboard/events/[eventId]/upload/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UploadPhotos({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  // Unwrap the params promise
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
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !eventId) return;

    setUploading(true);

    try {
      // Upload semua file secara paralel dengan progress tracking manual
      const uploadPromises = selectedFiles.map(async (file, index) => {
        // Generate unique file path
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random()
          .toString(36)
          .substring(2)}.${fileExt}`;
        const filePath = `${eventId}/${fileName}`;

        // Simulasi progress (karena Supabase tidak menyediakan onUploadProgress)
        const simulateProgress = () => {
          let progress = 0;
          const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress >= 90) {
              clearInterval(interval);
            } else {
              setUploadProgress((prev) => {
                const newProgress = [...prev];
                newProgress[index] = Math.min(progress, 90);
                return newProgress;
              });
            }
          }, 200);
          return interval;
        };

        const progressInterval = simulateProgress();

        try {
          // Upload ke Supabase Storage
          const { data: uploadData, error: uploadError } =
            await supabase.storage
              .from("event-photos") // Sesuai dengan nama bucket Anda
              .upload(filePath, file);

          if (uploadError) {
            console.error(`Upload error for ${file.name}:`, uploadError);
            throw new Error(
              `Failed to upload ${file.name}: ${uploadError.message}`
            );
          }

          // Set progress to 100% setelah upload berhasil
          setUploadProgress((prev) => {
            const newProgress = [...prev];
            newProgress[index] = 100;
            return newProgress;
          });

          // Dapatkan URL public untuk file yang diupload
          const { data: urlData } = supabase.storage
            .from("event-photos")
            .getPublicUrl(filePath);

          if (!urlData.publicUrl) {
            throw new Error(`Failed to get public URL for ${file.name}`);
          }

          // Dapatkan session untuk photographer_id
          const session = await supabase.auth.getSession();
          const photographerId = session.data.session?.user.id;

          // Catat foto ke database melalui API route
          const registerResponse = await fetch("/api/register-photo", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              storage_url: urlData.publicUrl,
              file_path: filePath,
              file_name: file.name,
              file_size: file.size,
              event_id: eventId,
              photographer_id: photographerId,
            }),
          });

          if (!registerResponse.ok) {
            const errorData = await registerResponse.json();
            throw new Error(
              `Failed to register photo ${file.name}: ${errorData.error}`
            );
          }

          return {
            fileName: file.name,
            success: true,
            publicUrl: urlData.publicUrl,
          };
        } catch (error) {
          clearInterval(progressInterval);
          throw error;
        }
      });

      // Tunggu semua upload selesai
      const results = await Promise.all(uploadPromises);

      console.log("All uploads completed:", results);

      // Redirect ke halaman kelola setelah semua upload selesai
      setTimeout(() => {
        router.push(`/dashboard/events/${eventId}/manage`);
      }, 1000);
    } catch (error) {
      console.error("Upload failed:", error);
      alert(
        `Upload gagal: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setUploadProgress((prev) => prev.filter((_, i) => i !== index));
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Tampilkan loading jika eventId belum tersedia
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
              className="text-gray-500 hover:text-gray-700"
            >
              ← Kembali
            </button>
          </div>

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
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition duration-200"
            >
              Pilih File
            </button>
          </div>

          {selectedFiles.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4">
                Foto yang akan diupload ({selectedFiles.length})
              </h2>

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

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setSelectedFiles([])}
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
          )}
        </div>
      </div>
    </div>
  );
}
