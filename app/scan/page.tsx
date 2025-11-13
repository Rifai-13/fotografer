'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

// Type untuk event
interface Event {
  id: string
  name: string
  date: string
  location: string
  photo_count: number
  status: string
  created_at: string
  actual_photo_count: number
}

// Type untuk event status
type EventStatus = 'active' | 'upcoming' | 'completed'

export default function ScanPage() {
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [isCaptured, setIsCaptured] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<string>('')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [isLoadingEvents, setIsLoadingEvents] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const router = useRouter()
  const supabase = createClient()

  // Load events yang tersedia untuk public
  useEffect(() => {
    const loadPublicEvents = async () => {
      try {
        setIsLoadingEvents(true)

        console.log("📦 Fetching public events...")

        // Fetch semua event yang memiliki foto (public access)
        // Gunakan RPC function atau query langsung ke events yang memiliki photos
        const { data: eventsData, error: eventsError } = await supabase
          .from('events')
          .select(`
            *,
            photos:photos(count)
          `)
          .eq('status', 'active') // Hanya event yang aktif
          .order('created_at', { ascending: false })

        if (eventsError) {
          console.error('Error fetching events:', eventsError)
          // Fallback ke query sederhana
          await fetchEventsWithFallback()
          return
        }

        console.log("🎉 Public events loaded:", eventsData?.length || 0)

        // Transform data untuk mendapatkan actual_photo_count
        const transformedEvents = (eventsData || []).map((event: any) => ({
          id: event.id,
          name: event.name,
          date: event.date,
          location: event.location,
          photo_count: event.photo_count,
          status: event.status,
          created_at: event.created_at,
          actual_photo_count: event.photos?.[0]?.count || 0
        }))

        // Filter hanya event yang memiliki foto
        const eventsWithPhotos = transformedEvents.filter((event: Event) => event.actual_photo_count > 0)
        
        setEvents(eventsWithPhotos)
        
        // Auto-select first event dengan foto
        if (eventsWithPhotos.length > 0) {
          setSelectedEvent(eventsWithPhotos[0].id)
        }

      } catch (error) {
        console.error('Unexpected error:', error)
        toast.error('Terjadi kesalahan saat memuat event')
      } finally {
        setIsLoadingEvents(false)
      }
    }

    // Fallback function jika query kompleks gagal
    const fetchEventsWithFallback = async () => {
      try {
        // Query sederhana: ambil semua event aktif
        const { data: eventsData, error: eventsError } = await supabase
          .from('events')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false })

        if (eventsError) {
          throw eventsError
        }

        // Untuk setiap event, hitung jumlah foto
        const eventsWithCounts = await Promise.all(
          (eventsData || []).map(async (event: Event) => {
            const { count } = await supabase
              .from('photos')
              .select('*', { count: 'exact', head: true })
              .eq('event_id', event.id)

            return {
              ...event,
              actual_photo_count: count || 0
            }
          })
        )

        // Filter hanya event yang memiliki foto
        const eventsWithPhotos = eventsWithCounts.filter((event: Event) => event.actual_photo_count > 0)
        setEvents(eventsWithPhotos)
        
        // Auto-select first event dengan foto
        if (eventsWithPhotos.length > 0) {
          setSelectedEvent(eventsWithPhotos[0].id)
        }

      } catch (error) {
        console.error('Fallback also failed:', error)
        toast.error('Gagal memuat event')
        setEvents([])
      }
    }

    loadPublicEvents()
  }, [supabase])

  // Cleanup stream ketika komponen unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [stream])

  const openCamera = async () => {
    if (!selectedEvent) {
      alert('Silakan pilih event terlebih dahulu!')
      return
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user', // Kamera depan
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      })
      
      setStream(mediaStream)
      setIsCameraOpen(true)
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (error) {
      console.error('Error accessing camera:', error)
      alert('Tidak dapat mengakses kamera. Pastikan Anda memberikan izin akses kamera.')
    }
  }

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      
      // Set canvas size sama dengan video
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      // Gambar frame video ke canvas
      context?.drawImage(video, 0, 0, canvas.width, canvas.height)
      
      // Stop kamera
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
      
      setIsCaptured(true)
      setIsCameraOpen(false)
    }
  }

  const retakePhoto = () => {
    setIsCaptured(false)
    openCamera()
  }

  const usePhoto = () => {
    if (!selectedEvent) {
      alert('Silakan pilih event terlebih dahulu!')
      return
    }

    const selectedEventData = events.find((event: Event) => event.id === selectedEvent)
    
    if (!selectedEventData) {
      alert('Event tidak ditemukan!')
      return
    }

    // Dapatkan gambar dari canvas sebagai base64
    if (canvasRef.current) {
      const imageData = canvasRef.current.toDataURL('image/jpeg')
      
      // Simulasi proses scanning AI
      toast.success(`Foto berhasil diambil! Sistem sedang memindai wajah Anda di event: ${selectedEventData.name}`)
      
      // Redirect ke hasil pencarian dengan membawa data gambar
      setTimeout(() => {
        router.push(`/results?event=${selectedEvent}&image=${encodeURIComponent(imageData)}`)
      }, 2000)
    } else {
      toast.error('Gagal mengambil foto. Silakan coba lagi.')
    }
  }

  const getSelectedEventData = (): Event | undefined => {
    return events.find((event: Event) => event.id === selectedEvent)
  }

  const formatPhotoCount = (count: number): string => {
    return count.toLocaleString('id-ID')
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const getEventStatus = (event: Event): EventStatus => {
    if (event.actual_photo_count > 0) return 'active'
    if (event.status === 'completed') return 'completed'
    return 'upcoming'
  }

  const getStatusLabel = (status: EventStatus): string => {
    switch (status) {
      case 'active': return 'Aktif'
      case 'upcoming': return 'Mendatang'
      case 'completed': return 'Selesai'
      default: return 'Aktif'
    }
  }

  const getStatusColor = (status: EventStatus): string => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'upcoming': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-gray-100 text-gray-800'
      default: return 'bg-green-100 text-green-800'
    }
  }

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
                Cari Foto Anda di Event
              </CardTitle>
              <CardDescription className="text-gray-600">
                Pilih event dan ambil foto selfie untuk menemukan foto-foto Anda
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
                    <p className="mb-2">Belum ada event dengan foto yang tersedia</p>
                    <p className="text-sm mb-4">Silakan coba lagi nanti atau hubungi penyelenggara event</p>
                  </div>
                ) : (
                  <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih event yang ingin Anda cari fotonya" />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map((event: Event) => (
                        <SelectItem key={event.id} value={event.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{event.name}</span>
                            <span className="text-sm text-gray-500">
                              {formatDate(event.date)} • {formatPhotoCount(event.actual_photo_count)} foto tersedia
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
                          📅 {formatDate(getSelectedEventData()?.date || '')} • 📍 {getSelectedEventData()?.location}
                        </p>
                        <p className="text-blue-700 text-xs">
                          📷 {formatPhotoCount(getSelectedEventData()?.actual_photo_count || 0)} foto tersedia untuk pencarian
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(getEventStatus(getSelectedEventData()!))}`}>
                        {getStatusLabel(getEventStatus(getSelectedEventData()!))}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Camera Preview */}
              {events.length > 0 && (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700">
                    Ambil Foto Selfie
                  </label>
                  
                  <div className="relative bg-gray-100 rounded-xl overflow-hidden aspect-[4/3] flex items-center justify-center">
                    {!isCameraOpen && !isCaptured ? (
                      <div className="text-center p-8">
                        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <p className="text-gray-600 mb-4">
                          {selectedEvent 
                            ? 'Kamera siap untuk mengambil foto selfie Anda' 
                            : 'Pilih event terlebih dahulu untuk membuka kamera'
                          }
                        </p>
                        <Button 
                          onClick={openCamera}
                          disabled={!selectedEvent}
                          className={`${!selectedEvent ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
                        >
                          {selectedEvent ? 'Buka Kamera' : 'Pilih Event Terlebih Dahulu'}
                        </Button>
                      </div>
                    ) : isCameraOpen ? (
                      <>
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                          <Button 
                            onClick={captureImage}
                            className="bg-red-500 hover:bg-red-600 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg"
                          >
                            <div className="w-12 h-12 bg-white rounded-full"></div>
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <canvas
                          ref={canvasRef}
                          className="w-full h-full object-cover rounded-xl"
                        />
                        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-4">
                          <Button 
                            onClick={retakePhoto}
                            variant="outline"
                            className="bg-white hover:bg-gray-50 text-gray-700"
                          >
                            Ambil Ulang
                          </Button>
                          <Button 
                            onClick={usePhoto}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            Cari Foto Saya
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Instructions */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-2">Tips Foto Selfie Terbaik:</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Pastikan wajah terlihat jelas dengan pencahayaan yang baik</li>
                  <li>• Hindari bayangan pada wajah</li>
                  <li>• Pandangan lurus ke kamera</li>
                  <li>• Jangan menggunakan aksesori yang menutupi wajah</li>
                  <li>• Pastikan latar belakang tidak terlalu ramai</li>
                </ul>
              </div>

              {/* Event Info Card */}
              {selectedEvent && getSelectedEventData() && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">Event yang Dipilih</h3>
                      <p className="text-sm text-gray-600">{getSelectedEventData()?.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(getSelectedEventData()?.date || '')} • {getSelectedEventData()?.location}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Foto tersedia</p>
                      <p className="font-semibold text-gray-900">
                        {formatPhotoCount(getSelectedEventData()?.actual_photo_count || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}