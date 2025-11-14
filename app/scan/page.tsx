"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

// Type untuk event
interface Event {
  id: string;
  name: string;
  date: string;
  location: string;
  photo_count: number;
  status: string;
  created_at: string;
  actual_photo_count: number;
}

export default function ScanPage() {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCaptured, setIsCaptured] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string>("");
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();
  const supabase = createClient();
  const [setupStatus, setSetupStatus] = useState<
    "idle" | "setting_up" | "ready" | "error"
  >("idle");

  // Load events yang tersedia untuk public
  useEffect(() => {
    const loadPublicEvents = async () => {
      try {
        setIsLoadingEvents(true);

        // Fetch semua event yang memiliki foto (public access)
        const { data: eventsData, error: eventsError } = await supabase
          .from("events")
          .select(
            `
            *,
            photos:photos(count)
          `
          )
          .eq("status", "active")
          .order("created_at", { ascending: false });

        if (eventsError) {
          console.error("Error fetching events:", eventsError);
          await fetchEventsWithFallback();
          return;
        }

        // Transform data untuk mendapatkan actual_photo_count
        const transformedEvents = (eventsData || []).map((event: any) => ({
          id: event.id,
          name: event.name,
          date: event.date,
          location: event.location,
          photo_count: event.photo_count,
          status: event.status,
          created_at: event.created_at,
          actual_photo_count: event.photos?.[0]?.count || 0,
        }));

        // Filter hanya event yang memiliki foto
        const eventsWithPhotos = transformedEvents.filter(
          (event: Event) => event.actual_photo_count > 0
        );

        setEvents(eventsWithPhotos);

        // Auto-select first event dengan foto
        if (eventsWithPhotos.length > 0) {
          setSelectedEvent(eventsWithPhotos[0].id);
        }
      } catch (error) {
        console.error("Unexpected error:", error);
        toast.error("Terjadi kesalahan saat memuat event");
      } finally {
        setIsLoadingEvents(false);
      }
    };

    const fetchEventsWithFallback = async () => {
      try {
        const { data: eventsData, error: eventsError } = await supabase
          .from("events")
          .select("*")
          .eq("status", "active")
          .order("created_at", { ascending: false });

        if (eventsError) {
          throw eventsError;
        }

        const eventsWithCounts = await Promise.all(
          (eventsData || []).map(async (event: Event) => {
            const { count } = await supabase
              .from("photos")
              .select("*", { count: "exact", head: true })
              .eq("event_id", event.id);

            return {
              ...event,
              actual_photo_count: count || 0,
            };
          })
        );

        const eventsWithPhotos = eventsWithCounts.filter(
          (event: Event) => event.actual_photo_count > 0
        );
        setEvents(eventsWithPhotos);

        if (eventsWithPhotos.length > 0) {
          setSelectedEvent(eventsWithPhotos[0].id);
        }
      } catch (error) {
        console.error("Fallback also failed:", error);
        toast.error("Gagal memuat event");
        setEvents([]);
      }
    };

    loadPublicEvents();
  }, [supabase]);

  // Cleanup stream ketika komponen unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  const openCamera = async () => {
    if (!selectedEvent) {
      toast.error("Silakan pilih event terlebih dahulu!");
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      setStream(mediaStream);
      setIsCameraOpen(true);
      setIsCaptured(false);
      setCapturedImage("");
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast.error(
        "Tidak dapat mengakses kamera. Pastikan Anda memberikan izin akses kamera."
      );
    }
  };

  useEffect(() => {
    if (isCameraOpen && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [isCameraOpen, stream]);

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      // Set canvas size sesuai video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Gambar frame video ke canvas
      context?.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert canvas ke data URL untuk ditampilkan
      const imageDataUrl = canvas.toDataURL("image/jpeg", 0.8);
      setCapturedImage(imageDataUrl);

      // Stop kamera
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }

      setIsCaptured(true);
      setIsCameraOpen(false);

      console.log("Foto berhasil diambil dan ditampilkan");
    }
  };

  const retakePhoto = () => {
    setIsCaptured(false);
    setCapturedImage("");
    openCamera();
  };

  const searchFaces = async () => {
    if (!selectedEvent || !capturedImage) {
      toast.error("Silakan ambil foto terlebih dahulu");
      return;
    }

    setIsProcessing(true);
    setSetupStatus("idle");

    try {
      // Extract base64 data dari data URL
      const imageData = capturedImage.split(",")[1];

      // Step 1: Coba search faces
      const searchResponse = await fetch("/api/search-faces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId: selectedEvent,
          image: imageData,
          imageType: "JPEG",
        }),
      });

      const searchResult = await searchResponse.json();

      // Step 2: Jika collection belum ada, buat terlebih dahulu
      if (!searchResponse.ok && searchResult.code === "COLLECTION_NOT_FOUND") {
        setSetupStatus("setting_up");
        toast.loading("Mempersiapkan database wajah untuk event ini...");

        // Setup collection untuk event ini
        const setupResponse = await fetch(
          `/api/events/${selectedEvent}/setup-collection`,
          {
            method: "POST",
          }
        );

        const setupResult = await setupResponse.json();

        if (!setupResponse.ok) {
          setSetupStatus("error");
          toast.error("Gagal mempersiapkan system: " + setupResult.error);
          return;
        }

        setSetupStatus("ready");
        toast.success("Database wajah siap! Melanjutkan pencarian...");

        // Beri waktu sebentar untuk system stabil
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Step 3: Coba search lagi setelah setup
        const retryResponse = await fetch("/api/search-faces", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            eventId: selectedEvent,
            image: imageData,
            imageType: "JPEG",
          }),
        });

        const retryResult = await retryResponse.json();

        if (!retryResponse.ok) {
          throw new Error(
            retryResult.error || "Gagal memproses gambar setelah setup"
          );
        }

        // Handle hasil pencarian
        handleSearchResult(retryResult);
      } else if (!searchResponse.ok) {
        throw new Error(searchResult.error || "Gagal memproses gambar");
      } else {
        // Langsung berhasil tanpa perlu setup
        handleSearchResult(searchResult);
      }
    } catch (error) {
      console.error("Search error:", error);
      setSetupStatus("error");
      toast.error("Gagal mencari foto. Silakan coba lagi.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Fungsi terpisah untuk handle hasil pencarian
  const handleSearchResult = (result: any) => {
    if (result.matches && result.matches.length > 0) {
      toast.success(`Ditemukan ${result.matches.length} foto yang cocok!`);
      router.push(
        `/results?event=${selectedEvent}&matches=${encodeURIComponent(
          JSON.stringify(result.matches)
        )}`
      );
    } else {
      toast.warning(
        "Tidak ditemukan foto yang cocok. Coba foto dengan pencahayaan yang lebih baik."
      );
    }
  };

  const getSelectedEventData = (): Event | undefined => {
    return events.find((event: Event) => event.id === selectedEvent);
  };

  const formatPhotoCount = (count: number): string => {
    return count.toLocaleString("id-ID");
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 py-8">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <Link href="/" className="flex items-center space-x-2">
            <div className="text-2xl">📸</div>
            <span className="text-2xl font-bold text-gray-900">
              Foto<span className="text-blue-600">AI</span>
            </span>
          </Link>
        </header>

        <div className="max-w-2xl mx-auto">
          <Card className="border-0 shadow-lg">
            <CardHeader className="text-center space-y-1 pb-6">
              <CardTitle className="text-2xl font-bold text-gray-900">
                Cari Foto Anda dengan AI
              </CardTitle>
              <CardDescription className="text-gray-600">
                Gunakan teknologi face recognition untuk menemukan foto-foto
                Anda di event
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Event Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">
                  Pilih Event *
                </label>
                {isLoadingEvents ? (
                  <div className="flex items-center space-x-2 text-gray-500">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>Memuat event yang tersedia...</span>
                  </div>
                ) : events.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-4">📷</div>
                    <p className="mb-2">
                      Belum ada event dengan foto yang tersedia
                    </p>
                    <p className="text-sm mb-4">Silakan coba lagi nanti</p>
                  </div>
                ) : (
                  <Select
                    value={selectedEvent}
                    onValueChange={setSelectedEvent}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih event yang ingin Anda cari fotonya" />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map((event: Event) => (
                        <SelectItem key={event.id} value={event.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{event.name}</span>
                            <span className="text-sm text-gray-500">
                              {formatDate(event.date)} •{" "}
                              {formatPhotoCount(event.actual_photo_count)} foto
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {selectedEvent && getSelectedEventData() && (
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-blue-900 text-sm">
                          {getSelectedEventData()?.name}
                        </h4>
                        <p className="text-blue-700 text-xs mt-1">
                          📅 {formatDate(getSelectedEventData()?.date || "")} •
                          📍 {getSelectedEventData()?.location}
                        </p>
                        <p className="text-blue-700 text-xs">
                          📷{" "}
                          {formatPhotoCount(
                            getSelectedEventData()?.actual_photo_count || 0
                          )}{" "}
                          foto tersedia
                        </p>

                        {/* Status indicator */}
                        {setupStatus === "setting_up" && (
                          <p className="text-orange-600 text-xs mt-1 flex items-center">
                            <div className="w-3 h-3 border-2 border-orange-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                            Menyiapkan sistem AI...
                          </p>
                        )}
                        {setupStatus === "ready" && (
                          <p className="text-green-600 text-xs mt-1">
                            ✅ Sistem AI siap!
                          </p>
                        )}
                        {setupStatus === "error" && (
                          <p className="text-red-600 text-xs mt-1">
                            ❌ Gagal menyiapkan sistem
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Camera Section */}
              {events.length > 0 && (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700">
                    Ambil Foto Selfie untuk menemukan Foto Anda
                  </label>

                  <div className="relative bg-gray-100 rounded-xl overflow-hidden aspect-[4/3] flex items-center justify-center border-2 border-dashed border-gray-300">
                    {!isCameraOpen && !isCaptured ? (
                      // State awal - tombol buka kamera
                      <div className="text-center p-8">
                        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg
                            className="w-10 h-10 text-blue-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                        </div>
                        <p className="text-gray-600 mb-4">
                          {selectedEvent
                            ? "Ambil foto selfie untuk pencarian wajah dengan AI"
                            : "Pilih event terlebih dahulu"}
                        </p>
                        <Button
                          onClick={openCamera}
                          disabled={!selectedEvent}
                          className={`${
                            !selectedEvent
                              ? "bg-gray-400 cursor-not-allowed"
                              : "bg-blue-600 hover:bg-blue-700"
                          } text-white`}
                        >
                          {selectedEvent
                            ? "Buka Kamera"
                            : "Pilih Event Terlebih Dahulu"}
                        </Button>
                      </div>
                    ) : isCameraOpen ? (
                      // State kamera aktif
                      <>
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                        />
                        {/* Overlay panduan */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-48 h-48 border-2 border-white border-dashed rounded-full"></div>
                        </div>
                        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                          <Button
                            onClick={captureImage}
                            className="bg-red-500 hover:bg-red-600 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                              className="w-2xl h-2xl"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15.5a2.25 2.25 0 002.25-2.25V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.24a2.25 2.25 0 00-1.664-.894H8.865c-.723 0-1.342.434-1.664.90l-.822 1.239z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15.75 10.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                              />
                            </svg>
                            {/* <div className="w-12 h-12 bg-white rounded-full"></div> */}
                          </Button>
                        </div>
                      </>
                    ) : (
                      // State foto sudah diambil
                      <>
                        <img
                          src={capturedImage}
                          alt="Foto yang diambil"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-4">
                          <Button
                            onClick={retakePhoto}
                            variant="outline"
                            className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300"
                            disabled={isProcessing}
                          >
                            Ambil Ulang
                          </Button>
                          <Button
                            onClick={searchFaces}
                            disabled={isProcessing}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            {isProcessing ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                Mencari...
                              </>
                            ) : (
                              "Cari dengan AI"
                            )}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Canvas hidden untuk processing */}
                  <canvas ref={canvasRef} className="hidden" />
                </div>
              )}

              {/* AI Features Info */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-2">
                  Teknologi AI yang Digunakan:
                </h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>
                    • <strong>AWS Rekognition</strong> - Face recognition
                    technology
                  </li>
                  <li>• Pencarian wajah dengan akurasi tinggi</li>
                  <li>• Bisa menemukan wajah Anda di foto grup</li>
                  <li>• Mendeteksi wajah dari berbagai angle</li>
                  <li>• Proses pencarian aman dan privat</li>
                </ul>
              </div>

              {/* Instructions */}
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <h3 className="font-semibold text-green-900 mb-2">
                  Tips untuk Hasil Terbaik:
                </h3>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Pastikan wajah terlihat jelas dan tidak tertutup</li>
                  <li>• Pencahayaan yang baik tanpa bayangan</li>
                  <li>• Pandangan lurus ke kamera</li>
                  <li>• Ekspresi wajah natural</li>
                  <li>• Hindari topi atau kacamata hitam</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
