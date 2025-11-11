'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Hero() {
  const [isScanning, setIsScanning] = useState(false)
  const router = useRouter()
  const handleTryNow = () => {
    router.push('/scan')
  }

  const handleScanClick = () => {
    setIsScanning(true)
    setTimeout(() => {
      setIsScanning(false)
      alert('Proses scanning selesai! Foto Anda telah ditemukan.')
    }, 2000)
  }

  return (
    <section className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 text-slate-900">
      <div className="container mx-auto px-4 sm:px-6 py-16 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Text Content */}
          <div className="max-w-2xl">
            <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-6">
              🚀 Teknologi AI Terkini
            </div>
            
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-6">
              Temukan{' '}
              <span className="text-blue-600">Setiap Momen</span>{' '}
              dalam Hitungan Detik
            </h1>
            
            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
              Dengan teknologi pengenalan wajah AI yang canggih, temukan semua foto Anda dari event dalam sekejap. Tidak perlu lagi mencari manual!
            </p>

            <div className="space-y-6">
              <button
                onClick={handleTryNow}
                disabled={isScanning}
                className={`px-8 py-4 rounded-lg font-semibold text-base transition-all duration-300 ${
                  isScanning
                    ? 'bg-slate-400 cursor-not-allowed text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transform hover:scale-105'
                }`}
              >
                {isScanning ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Memindai Wajah...</span>
                  </div>
                ) : (
                  'Scan Foto Sekarang'
                )}
              </button>

              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Tidak perlu login</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Hasil instan</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Event Lari 10K - 15 Okt 2023</span>
                </div>
              </div>
            </div>
          </div>

          {/* Visual Content - Process Steps */}
          <div className="relative">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
              {/* Step 1 */}
              <div className="bg-white rounded-xl p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow duration-300">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">Upload Foto</h3>
                <p className="text-sm text-slate-600">Upload foto selfie untuk referensi wajah Anda</p>
              </div>

              {/* Step 2 */}
              <div className="bg-white rounded-xl p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow duration-300 transform lg:translate-y-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">AI Scan</h3>
                <p className="text-sm text-slate-600">Teknologi AI memindai ribuan foto dalam hitungan detik</p>
              </div>

              {/* Step 3 */}
              <div className="bg-white rounded-xl p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow duration-300">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">Hasil Instan</h3>
                <p className="text-sm text-slate-600">Dapatkan semua foto Anda yang terdeteksi</p>
              </div>
            </div>

            {/* Stats Bar */}
            <div className="mt-8 bg-white rounded-2xl p-6 shadow-md border border-slate-200">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">50K+</div>
                  <div className="text-sm text-slate-600">Foto Dipindai</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">98%</div>
                  <div className="text-sm text-slate-600">Tingkat Akurasi</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">2.1s</div>
                  <div className="text-sm text-slate-600">Rata-rata Waktu</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}