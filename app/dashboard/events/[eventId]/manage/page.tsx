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

export default function ManagePhotos({ params }: { params: Promise<{ eventId: string }> }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  // Unwrap the params promise
  useEffect(() => {
    async function unwrapParams() {
      try {
        const unwrappedParams = await params;
        setEventId(unwrappedParams.eventId);
      } catch (error) {
        console.error('Failed to unwrap params:', error);
        setError('Failed to load event');
      }
    }
    unwrapParams();
  }, [params]);

  // Fetch photos from API
  useEffect(() => {
    if (!eventId) return;

    const fetchPhotos = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Fetching photos for event:', eventId);
        const response = await fetch(`/api/events/${eventId}/photos`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch photos: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error);
        }
        
        console.log('Photos data received:', data.photos);
        setPhotos(data.photos || []);
      } catch (error) {
        console.error('Failed to fetch photos:', error);
        setError(error instanceof Error ? error.message : 'Failed to load photos');
      } finally {
        setLoading(false);
      }
    };

    fetchPhotos();
  }, [eventId]);

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
    if (!eventId) return;
    
    try {
      setDeleting(true);
      
      const response = await fetch('/api/photos/delete-mass', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          photoIds: selectedPhotos,
          eventId: eventId 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete photos');
      }
      
      // Remove deleted photos from state
      setPhotos(prev => prev.filter(photo => !selectedPhotos.includes(photo.id)));
      setSelectedPhotos([]);
      setDeleteConfirm(false);
      
    } catch (error) {
      console.error('Failed to delete photos:', error);
      alert('Gagal menghapus foto. Silakan coba lagi.');
    } finally {
      setDeleting(false);
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
    try {
      return new Date(dateString).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Tampilkan error jika ada
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="mx-auto h-16 w-16 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">Terjadi Error</h3>
          <p className="mt-2 text-gray-500">{error}</p>
          <div className="mt-6">
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition duration-200"
            >
              Coba Lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!eventId || loading) {
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
              <h1 className="text-2xl font-bold text-gray-900">Kelola Foto Event</h1>
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-600 hover:text-gray-800 hover:bg-gray-100 py-2 px-4 rounded-md border border-gray-300 transition duration-200"
              >
                Kembali
              </button>
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
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <label htmlFor="select-all" className="ml-2 text-sm text-gray-700">
                      Pilih Semua ({selectedPhotos.length} terpilih)
                    </label>
                  </div>
                  
                  {selectedPhotos.length > 0 && (
                    <button
                      onClick={() => setDeleteConfirm(true)}
                      className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded text-sm flex items-center transition duration-200"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  onClick={() => router.push(`/dashboard/events/${eventId}/upload`)}
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
                    className={`border rounded-lg overflow-hidden bg-gray-100 transition-all duration-200 cursor-pointer ${
                      selectedPhotos.includes(photo.id) 
                        ? 'ring-2 ring-blue-500 border-blue-500 shadow-md' 
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onClick={() => togglePhotoSelection(photo.id)}
                  >
                    <div className="relative aspect-square">
                      <img 
                        src={photo.url} 
                        alt={photo.filename}
                        className="object-cover w-full h-full"
                        onError={(e) => {
                          e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIGZpbGw9IiM5YzljOWMiPkltYWdlIE5vdCBGb3VuZDwvdGV4dD48L3N2Zz4=';
                        }}
                      />
                      
                      <div 
                        className="absolute top-2 left-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPhotos.includes(photo.id)}
                          onChange={() => togglePhotoSelection(photo.id)}
                          className="h-5 w-5 text-blue-600 rounded border-gray-300 bg-white focus:ring-blue-500 cursor-pointer"
                        />
                      </div>
                    </div>
                    
                    <div className="p-3 bg-white">
                      <p className="text-sm font-medium text-gray-900 truncate" title={photo.filename}>
                        {photo.filename}
                      </p>
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

      {/* DELETE CONFIRMATION MODAL - SAMA PERSIS SEPERTI DI DASHBOARD */}
      {deleteConfirm && (
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
                Hapus Foto?
              </h3>

              <p className="text-gray-600 mb-4">
                Apakah Anda yakin ingin menghapus <strong>{selectedPhotos.length} foto</strong>? 
                Tindakan ini tidak dapat dibatalkan dan foto akan dihapus permanen.
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
                    <strong>Peringatan:</strong> Tindakan ini tidak dapat dibatalkan.
                  </p>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setDeleteConfirm(false)}
                  disabled={deleting}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleDelete}
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
    </div>
  );
}