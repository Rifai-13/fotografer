// app/results/page.tsx - FIXED: TOMBOL DOWNLOAD SELALU MUNCUL
"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

// Interface untuk data hasil match
interface Match {
  photo_id: string;
  image_url: string;
  similarity: number;
  confidence: number;
}

// Komponen utama dibungkus Suspense agar aman di Next.js
export default function ResultsPageWrapper() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ResultsPageContent />
    </Suspense>
  );
}

// Komponen Loading terpisah
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 font-medium">Sedang memuat hasil...</p>
      </div>
    </div>
  );
}

function ResultsPageContent() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId");

  // Parse data matches dari URL
  useEffect(() => {
    const matchesParam = searchParams.get("matches");
    if (matchesParam) {
      try {
        const parsedMatches = JSON.parse(matchesParam);
        setMatches(parsedMatches);
      } catch (error) {
        console.error("Error parsing matches:", error);
      }
    }
  }, [searchParams]);

  // Fungsi Download Gambar
  const handleDownload = async (imageUrl: string, photoId: string) => {
    setDownloading(photoId);
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      // Nama file saat didownload
      link.download = `foto-${eventId?.slice(0, 5)}-${photoId.slice(0, 5)}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading image:", error);
      alert("Gagal mengunduh gambar. Silakan coba lagi.");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 font-sans">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/60 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-tr from-green-400 to-blue-500 p-2 rounded-xl shadow-sm">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                  Hasil Pencarian
                </h1>
                <p className="text-xs sm:text-sm text-gray-500">
                  Foto yang cocok dengan wajah Anda
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push(`/scan?eventId=${eventId || ""}`)}
              className="group bg-white hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-xl border border-gray-200 transition-all duration-200 flex items-center space-x-2 shadow-sm hover:shadow"
            >
              <svg
                className="w-4 h-4 group-hover:-translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              <span>Kembali</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content Results */}
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {matches.length === 0 ? (
          // Tampilan jika tidak ada hasil
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-12 border border-white/50 shadow-xl text-center max-w-2xl mx-auto">
            <div className="bg-gray-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <svg
                className="w-12 h-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              Tidak Ada Foto Ditemukan
            </h3>
            <p className="text-gray-600 mb-8 leading-relaxed">
              Kami tidak menemukan foto yang cocok dengan wajah Anda di event
              ini. Coba gunakan foto selfie dengan pencahayaan yang lebih baik.
            </p>
            <button
              onClick={() => router.push(`/scan?eventId=${eventId || ""}`)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-8 rounded-xl transition duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Coba Selfie Lagi
            </button>
          </div>
        ) : (
          // Tampilan jika ada hasil
          <>
            <div className="text-center mb-10">
              <div className="inline-block bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-bold mb-4 shadow-sm">
                🎉 Berhasil
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4 leading-tight">
                Ditemukan{" "}
                <span className="text-blue-600">{matches.length}</span> Foto
                Anda!
              </h2>
              <p className="text-gray-600 text-lg max-w-2xl mx-auto">
                Berikut adalah koleksi foto terbaik yang berhasil dikenali oleh
                AI
              </p>
            </div>

            {/* GRID FOTO */}
            <div
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
              style={{ gridAutoRows: "1fr" }}
            >
              {matches.map((match, index) => {
                let badgeColor = "bg-green-500";
                if (match.similarity < 95) badgeColor = "bg-yellow-500";
                if (match.similarity < 90) badgeColor = "bg-orange-500";

                return (
                  <div
                    key={match.photo_id}
                    className="relative aspect-square rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 group bg-gray-200"
                  >
                    {/* Gambar Utama */}
                    <Image
                      src={match.image_url}
                      alt={`Foto ${index + 1}`}
                      fill
                      sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                      className="object-cover transition-transform duration-500"
                      loading="lazy"
                    />

                    {/* Gradient Overlay (Selalu halus di bawah agar tombol terlihat) */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60"></div>

                    {/* Badge Persentase */}
                    <div
                      className={`absolute top-3 left-3 ${badgeColor} text-white text-[10px] sm:text-xs font-bold px-2 py-1 sm:px-3 sm:py-1.5 rounded-full shadow-sm backdrop-blur-sm bg-opacity-90 z-10`}
                    >
                      {match.similarity.toFixed(1)}% Match
                    </div>

                    {/* Tombol Download (SELALU MUNCUL) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(match.image_url, match.photo_id);
                      }}
                      disabled={downloading === match.photo_id}
                      className={`
                        absolute bottom-3 right-3 p-2 sm:p-3 rounded-full shadow-lg transition-all duration-200 z-10
                        ${
                          downloading === match.photo_id
                            ? "bg-gray-100 cursor-wait"
                            : "bg-white text-gray-700 hover:text-blue-600 active:scale-95"
                        }
                      `}
                      title="Download Foto"
                    >
                      {downloading === match.photo_id ? (
                        <svg
                          className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-blue-600"
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
                      ) : (
                        // Ikon Download
                        <svg
                          className="w-3 h-3 sm:w-4 sm:h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
