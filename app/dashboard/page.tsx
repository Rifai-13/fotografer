// app/dashboard/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import Image from "next/image";

interface Event {
  id: string;
  name: string;
  description: string;
  date: string;
  location: string;
  status: string;
  photo_count: number;
  processed_count: number;
  created_at: string;
}

interface User {
  id: string;
  email: string;
  user_metadata: {
    full_name?: string;
    name?: string;
  };
}

interface StorageStats {
  totalUsage: number;
  totalFiles: number;
  usagePercentage: number;
  limitGb: number;
}

export default function DashboardPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storageStats, setStorageStats] = useState<StorageStats>({
    totalUsage: 0,
    totalFiles: 0,
    usagePercentage: 0,
    limitGb: 100,
  });

  // --- STATE MODALS ---
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; event: Event | null }>({ isOpen: false, event: null });
  const [updateModal, setUpdateModal] = useState<{ isOpen: boolean; event: Event | null }>({ isOpen: false, event: null });
  const [updateFormData, setUpdateFormData] = useState({ name: "", description: "", date: "", location: "" });
  
  const [deleting, setDeleting] = useState(false);
  const [updating, setUpdating] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkAuthAndFetchData();
    const interval = setInterval(() => {
        fetchEvents();
        fetchStorageStats();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (updateModal.event) {
      setUpdateFormData({
        name: updateModal.event.name,
        description: updateModal.event.description || "",
        date: updateModal.event.date,
        location: updateModal.event.location,
      });
    }
  }, [updateModal.event]);

  const checkAuthAndFetchData = async () => {
    try {
      setLoading(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) { router.push("/auth/login"); return; }
      setUser(session.user as User);
      await Promise.all([fetchEvents(), fetchStorageStats()]);
    } catch (err) { console.error(err); setError("Gagal memuat data"); } 
    finally { setLoading(false); }
  };

  const fetchEvents = async () => {
    try {
      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select("*, photos(count)")
        .order("created_at", { ascending: false });

      if (eventsError) throw eventsError;

      const formattedEvents = await Promise.all(eventsData.map(async (event) => {
        const photosData = event.photos as unknown as { count: number }[];
        const totalPhotos = photosData?.[0]?.count ?? 0;
        const { count: processedCount } = await supabase.from("photos").select("id", { count: 'exact', head: true }).eq("event_id", event.id).eq("is_processed", true);
        return { ...event, photo_count: totalPhotos, processed_count: processedCount || 0 };
      }));
      setEvents(formattedEvents || []);
    } catch (err) { console.error(err); }
  };

  const fetchStorageStats = async () => {
    try {
      const { data, error } = await supabase.rpc("get_storage_stats");
      if (error) return;
      const stats = data as { totalBytes: number; totalFiles: number };
      setStorageStats({
        totalUsage: stats.totalBytes || 0,
        totalFiles: stats.totalFiles || 0,
        usagePercentage: ((stats.totalBytes || 0) / (100 * 1024 * 1024 * 1024)) * 100,
        limitGb: 100,
      });
    } catch (err) { console.error(err); }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.push("/"); };
  const handleCreateEvent = () => router.push("/dashboard/events/create");
  const handleManageEvent = (id: string) => router.push(`/dashboard/events/${id}/manage`);
  const handleUploadPhotos = (id: string) => router.push(`/dashboard/events/${id}/upload`);
  
  const handleDeleteEvent = (event: Event) => setDeleteModal({ isOpen: true, event });
  const cancelDeleteEvent = () => setDeleteModal({ isOpen: false, event: null });
  const confirmDeleteEvent = async () => { 
     if (!deleteModal.event) return;
     if (!window.confirm(`Hapus event "${deleteModal.event.name}"?`)) return;
     try {
       setDeleting(true);
       await fetch("/api/photos/delete-full", { method: "DELETE", body: JSON.stringify({ eventId: deleteModal.event.id }) });
       setEvents(p => p.filter(e => e.id !== deleteModal.event?.id));
       await fetchStorageStats();
       setDeleteModal({ isOpen: false, event: null });
       alert("Event terhapus");
     } catch(e) { alert("Gagal hapus"); } finally { setDeleting(false); }
  };
  
  const handleEditClick = (event: Event) => setUpdateModal({ isOpen: true, event });
  const handleUpdateChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setUpdateFormData({...updateFormData, [e.target.name]: e.target.value});
  const handleUpdateSubmit = async (e: React.FormEvent) => { 
     e.preventDefault();
     if (!updateModal.event) return;
     setUpdating(true);
     try {
        await supabase.from("events").update(updateFormData).eq("id", updateModal.event.id);
        await fetchEvents();
        setUpdateModal({ isOpen: false, event: null });
        alert("Update Berhasil");
     } catch(e) { alert("Gagal update"); } finally { setUpdating(false); }
  };

  const getUserName = () => user?.user_metadata?.full_name || "Pengguna";

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      
      {/* MODAL DELETE */}
      {deleteModal.isOpen && deleteModal.event && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl text-center">
              <h3 className="text-lg font-bold mb-2">Hapus Event?</h3>
              <p className="text-gray-600 mb-4">Hapus <b>{deleteModal.event.name}</b>?</p>
              <div className="flex gap-3">
                 <button onClick={cancelDeleteEvent} className="flex-1 bg-gray-100 py-2 rounded-lg">Batal</button>
                 <button onClick={confirmDeleteEvent} className="flex-1 bg-red-600 text-white py-2 rounded-lg">{deleting ? "..." : "Hapus"}</button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL UPDATE */}
      {updateModal.isOpen && updateModal.event && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-2xl max-w-2xl w-full p-8 shadow-xl">
              <h3 className="text-2xl font-bold text-blue-900 mb-4 text-center">Update Event</h3>
              <form onSubmit={handleUpdateSubmit} className="space-y-4">
                 <input type="text" name="name" value={updateFormData.name} onChange={handleUpdateChange} className="w-full border rounded-lg p-2" required placeholder="Nama" />
                 <textarea name="description" value={updateFormData.description} onChange={handleUpdateChange} className="w-full border rounded-lg p-2" rows={3} placeholder="Deskripsi" />
                 <div className="grid grid-cols-2 gap-4">
                    <input type="date" name="date" value={updateFormData.date} onChange={handleUpdateChange} className="w-full border rounded-lg p-2" required />
                    <input type="text" name="location" value={updateFormData.location} onChange={handleUpdateChange} className="w-full border rounded-lg p-2" required placeholder="Lokasi" />
                 </div>
                 <div className="flex gap-4 mt-6">
                    <button type="button" onClick={() => setUpdateModal({isOpen: false, event: null})} className="flex-1 border py-2 rounded-lg">Batal</button>
                    <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg">{updating ? "..." : "Simpan"}</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-3">
                <Link href="/dashboard"><Image src="/logo.png" alt="Logo" width={110} height={50} priority /></Link>
                <div className="hidden sm:block border-l pl-3 text-gray-600 font-medium">Platform Management Foto</div>
            </div>
            <div className="flex items-center space-x-4">
                <div className="text-right">
                    <p className="text-sm text-gray-600">Halo,</p>
                    <p className="font-semibold">{getUserName()}</p>
                </div>
                <button onClick={handleLogout} className="bg-gray-100 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">Logout</button>
            </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
           {/* Storage Card (FIXED: FILE COUNT ADDED) */}
           <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl p-6 shadow-lg">
              <p className="text-blue-100 text-sm">Storage Used</p>
              <div className="flex items-baseline space-x-1 mt-1">
                 <p className="text-2xl font-bold">{formatFileSize(storageStats.totalUsage)}</p>
                 <span className="text-blue-200 text-sm">/ {storageStats.limitGb} GB</span>
              </div>
              
              {/* Ini yang saya kembalikan: Jumlah Files */}
              <p className="text-blue-100 text-xs mt-1">
                 {storageStats.totalFiles.toLocaleString()} files • {storageStats.usagePercentage.toFixed(1)}% used
              </p>

              <div className="mt-4 w-full bg-black/20 rounded-full h-2 overflow-hidden">
                 <div className={`h-2 rounded-full transition-all duration-500 ${storageStats.usagePercentage > 100 ? "bg-red-400" : "bg-white"}`} style={{ width: `${Math.min(storageStats.usagePercentage, 100)}%` }}></div>
              </div>
           </div>

           <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl p-6 shadow-lg">
              <p className="text-green-100 text-sm">Total Events</p>
              <p className="text-3xl font-bold">{events.length}</p>
              <p className="text-green-100 text-xs mt-1">{events.filter((e) => e.status === "active").length} active</p>
           </div>
           
           <button onClick={handleCreateEvent} className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl p-6 shadow-lg hover:scale-105 transition-transform text-left">
              <p className="text-purple-100 text-sm">Buat Event Baru</p>
              <p className="text-xl font-bold">+ Event Baru</p>
           </button>
        </div>

        {/* Events Grid */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/80 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Events Anda</h2>

          {events.length === 0 ? (
             <div className="text-center py-12 text-gray-500">Belum ada event.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => (
                <div key={event.id} className="bg-white rounded-xl border border-gray-200/80 shadow-sm hover:shadow-md transition duration-200 overflow-hidden group relative p-5">
                    
                    {/* Action Icons (FIXED: HORIZONTAL ALIGNMENT) */}
                    <div className="absolute top-3 right-3 flex flex-row gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button onClick={(e) => { e.stopPropagation(); handleEditClick(event); }} className="bg-white hover:bg-blue-100 text-blue-600 p-1.5 rounded-lg shadow-sm border border-gray-200" title="Edit">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={() => handleDeleteEvent(event)} className="bg-white hover:bg-red-100 text-red-600 p-1.5 rounded-lg shadow-sm border border-gray-200" title="Hapus">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>

                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-bold text-gray-900 text-lg line-clamp-1 pr-16">{event.name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${event.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                        {event.status === "active" ? "Aktif" : "Nonaktif"}
                      </span>
                    </div>

                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">{event.description || "-"}</p>

                    <div className="space-y-2 mb-4 text-sm text-gray-600">
                      {/* Tanggal */}
                      <div className="flex items-center">
                          <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          {new Date(event.date).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })}
                      </div>
                      
                      {/* Lokasi */}
                      <div className="flex items-center">
                          <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          <span className="line-clamp-1">{event.location}</span>
                      </div>

                      {/* Jumlah Foto & Status AI (FIXED: ALIGNMENT SEJAJAR) */}
                      <div className="flex items-center flex-wrap gap-2">
                        {/* Icon & Jumlah Foto */}
                        <div className="flex items-center">
                            <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            <span>{event.photo_count} foto</span>
                        </div>
                        
                        {/* Status AI (Sebaris di sebelah kanan jumlah foto) */}
                        {event.photo_count > 0 && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                                event.processed_count === event.photo_count 
                                ? "bg-green-50 text-green-700 border-green-200" 
                                : "bg-blue-50 text-blue-700 border-blue-200 animate-pulse"
                            }`}>
                                {event.processed_count === event.photo_count ? (
                                    "✅ Terindex"
                                ) : (
                                    `⚡ AI: ${event.processed_count}`
                                )}
                            </span>
                        )}
                      </div>
                    </div>

                    <div className="flex space-x-2 mt-auto">
                      <button onClick={() => handleManageEvent(event.id)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 rounded-lg text-sm">Kelola</button>
                      <button onClick={() => handleUploadPhotos(event.id)} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 rounded-lg text-sm">Upload</button>
                    </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}