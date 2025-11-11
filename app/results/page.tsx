'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// Data events untuk reference
const eventsData = {
  '1': { name: 'Event Lari 10K Jakarta', date: '15 Oktober 2023', totalPhotos: 15200 },
  '2': { name: 'Seminar Teknologi AI 2023', date: '22 Oktober 2023', totalPhotos: 8300 },
  '3': { name: 'Konser Musik Jazz Night', date: '5 November 2023', totalPhotos: 25600 },
  '4': { name: 'Marathon Charity 2023', date: '12 November 2023', totalPhotos: 18400 },
  '5': { name: 'Tech Conference 2023', date: '3 Desember 2023', totalPhotos: 0 }
}

export default function ResultsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [results, setResults] = useState<any[]>([])
  const [eventId, setEventId] = useState<string>('')
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Get event ID from URL parameters
    const eventParam = searchParams.get('event')
    if (eventParam) {
      setEventId(eventParam)
    }

    // Simulasi loading data
    const timer = setTimeout(() => {
      setIsLoading(false)
      // Data dummy hasil pencarian berdasarkan event
      const resultCount = eventParam === '3' ? 8 : eventParam === '1' ? 12 : 5
      
      const dummyResults = Array.from({ length: resultCount }, (_, i) => ({
        id: i + 1,
        url: `/placeholder${i + 1}.jpg`,
        event: eventsData[eventParam as keyof typeof eventsData]?.name || 'Event',
        timestamp: `${10 + i}:${i % 2 === 0 ? '30' : '45'} AM`,
        location: `Area ${String.fromCharCode(65 + i)}`
      }))
      
      setResults(dummyResults)
    }, 3000)

    return () => clearTimeout(timer)
  }, [searchParams])

  const scanAgain = () => {
    router.push('/scan')
  }

  const currentEvent = eventsData[eventId as keyof typeof eventsData]

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
          
          <div className="flex space-x-4">
            <Button 
              onClick={scanAgain}
              variant="outline"
              className="text-gray-700"
            >
              Scan Lagi
            </Button>
            <Link 
              href="/" 
              className="px-4 py-2 text-gray-700 font-medium rounded-lg hover:text-gray-900 transition-colors duration-200"
            >
              Beranda
            </Link>
          </div>
        </header>

        <div className="max-w-6xl mx-auto">
          <Card className="border-0 shadow-lg mb-8">
            <CardHeader className="text-center space-y-1 pb-6">
              <CardTitle className="text-2xl font-bold text-gray-900">
                {isLoading ? 'Memindai Foto...' : 'Hasil Pencarian'}
              </CardTitle>
              <CardDescription className="text-gray-600">
                {isLoading 
                  ? `AI sedang menganalisis dan mencari foto Anda di event ${currentEvent?.name}` 
                  : `Ditemukan ${results.length} foto dengan wajah yang cocok di ${currentEvent?.name}`
                }
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {isLoading ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600">Mencari foto Anda di {currentEvent?.name}...</p>
                  <p className="text-sm text-gray-500 mt-2">Memindai {currentEvent?.totalPhotos.toLocaleString()} foto</p>
                </div>
              ) : (
                <>
                  {/* Event Info */}
                  <div className="bg-blue-50 rounded-lg p-4 mb-6 border border-blue-200">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                      <div>
                        <h3 className="font-semibold text-blue-900 text-lg">{currentEvent?.name}</h3>
                        <p className="text-blue-700">📅 {currentEvent?.date}</p>
                      </div>
                      <div className="mt-2 sm:mt-0 text-center sm:text-right">
                        <p className="text-sm text-blue-700">Total foto dalam event</p>
                        <p className="text-xl font-bold text-blue-900">{currentEvent?.totalPhotos.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Results Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
                    {results.map((result) => (
                      <div key={result.id} className="bg-white rounded-lg overflow-hidden shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
                        <div className="aspect-square bg-gray-200 flex items-center justify-center">
                          <div className="text-gray-400 text-center p-4">
                            <div className="text-4xl mb-2">📷</div>
                            <p className="text-sm">Foto {result.id}</p>
                          </div>
                        </div>
                        <div className="p-3">
                          <p className="font-semibold text-sm text-gray-900 truncate">{result.event}</p>
                          <p className="text-xs text-gray-500">{result.timestamp}</p>
                          <p className="text-xs text-gray-500 mt-1">📍 {result.location}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-center space-x-4 pt-6 border-t border-gray-200">
                    <Button 
                      onClick={scanAgain}
                      variant="outline"
                      className="text-gray-700"
                    >
                      Cari di Event Lain
                    </Button>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                      Download Semua Foto ({results.length})
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Accuracy Info */}
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row justify-between items-center">
                <div>
                  <h3 className="font-semibold text-gray-900">Statistik Pencarian</h3>
                  <p className="text-gray-600">Hasil analisis AI untuk event ini</p>
                </div>
                <div className="flex space-x-6 mt-4 sm:mt-0 text-center">
                  <div>
                    <p className="text-sm text-gray-600">Akurasi</p>
                    <p className="text-2xl font-bold text-green-600">94%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Foto Dipindai</p>
                    <p className="text-2xl font-bold text-blue-600">{currentEvent?.totalPhotos.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Ditemukan</p>
                    <p className="text-2xl font-bold text-purple-600">{results.length}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}