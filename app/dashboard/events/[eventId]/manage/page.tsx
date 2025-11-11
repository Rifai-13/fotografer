// app/dashboard/events/[eventId]/manage/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Photo {
  id: string;
  url: string;
  filename: string;
  uploadedAt: string;
  size: number;
}

export default function ManagePhotos({ params }: { params: { eventId: string } }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const router = useRouter();

  // Fetch photos from API
  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        // Ganti dengan API call sebenarnya
        const response = await fetch(`/api/events/${params.eventId}/photos`);
        const data = await response.json();
        setPhotos(data.photos || []);
      } catch (error) {
        console.error('Failed to fetch photos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPhotos();
  }, [params.eventId]);

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotos(prev => 
      prev.includes(photoId) 
        ? prev.filter(id => id !== photoId)
        : [...prev, photoId]
    );
  };

  const selectAllPhotos = () => {
    if (selectedPhotos.length === photos.length) {
      setSelectedPhotos([]);
    } else {
      setSelectedPhotos(photos.map(photo => photo.id));
    }
  };

  const handleDelete = async () => {
    try {
      // Ganti dengan API call sebenarnya
      await fetch('/api/photos/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ photoIds: selectedPhotos }),
      });
      
      // Remove deleted photos from state
      setPhotos(prev => prev.filter(photo => !selectedPhotos.includes(photo.id)));
      setSelectedPhotos([]);
      setDeleteConfirm(false);
    } catch (error) {
      console.error('Failed to delete photos:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-10 w-10 text-blue-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-2 text-gray-600">Memuat foto...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold">Kelola Foto Event</h1>
              <div className="flex space-x-3">
                <button
                  onClick={() => router.push(`/dashboard/events/${params.eventId}/upload`)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition duration-200"
                >
                  Upload Foto Baru
                </button>
                <button
                  onClick={() => router.back()}
                  className="text-gray-500 hover:text-gray-700 py-2 px-4 rounded-md border border-gray-300"
                >
                  Kembali
                </button>
              </div>
            </div>
            
            <div className="mt-4 flex items-center justify-between">
              <p className="text-gray-600">
                Total {photos.length} foto pada event ini
              </p>
              
              {photos.length > 0 && (
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="select-all"
                      checked={selectedPhotos.length === photos.length && photos.length > 0}
                      onChange={selectAllPhotos}
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                    <label htmlFor="select-all" className="ml-2 text-sm text-gray-700">
                      Pilih Semua ({selectedPhotos.length} terpilih)
                    </label>
                  </div>
                  
                  {selectedPhotos.length > 0 && (
                    <button
                      onClick={() => setDeleteConfirm(true)}
                      className="bg-red-600 hover:bg-red-700 text-white font-medium py-1 px-3 rounded text-sm flex items-center"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Hapus ({selectedPhotos.length})
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {photos.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Belum ada foto</h3>
              <p className="mt-2 text-gray-500">Upload foto pertama untuk event ini.</p>
              <div className="mt-6">
                <button
                  onClick={() => router.push(`/dashboard/events/${params.eventId}/upload`)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition duration-200"
                >
                  Upload Foto
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {photos.map(photo => (
                  <div 
                    key={photo.id} 
                    className={`border rounded-lg overflow-hidden bg-gray-100 transition-all duration-200 ${
                      selectedPhotos.includes(photo.id) ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-300'
                    }`}
                  >
                    <div className="relative aspect-square">
                      <img 
                        src={photo.url} 
                        alt={photo.filename}
                        className="object-cover w-full h-full"
                      />
                      
                      <div className="absolute top-2 left-2">
                        <input
                          type="checkbox"
                          checked={selectedPhotos.includes(photo.id)}
                          onChange={() => togglePhotoSelection(photo.id)}
                          className="h-5 w-5 text-blue-600 rounded bg-white"
                        />
                      </div>
                    </div>
                    
                    <div className="p-3">
                      <p className="text-sm font-medium truncate">{photo.filename}</p>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{formatFileSize(photo.size)}</span>
                        <span>{formatDate(photo.uploadedAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Hapus Foto</h3>
            <p className="text-gray-600 mb-6">
              Apakah Anda yakin ingin menghapus {selectedPhotos.length} foto? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}