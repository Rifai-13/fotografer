"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function AIBackgroundWorker() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState("");
  const pathname = usePathname();

  // Kita cek setiap kali user pindah halaman, atau setiap 5 detik
  useEffect(() => {
    // Cek apakah kita ada di dalam dashboard admin
    if (!pathname.includes("/dashboard")) return;

    const processQueue = async () => {
      if (isProcessing) return; // Jangan jalan kalau lagi kerja

      try {
        // 1. Cek Event Aktif (Kita ambil dari LocalStorage atau Context, 
        // tapi cara paling gampang: Kita tembak API index secara global untuk semua event)
        // ATAU: Kita minta user proses event terakhir.
        
        // Agar simpel & powerful: Kita buat API index-faces bisa mendeteksi 
        // event mana yg punya foto unprocessed tanpa perlu kirim eventId.
        // TAPI, untuk sekarang kita ambil eventId dari URL jika ada.
        
        const eventId = pathname.split("/events/")[1]?.split("/")[0];
        if (!eventId) return;

        setIsProcessing(true);
        setStatus("🤖 AI sedang bekerja...");

        // Panggil API (Limit 50 dari backend tadi)
        const res = await fetch("/api/index-faces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId }),
        });

        const data = await res.json();

        if (data.processedCount > 0) {
          console.log(`[AI Worker] Berhasil memproses ${data.processedCount} foto.`);
          setStatus(`✅ ${data.processedCount} foto terindex...`);
          
          // Kalau masih ada yg diproses, panggil diri sendiri lagi setelah 1 detik
          setTimeout(() => {
             setIsProcessing(false); 
             processQueue(); 
          }, 1000);
        } else {
          // Kalau 0, berarti tugas selesai
          setStatus("");
          setIsProcessing(false);
        }

      } catch (error) {
        console.error("[AI Worker] Error:", error);
        setIsProcessing(false);
      }
    };

    // Jalankan pertama kali (kasih jeda 2 detik biar gak balapan sama load halaman)
    const timer = setTimeout(processQueue, 2000);
    return () => clearTimeout(timer);

  }, [pathname, isProcessing]); // Dependency: Tiap pindah halaman dia cek lagi

  // TAMPILAN KECIL DI POJOK KANAN BAWAH (Indikator)
  if (!isProcessing && !status) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white text-xs px-4 py-2 rounded-full shadow-lg z-50 flex items-center gap-2 animate-pulse">
      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
      {status || "AI Working..."}
    </div>
  );
}