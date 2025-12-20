"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";

export default function AIBackgroundWorker() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState("");
  const pathname = usePathname();
  
  // Gunakan Ref untuk mencegah double-execution
  const isLooping = useRef(false);

  useEffect(() => {
    // Hanya jalan di dashboard
    if (!pathname.includes("/dashboard")) return;

    const processQueue = async () => {
      // Ambil Event ID dari URL (biar prioritas ke event yang sedang dibuka admin)
      // Contoh URL: /dashboard/events/123/manage -> ambil 123
      const pathParts = pathname.split("/");
      const eventIndex = pathParts.indexOf("events");
      const currentEventId = (eventIndex !== -1 && pathParts[eventIndex + 1]) 
        ? pathParts[eventIndex + 1] 
        : null;

      // Jika tidak ada event specific, mungkin ambil random/terbaru (opsional)
      // Untuk sekarang kita wajibkan ada eventId agar aman
      if (!currentEventId) return;

      if (isProcessing) return;
      setIsProcessing(true);
      isLooping.current = true;

      try {
        setStatus("🚀 Turbo AI: Memproses 50 Foto...");
        
        const res = await fetch("/api/index-faces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId: currentEventId }),
        });

        const data = await res.json();

        if (data.processedCount > 0) {
          // 🔥 LOGIC RAKUS:
          // Kalau tadi berhasil proses foto, JANGAN ISTIRAHAT.
          // Langsung gas lagi detik itu juga!
          setStatus(`✅ ${data.processedCount} Selesai! Lanjut lagi...`);
          setIsProcessing(false);
          
          // Panggil diri sendiri lagi (Recursion)
          if (isLooping.current) {
             processQueue(); 
          }
        } else {
          // Kalau return 0, berarti sudah habis. Baru boleh istirahat.
          setStatus("✨ Semua foto event ini selesai!");
          setIsProcessing(false);
          isLooping.current = false;
          
          // Cek lagi nanti 5 detik kemudian (siapa tau ada upload baru)
          setTimeout(() => {
             if (pathname.includes("/dashboard")) processQueue();
          }, 5000);
        }

      } catch (error) {
        console.error("AI Worker Error:", error);
        setStatus("⚠️ Error, retrying...");
        setIsProcessing(false);
        // Kalau error, kasih napas 3 detik baru coba lagi
        setTimeout(() => {
            if (pathname.includes("/dashboard")) processQueue();
        }, 3000);
      }
    };

    // Trigger pertama kali
    const timer = setTimeout(processQueue, 1000);
    return () => {
        clearTimeout(timer);
        isLooping.current = false; // Stop loop kalau pindah halaman
    };

  }, [pathname]); // Re-run kalau pindah event

  if (!status) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900/90 text-white text-xs px-4 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-3 border border-gray-700 backdrop-blur-md">
      <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-green-400 animate-ping' : 'bg-gray-500'}`}></div>
      <span className="font-mono">{status}</span>
    </div>
  );
}