"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";

export default function AIBackgroundWorker() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState("");
  const pathname = usePathname();
  
  const isLooping = useRef(false);

  useEffect(() => {
    // Jalankan worker jika di Dashboard Utama ATAU di halaman Manage Event
    const isDashboard = pathname === "/dashboard";
    const isManagePage = pathname.includes("/manage");

    if (!isDashboard && !isManagePage) return;

    const processQueue = async () => {
      // 1. Cek Mode: Specific Event atau Global?
      let currentEventId = null;
      
      if (isManagePage) {
        // Ambil ID dari URL: /dashboard/events/123/manage
        const pathParts = pathname.split("/");
        const eventIndex = pathParts.indexOf("events");
        currentEventId = (eventIndex !== -1 && pathParts[eventIndex + 1]) 
          ? pathParts[eventIndex + 1] 
          : null;
      }

      // Jika di Dashboard utama, currentEventId dibiarkan NULL (Global Mode)

      if (isProcessing) return;
      setIsProcessing(true);
      isLooping.current = true;

      try {
        const modeText = currentEventId ? "Fokus Event..." : "Mode Global 🌍";
        setStatus(`🚀 Turbo AI: ${modeText}`);
        
        const res = await fetch("/api/index-faces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            eventId: currentEventId // Kirim ID jika ada, atau null jika global
          }),
        });

        const data = await res.json();

        if (data.processedCount > 0) {
          setStatus(`✅ ${data.processedCount} Selesai! Lanjut lagi...`);
          setIsProcessing(false);
          
          if (isLooping.current) {
             processQueue(); // Gas lagi tanpa henti
          }
        } else {
          setStatus("✨ Antrian kosong. Istirahat.");
          setIsProcessing(false);
          isLooping.current = false;
          
          // Cek lagi 10 detik kemudian
          setTimeout(() => {
             // Cek path lagi sebelum restart (takutnya user dah pindah halaman)
             if (window.location.pathname.includes("/dashboard")) processQueue();
          }, 10000);
        }

      } catch (error) {
        console.error("AI Worker Error:", error);
        setStatus("⚠️ Error, retrying...");
        setIsProcessing(false);
        setTimeout(() => {
            if (window.location.pathname.includes("/dashboard")) processQueue();
        }, 5000);
      }
    };

    // Trigger pertama kali
    const timer = setTimeout(processQueue, 1000);
    return () => {
        clearTimeout(timer);
        isLooping.current = false;
    };

  }, [pathname]);

  if (!status) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900/90 text-white text-xs px-4 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-3 border border-gray-700 backdrop-blur-md transition-all duration-300 hover:scale-105 cursor-pointer">
      <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-green-400 animate-ping' : 'bg-gray-500'}`}></div>
      <span className="font-mono">{status}</span>
    </div>
  );
}