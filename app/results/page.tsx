// app/results/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

// Type untuk hasil face match
interface FaceMatch {
  photo_id: string
  similarity: number
  image_url: string
  bounding_box: {
    Width: number
    Height: number
    Left: number
    Top: number
  }
}

// Type untuk event
interface Event {
  id: string
  name: string
  date: string
  location: string
}

export default function ResultsPage() {
  const [matches, setMatches] = useState<FaceMatch[]>([])
  const [event, setEvent] = useState<Event | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const loadResults = async () => {
      try {
        setIsLoading(true)
        
        const eventId = searchParams.get('event')
        const matchesParam = searchParams.get('matches')

        if (!eventId || !matchesParam) {
          toast.error('Data hasil pencarian tidak valid')
          return
        }

        // Parse matches dari URL parameter
        const parsedMatches: FaceMatch[] = JSON.parse(decodeURIComponent(matchesParam))
        
        // Load event details
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select('*')
          .eq('id', eventId)
          .single()

        if (eventError) {
          console.error('Error loading event:', eventError)
          toast.error('Gagal memuat detail event')
          return
        }

        setEvent(eventData)
        setMatches(parsedMatches.sort((a, b) => b.similarity - a.similarity))

      } catch (error) {
        console.error('Error loading results:', error)
        toast.error('Terjadi kesalahan saat memuat hasil pencarian')
      } finally {
        setIsLoading(false)
      }
    }

    loadResults()
  }, [searchParams, supabase])

  const formatSimilarity = (similarity: number): string => {
    return (similarity * 100).toFixed(1) + '%'
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const openImageModal = (imageUrl: string) => {
    setSelectedImage(imageUrl)
    setIsModalOpen(true)
  }

  const closeImageModal = () => {
    setSelectedImage(null)
    setIsModalOpen(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 py-8">
        <div className="container mx-auto px-4 sm:px-6">
          <header className="flex justify-between items-center mb-8">
            <Link href="/" className="flex items-center space-x-2">
              <div className="text-2xl">📸</div>
              <span className="text-2xl font-bold text-gray-900">
                Foto<span className="text-blue-600">AI</span>
              </span>
            </Link>
          </header>

          <div className="max-w-7xl mx-auto">
            <div className="border-0 shadow-lg rounded-lg bg-white p-6">
              <div className="text-center py-12">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Memuat hasil pencarian...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
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
          <Button asChild variant="outline">
            <Link href="/scan">
              Cari Foto Lagi
            </Link>
          </Button>
        </header>

        <div className="max-w-7xl mx-auto">
          {/* Results Summary */}
          <Card className="border-0 shadow-lg mb-8">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-3xl font-bold text-gray-900">
                {matches.length > 0 ? '🎉 Foto Ditemukan!' : '😔 Foto Tidak Ditemukan'}
              </CardTitle>
              <CardDescription className="text-lg text-gray-600">
                {matches.length > 0 
                  ? `Kami menemukan ${matches.length} foto yang cocok dengan wajah Anda`
                  : 'Maaf, tidak ada foto yang cocok dengan wajah Anda'
                }
              </CardDescription>
            </CardHeader>

            {event && (
              <CardContent className="text-center">
                <div className="bg-blue-50 rounded-lg p-4 inline-block">
                  <h3 className="font-semibold text-blue-900 text-lg">
                    {event.name}
                  </h3>
                  <p className="text-blue-700">
                    📅 {formatDate(event.date)} • 📍 {event.location}
                  </p>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Matches Grid */}
          {matches.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              {matches.map((match, index) => (
                <Card key={match.photo_id} className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-500">
                        #{index + 1}
                      </span>
                      <div className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
                        {formatSimilarity(match.similarity)} Cocok
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div 
                      className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer group"
                      onClick={() => openImageModal(match.image_url)}
                    >
                      <img
                        src={match.image_url}
                        alt={`Foto yang cocok ${index + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300 flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m0 0l3-3m-3 3l-3-3" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    
                    {/* Bounding Box Info */}
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Posisi Wajah:</span>
                        <span>
                          {Math.round(match.bounding_box.Left * 100)}%, {Math.round(match.bounding_box.Top * 100)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Ukuran:</span>
                        <span>
                          {Math.round(match.bounding_box.Width * 100)}% × {Math.round(match.bounding_box.Height * 100)}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* No Results Message */}
          {matches.length === 0 && (
            <Card className="border-0 shadow-lg">
              <CardContent className="text-center py-12">
                <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-12 h-12 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Tidak Ada Foto yang Cocok Ditemukan
                </h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Sistem AI tidak dapat menemukan foto yang cocok dengan wajah Anda. 
                  Coba ambil foto selfie lagi dengan kondisi pencahayaan yang lebih baik.
                </p>
                <div className="flex justify-center space-x-4">
                  <Button asChild className="bg-blue-600 hover:bg-blue-700">
                    <Link href="/scan">
                      Coba Lagi
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/">
                      Kembali ke Beranda
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Technology Info */}
          <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
            <CardContent className="p-6">
              <h3 className="font-semibold text-blue-900 text-lg mb-4">
                🧠 Teknologi AI yang Digunakan
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    <span className="text-blue-800">
                      <strong>AWS Rekognition</strong> - Face recognition technology
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    <span className="text-blue-800">
                      Pencarian wajah dengan akurasi tinggi
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    <span className="text-blue-800">
                      Bisa menemukan wajah Anda di foto grup
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    <span className="text-blue-800">
                      Mendeteksi wajah dari berbagai angle
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    <span className="text-blue-800">
                      Proses pencarian aman dan privat
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    <span className="text-blue-800">
                      Analisis 100+ titik wajah
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Image Modal */}
      {isModalOpen && selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={closeImageModal}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={selectedImage}
              alt="Foto detail"
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  )
}