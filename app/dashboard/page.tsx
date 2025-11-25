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
}

interface Photo {
  id: string;
  image_url: string;
  file_path: string;
  file_name: string;
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
  });
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    event: Event | null;
  }>({
    isOpen: false,
    event: null,
  });
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkAuthAndFetchData();
  }, []);

  const checkAuthAndFetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check session dan user
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("Session error:", sessionError);
        setError("Error checking authentication");
        return;
      }

      if (!session) {
        router.push("/auth/login");
        return;
      }

      setUser(session.user as User);

      // Fetch events dan storage stats
      await Promise.all([fetchEvents(), fetchStorageStats()]);
    } catch (err) {
      console.error("Error in checkAuthAndFetchData:", err);
      setError("Terjadi kesalahan saat memuat data");
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select("*, photos(count)")
        .order("created_at", { ascending: false });

      if (eventsError) {
        console.error("Error fetching events:", eventsError);
        setError(`Gagal memuat events: ${eventsError.message}`);
        return;
      }

      const formattedEvents = eventsData.map((event) => {
        const countData = event.photos as unknown as [{ count: number }];
        const liveCount = countData?.[0]?.count || 0;

        return {
          ...event,
          photo_count: liveCount,
        };
      });

      setEvents(formattedEvents || []);
    } catch (err) {
      console.error("Exception in fetchEvents:", err);
      setError("Terjadi kesalahan saat memuat events");
    }
  };

  const fetchStorageStats = async () => {
    try {
      // Get all photos to calculate total file size
      const { data: photos, error: photosError } = await supabase
        .from("photos")
        .select("file_size");

      if (photosError) {
        console.error("Error fetching photos for storage stats:", photosError);
        return;
      }

      const totalUsage =
        photos?.reduce((sum, photo) => sum + (photo.file_size || 0), 0) || 0;
      const totalFiles = photos?.length || 0;

      // Calculate usage percentage (assuming 1GB free tier)
      const storageLimit = 1 * 1024 * 1024 * 1024; // 1GB in bytes
      const usagePercentage = Math.min((totalUsage / storageLimit) * 100, 100);

      setStorageStats({
        totalUsage,
        totalFiles,
        usagePercentage,
      });
    } catch (err) {
      console.error("Error fetching storage stats:", err);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleCreateEvent = () => {
    router.push("/dashboard/events/create");
  };

  const handleManageEvent = (eventId: string) => {
    router.push(`/dashboard/events/${eventId}/manage`);
  };

  const handleUploadPhotos = (eventId: string) => {
    router.push(`/dashboard/events/${eventId}/upload`);
  };

  const handleDeleteEvent = (event: Event) => {
    setDeleteModal({ isOpen: true, event });
  };

  const confirmDeleteEvent = async () => {
    if (!deleteModal.event) return;

    try {
      setDeleting(true);

      const eventId = deleteModal.event.id;
      const eventName = deleteModal.event.name;

      console.log(`Starting deletion process for event: ${eventName}`);

      // 1. First, get all photos associated with this event
      const { data: photos, error: photosError } = await supabase
        .from("photos")
        .select("id, image_url, file_path, file_name")
        .eq("event_id", eventId);

      if (photosError) {
        console.error("Error fetching photos for deletion:", photosError);
        throw new Error("Gagal mengambil data foto");
      }

      console.log(`Found ${photos?.length || 0} photos to delete`);

      // 2. Delete photos from storage if they exist
      if (photos && photos.length > 0) {
        const filePaths = photos
          .map((photo) => photo.file_path)
          .filter(Boolean)
          .filter((path) => path.startsWith("events/"));

        if (filePaths.length > 0) {
          const { data: deleteResult, error: storageError } =
            await supabase.storage.from("event-photos").remove(filePaths);

          if (storageError) {
            console.error("Error deleting photos from storage:", storageError);
            console.error("Storage error details:", {
              message: storageError.message,
              name: storageError.name,
              stack: storageError.stack,
            });
          } else {
            console.log("Successfully deleted from storage:", deleteResult);
          }
        } else {
          console.log("No valid file paths found for storage deletion");
        }

        // 3. Also try to extract file names from image_url and delete them
        const urlFileNames = photos
          .map((photo) => {
            // Extract file name from URL
            const url = photo.image_url;
            if (url) {
              const matches = url.match(/\/([^\/?]+)\?/);
              return matches ? matches[1] : null;
            }
            return null;
          })
          .filter(Boolean)
          .map((fileName) => `events/${eventId}/${fileName}`);

        console.log("File names extracted from URLs:", urlFileNames);

        if (urlFileNames.length > 0) {
          const { data: urlDeleteResult, error: urlStorageError } =
            await supabase.storage.from("event-photos").remove(urlFileNames);

          if (urlStorageError) {
            console.error(
              "Error deleting photos from storage using URL names:",
              urlStorageError
            );
          } else {
            console.log(
              "Successfully deleted from storage using URL names:",
              urlDeleteResult
            );
          }
        }
      }

      // 4. Delete photos from database
      const { error: deletePhotosError } = await supabase
        .from("photos")
        .delete()
        .eq("event_id", eventId);

      if (deletePhotosError) {
        console.error(
          "Error deleting photos from database:",
          deletePhotosError
        );
        throw new Error("Gagal menghapus foto dari database");
      }

      console.log("Successfully deleted photos from database");

      // 5. Finally delete the event
      const { error: deleteEventError } = await supabase
        .from("events")
        .delete()
        .eq("id", eventId);

      if (deleteEventError) {
        console.error("Error deleting event:", deleteEventError);
        throw new Error("Gagal menghapus event");
      }

      console.log("Successfully deleted event from database");

      // 6. Update local state
      setEvents((prev) => prev.filter((event) => event.id !== eventId));

      // 7. Refresh storage stats
      await fetchStorageStats();

      // 8. Close modal and show success
      setDeleteModal({ isOpen: false, event: null });

      // Show success message
      alert(
        `Event "${eventName}" berhasil dihapus! ${
          photos?.length || 0
        } foto telah dihapus dari storage.`
      );
    } catch (err: any) {
      console.error("Error in delete event:", err);
      alert(err.message || "Terjadi kesalahan saat menghapus event");
    } finally {
      setDeleting(false);
    }
  };

  const cancelDeleteEvent = () => {
    setDeleteModal({ isOpen: false, event: null });
  };

  const getUserName = () => {
    if (!user) return "Pengguna";
    return (
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Pengguna"
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg mb-4 max-w-md">
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
          <button
            onClick={checkAuthAndFetchData}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition duration-200"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && deleteModal.event && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-auto shadow-xl">
            <div className="text-center">
              {/* Warning Icon */}
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>

              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Hapus Event?
              </h3>

              <p className="text-gray-600 mb-4">
                Apakah Anda yakin ingin menghapus event{" "}
                <strong>"{deleteModal.event.name}"</strong>? Semua foto yang
                sudah diupload untuk event ini akan terhapus permanen dan tidak
                dapat dikembalikan.
              </p>

              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <div className="flex items-start space-x-2">
                  <svg
                    className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                  <p className="text-sm text-red-700">
                    <strong>Peringatan:</strong> Tindakan ini tidak dapat
                    dibatalkan. {deleteModal.event.photo_count || 0} foto akan
                    dihapus permanen dari storage.
                  </p>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={cancelDeleteEvent}
                  disabled={deleting}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={confirmDeleteEvent}
                  disabled={deleting}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {deleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Menghapus...</span>
                    </>
                  ) : (
                    <>
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      <span>Hapus</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <Link href="/dashboard " className="flex items-center space-x-2">
                <Image
                  src="/logo.png"
                  alt="Logo Fotografer"
                  width={110}
                  height={50}
                  priority
                />
              </Link>
              <div className="border-l border-gray-300 pl-3 hidden sm:block">
                <p className="text-l text-gray-600 font-medium">
                  Platform Management Foto Event
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Halo,</p>
                <p className="font-semibold text-gray-900">{getUserName()}</p>
              </div>
              <button
                onClick={handleLogout}
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
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/80 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Selamat datang, {getUserName()}! 👋
            </h2>
            <p className="text-gray-600">
              Kelola event dan foto-foto Anda dengan mudah dalam satu platform.
            </p>
          </div>
        </div>

        {/* Stats & Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Storage Usage Card */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Storage Used</p>
                <p className="text-2xl font-bold">
                  {formatFileSize(storageStats.totalUsage)}
                </p>
                <p className="text-blue-100 text-xs mt-1">
                  {storageStats.totalFiles} files •{" "}
                  {storageStats.usagePercentage.toFixed(1)}% used
                </p>
              </div>
              <div className="bg-white/20 p-3 rounded-xl">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                  />
                </svg>
              </div>
            </div>
            {/* Progress Bar */}
            <div className="mt-4 w-full bg-white/20 rounded-full h-2">
              <div
                className="bg-white h-2 rounded-full transition-all duration-300"
                style={{ width: `${storageStats.usagePercentage}%` }}
              ></div>
            </div>
          </div>

          {/* Total Events Card */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Total Events</p>
                <p className="text-3xl font-bold">{events.length}</p>
                <p className="text-green-100 text-xs mt-1">
                  {events.filter((e) => e.status === "active").length} active
                </p>
              </div>
              <div className="bg-white/20 p-3 rounded-xl">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Create Event Card */}
          <button
            onClick={handleCreateEvent}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-2xl p-6 shadow-lg transition duration-200 transform hover:scale-105"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Buat Event Baru</p>
                <p className="text-xl font-bold">+ Event Baru</p>
              </div>
              <div className="bg-white/20 p-3 rounded-xl">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
            </div>
          </button>
        </div>

        {/* Events Section */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/80 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Events Anda</h2>
            <div className="text-sm text-gray-600">
              {events.length} event ditemukan
            </div>
          </div>

          {events.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-gradient-to-br from-gray-100 to-gray-200 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-10 h-10 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Belum ada event
              </h3>
              <p className="text-gray-600 mb-6 max-w-sm mx-auto">
                Mulai dengan membuat event pertama Anda untuk mengelola
                foto-foto event.
              </p>
              <button
                onClick={handleCreateEvent}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium py-3 px-6 rounded-lg transition duration-200 inline-flex items-center space-x-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span>Buat Event Pertama</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event, index) => (
                <div
                  key={event.id}
                  className="bg-white rounded-xl border border-gray-200/80 shadow-sm hover:shadow-md transition duration-200 overflow-hidden group relative"
                >
                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteEvent(event)}
                    className="absolute top-3 right-3 bg-white/80 hover:bg-red-500 text-gray-400 hover:text-white p-1.5 rounded-lg transition duration-200 opacity-0 group-hover:opacity-100"
                    title="Hapus Event"
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
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>

                  <div className="p-5">
                    {/* Event Header */}
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-bold text-gray-900 text-lg group-hover:text-blue-600 transition duration-200 line-clamp-1 pr-8">
                        {event.name}
                      </h3>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          event.status === "active"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {event.status === "active" ? "🟢 Aktif" : "⚫ Nonaktif"}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                      {event.description || "Tidak ada deskripsi"}
                    </p>

                    {/* Event Details */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <svg
                          className="w-4 h-4 mr-2 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        {new Date(event.date).toLocaleDateString("id-ID", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <svg
                          className="w-4 h-4 mr-2 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span className="line-clamp-1">{event.location}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <svg
                          className="w-4 h-4 mr-2 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        {event.photo_count || 0} foto
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleManageEvent(event.id)}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-3 rounded-lg text-sm transition duration-200 flex items-center justify-center space-x-1"
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
                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span>Kelola</span>
                      </button>
                      <button
                        onClick={() => handleUploadPhotos(event.id)}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-3 rounded-lg text-sm transition duration-200 flex items-center justify-center space-x-1"
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
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                        <span>Upload</span>
                      </button>
                    </div>
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
