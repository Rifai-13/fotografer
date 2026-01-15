// app/scan/[eventId]/page.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

// Menggunakan nama interface EventItem secara konsisten
interface EventItem {
  id: string;
  name: string;
  description: string;
  date: string;
  location: string;
  status: string;
}

// Helper untuk mengubah Data URL (Base64) menjadi File object
const dataURLtoFile = (dataurl: string, filename: string) => {
  const arr = dataurl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

export default function ScanPage() {
  const params = useParams();
  const eventId = params.eventId as string; // Ambil eventId dari URL

  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const router = useRouter();
  const supabase = createClient();

  const loadEventDetails = async () => {
    if (!eventId) return;

    try {
      setLoading(true);
      setError(null);

      // Gunakan API endpoint publik untuk menghindari masalah RLS/Auth
      const response = await fetch(`/api/events/${eventId}`);
      const eventData = await response.json();

      if (!response.ok) {
        console.error("❌ Error fetching event:", eventData);
        setError("Event tidak ditemukan atau terjadi kesalahan.");
        return;
      }

      if (eventData.status !== "active") {
        setError("Event ini sedang tidak aktif.");
        return;
      }

      setEvent(eventData);
    } catch (err: any) {
      console.error("❌ Exception in loadEventDetails:", err);
      setError("Terjadi kesalahan saat memuat event: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    setCameraActive(false);
    setCameraLoading(false);
  }, [setCameraActive, setCameraLoading]);

  const startCamera = () => {
    if (!event) {
      setError("Data event belum dimuat.");
      return;
    }

    try {
      setError(null);
      setCameraLoading(true);

      if (streamRef.current) {
        stopCamera();
      }

      setCameraActive(true);
    } catch (err: any) {
      setError("Gagal memulai kamera: " + err.message);
      setCameraLoading(false);
    }
  };

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) {
      setError("Kamera tidak siap");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) {
      setError("Canvas context tidak tersedia");
      return;
    }

    try {
      console.log("📸 Capturing image...");

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw mirrored
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Reset transform
      context.setTransform(1, 0, 0, 1, 0, 0);

      const imageDataUrl = canvas.toDataURL("image/jpeg", 0.8);
      setCapturedImage(imageDataUrl);

      console.log("✅ Image captured successfully");
      stopCamera();
    } catch (err: any) {
      console.error("Error capturing image:", err);
      setError("Gagal mengambil foto: " + err.message);
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  const cancelCamera = () => {
    stopCamera();
    setCapturedImage(null);
  };

  // --- FUNGSI SEARCH PERBAIKAN ---
  const searchFaces = async () => {
    if (!capturedImage || !eventId) {
      setError("Tidak ada foto yang diambil atau ID event hilang");
      return;
    }

    try {
      setSearching(true);
      setError(null);

      const file = dataURLtoFile(capturedImage, "selfie.jpg");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("eventId", eventId); // Gunakan eventId dari URL

      const response = await fetch("/api/search-faces", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Gagal mencari wajah");
      }

      if (result.status === "NO_COLLECTION") {
        setError("Belum ada foto yang di-upload untuk event ini.");
        setSearching(false);
        return;
      }

      // Simpan hasil dan redirect
      if (result.matches && result.matches.length > 0) {
        localStorage.setItem("searchResults", JSON.stringify(result.matches));
        router.push(`/results?eventId=${eventId}`);
      } else {
        localStorage.setItem("searchResults", JSON.stringify([]));
        router.push(`/results?eventId=${eventId}`);
      }

    } catch (err: any) {
      console.error("❌ Search faces error:", err);
      setError("Gagal mencari foto: " + err.message);
    } finally {
      setSearching(false);
    }
  };
  // -------------------------------------

  useEffect(() => {
    if (eventId) {
      loadEventDetails();
    }
  }, [eventId]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (cameraActive) {
      const activateCamera = async () => {
        try {
          console.log("🔄 Starting camera...");

          const constraints = {
            video: {
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          };

          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          streamRef.current = stream;

          const video = videoRef.current;
          if (!video) {
            console.error("❌ Video ref not attached");
            setError("Elemen video tidak siap.");
            setCameraLoading(false);
            setCameraActive(false);
            return;
          }

          video.srcObject = stream;

          video.onloadedmetadata = () => {
            video
              .play()
              .then(() => {
                setCameraLoading(false);
              })
              .catch((playError) => {
                console.error("❌ Error playing video:", playError);
                setError("Gagal memulai kamera: " + playError.message);
                setCameraLoading(false);
                setCameraActive(false);
              });
          };

          video.onerror = () => {
            setError("Error pada video stream");
            setCameraLoading(false);
            setCameraActive(false);
          };
        } catch (err: any) {
          console.error("❌ Camera access error:", err);
          setCameraLoading(false);
          setCameraActive(false);

          if (err.name === "NotAllowedError") {
            setError(
              "Akses kamera ditolak. Silakan izinkan akses kamera untuk melanjutkan."
            );
          } else if (err.name === "NotFoundError") {
            setError("Kamera tidak ditemukan di perangkat ini.");
          } else {
            setError("Gagal mengakses kamera: " + err.message);
          }
        }
      };

      activateCamera();
    }
  }, [cameraActive]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r p-2 rounded-lg">
                <Image
                  src="/logo.png" 
                  alt="Logo Fotografer"
                  width={110}
                  height={50}
                  priority
                  className="w-auto h-auto"
                />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                  Cari Foto Anda
                </h1>
              </div>
            </div>
            <button
               // Bisa kembali ke home atau ke halaman lain
              onClick={() => router.push("/")}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition duration-200 flex items-center space-x-2"
            >
              <svg
                className="w-4 h-4"
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

      {/* Main Content */}
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 border border-white/80 shadow-sm">
          {/* Error Display */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 text-red-400 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Loading Display */}
          {loading && (
             <div className="text-center py-10">
                 <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
                 <p className="text-gray-500">Memuat info event...</p>
             </div>
          )}

          {!loading && event && (
             <>
                {/* Event Info Header */}
                <div className="text-center mb-8">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 mb-6 inline-block w-full max-w-2xl">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">{event.name}</h2>
                        <div className="flex items-center justify-center text-gray-600 space-x-4 text-sm sm:text-base">
                            <span className="flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                {new Date(event.date).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                            <span className="flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                {event.location}
                            </span>
                        </div>
                        {event.description && <p className="text-gray-500 mt-3 text-sm">{event.description}</p>}
                    </div>

                    <p className="text-gray-600 text-lg max-w-2xl mx-auto">
                    Ambil selfie untuk menemukan semua foto Anda di event ini.
                    </p>
                </div>

                {/* Camera Section */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-center sm:justify-start">
                        Ambil Selfie
                    </h3>

                    {/* Tombol Buka Kamera */}
                    {!cameraActive && !capturedImage && (
                        <div className="text-center py-8">
                        <div className="bg-gray-100 rounded-2xl p-8 mb-6 max-w-md mx-auto">
                            <p className="text-gray-600">
                            Kamera siap untuk mengambil selfie
                            </p>
                        </div>
                        <button
                            onClick={startCamera}
                            disabled={cameraLoading}
                            className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-bold py-3 px-8 rounded-xl text-lg transition duration-200 flex items-center justify-center space-x-3 mx-auto shadow-lg hover:shadow-xl hover:-translate-y-1"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            <span>{cameraLoading ? "Membuka Kamera..." : "Buka Kamera"}</span>
                        </button>
                        </div>
                    )}

                    {/* Tampilan Kamera Aktif */}
                    {cameraActive && !capturedImage && (
                        <div className="space-y-6">
                        <div className="relative bg-black rounded-2xl overflow-hidden max-w-md mx-auto aspect-[3/4] sm:aspect-video">
                            <video
                            ref={videoRef}
                            className="w-full h-full object-cover"
                            autoPlay
                            playsInline
                            muted
                            style={{ transform: "scaleX(-1)" }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-48 h-48 border-2 border-dashed border-white/70 rounded-full animate-pulse"></div>
                            </div>
                        </div>

                        <div className="flex flex-col items-center space-y-4">
                            {cameraLoading ? (
                            <div className="flex items-center space-x-2 text-gray-600">
                                <span>Menyiapkan kamera...</span>
                            </div>
                            ) : (
                            <div className="flex items-center space-x-3 sm:space-x-4">
                                <button
                                onClick={cancelCamera}
                                className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg"
                                >
                                Batal
                                </button>
                                <button
                                onClick={captureImage}
                                className="bg-white hover:bg-gray-100 border-4 border-red-500 w-16 h-16 rounded-full flex items-center justify-center shadow-lg transform active:scale-95 transition-all"
                                >
                                <div className="w-12 h-12 bg-red-500 rounded-full"></div>
                                </button>
                            </div>
                            )}
                        </div>
                        </div>
                    )}

                    {/* Tampilan Hasil Foto */}
                    {capturedImage && (
                        <div className="text-center space-y-6">
                        <div className="relative bg-black rounded-2xl overflow-hidden max-w-md mx-auto">
                            <img
                            src={capturedImage}
                            alt="Captured selfie"
                            className="w-full h-auto max-h-96 object-cover rounded-2xl"
                            />
                        </div>

                        <div className="flex justify-center space-x-3 sm:space-x-4">
                            <button
                            onClick={retakePhoto}
                            className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg"
                            >
                            Ambil Ulang
                            </button>
                            <button
                            onClick={searchFaces}
                            disabled={searching}
                            className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-bold py-2 px-6 rounded-lg flex items-center space-x-2 shadow-md hover:shadow-lg transition-all"
                            >
                            {searching ? (
                                <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                <span>Mencari...</span>
                                </>
                            ) : (
                                <span>Cari Foto Saya</span>
                            )}
                            </button>
                        </div>
                        </div>
                    )}

                    <canvas ref={canvasRef} className="hidden" />
                </div>
             </>
          )}

        </div>
      </div>
    </div>
  );
}
