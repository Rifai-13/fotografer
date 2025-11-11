'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Type untuk event
interface Event {
  id: string
  name: string
  date: string
  photoCount: number
  status: 'active' | 'upcoming' | 'completed'
}

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

  // Data dummy events - nanti bisa diganti dengan API call
  useEffect(() => {
    // Simulasi loading events dari API
    const loadEvents = async () => {
      setIsLoadingEvents(true)
      // Simulasi API call delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const dummyEvents: Event[] = [
        {
          id: '1',
          name: 'Event Lari 10K Jakarta',
          date: '15 Oktober 2023',
          photoCount: 15200,
          status: 'active'
        },
        {
          id: '2',
          name: 'Seminar Teknologi AI 2023',
          date: '22 Oktober 2023',
          photoCount: 8300,
          status: 'active'
        },
        {
          id: '3',
          name: 'Konser Musik Jazz Night',
          date: '5 November 2023',
          photoCount: 25600,
          status: 'active'
        },
        {
          id: '4',
          name: 'Marathon Charity 2023',
          date: '12 November 2023',
          photoCount: 18400,
          status: 'upcoming'
        },
        {
          id: '5',
          name: 'Tech Conference 2023',
          date: '3 Desember 2023',
          photoCount: 0,
          status: 'upcoming'
        }
      ]
      
      setEvents(dummyEvents)
      setIsLoadingEvents(false)
      
      // Auto-select first active event
      const firstActiveEvent = dummyEvents.find(event => event.status === 'active')
      if (firstActiveEvent) {
        setSelectedEvent(firstActiveEvent.id)
      }
    }

    loadEvents()
  }, [])

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

    const selectedEventData = events.find(event => event.id === selectedEvent)
    
    // Simulasi proses scanning AI
    alert(`Foto berhasil diambil! Sistem sedang memindai wajah Anda di event: ${selectedEventData?.name}`)
    
    // Redirect ke hasil pencarian setelah beberapa detik
    setTimeout(() => {
      router.push(`/results?event=${selectedEvent}`)
    }, 2000)
  }

  const getSelectedEventData = () => {
    return events.find(event => event.id === selectedEvent)
  }

  const formatPhotoCount = (count: number) => {
    return count.toLocaleString('id-ID')
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
          
          <Link 
            href="/" 
            className="px-4 py-2 text-gray-700 font-medium rounded-lg hover:text-gray-900 transition-colors duration-200"
          >
            Kembali ke Beranda
          </Link>
        </header>

        <div className="max-w-2xl mx-auto">
          <Card className="border-0 shadow-lg">
            <CardHeader className="text-center space-y-1 pb-6">
              <CardTitle className="text-2xl font-bold text-gray-900">
                Scan Wajah Anda
              </CardTitle>
              <CardDescription className="text-gray-600">
                Pilih event dan ambil foto selfie untuk memulai pencarian
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
                    <span>Memuat event...</span>
                  </div>
                ) : (
                  <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih event yang ingin Anda cari fotonya" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Active Events */}
                      <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Event Aktif
                      </div>
                      {events
                        .filter(event => event.status === 'active')
                        .map(event => (
                          <SelectItem key={event.id} value={event.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{event.name}</span>
                              <span className="text-sm text-gray-500">
                                {event.date} • {formatPhotoCount(event.photoCount)} foto
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      }
                      
                      {/* Upcoming Events */}
                      {events.filter(event => event.status === 'upcoming').length > 0 && (
                        <>
                          <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2">
                            Event Mendatang
                          </div>
                          {events
                            .filter(event => event.status === 'upcoming')
                            .map(event => (
                              <SelectItem key={event.id} value={event.id}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{event.name}</span>
                                  <span className="text-sm text-gray-500">
                                    {event.date} • {formatPhotoCount(event.photoCount)} foto
                                  </span>
                                </div>
                              </SelectItem>
                            ))
                          }
                        </>
                      )}
                    </SelectContent>
                  </Select>
                )}
                
                {selectedEvent && (
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-blue-900 text-sm">
                          {getSelectedEventData()?.name}
                        </h4>
                        <p className="text-blue-700 text-xs mt-1">
                          📅 {getSelectedEventData()?.date}
                        </p>
                        <p className="text-blue-700 text-xs">
                          📷 {formatPhotoCount(getSelectedEventData()?.photoCount || 0)} foto tersedia
                        </p>
                      </div>
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                        {getSelectedEventData()?.status === 'active' ? 'Aktif' : 'Mendatang'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Camera Preview */}
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
                          Gunakan Foto Ini
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>

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
              {selectedEvent && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">Event yang Dipilih</h3>
                      <p className="text-sm text-gray-600">{getSelectedEventData()?.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{getSelectedEventData()?.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Foto tersedia</p>
                      <p className="font-semibold text-gray-900">
                        {formatPhotoCount(getSelectedEventData()?.photoCount || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Additional Info */}
          <div className="mt-6 text-center text-sm text-gray-600">
            <p>Butuh bantuan? <Link href="/help" className="text-blue-600 hover:underline">Lihat panduan penggunaan</Link></p>
          </div>
        </div>
      </div>
    </div>
  )
}