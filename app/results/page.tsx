// app/results/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Match {
  photo_id: string;
  image_url: string;
  similarity: number;
  bounding_box: any;
  face_id: string;
  confidence: number;
}

export default function ResultsPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const matchesParam = searchParams.get('matches');
    if (matchesParam) {
      try {
        const parsedMatches = JSON.parse(matchesParam);
        setMatches(parsedMatches);
      } catch (error) {
        console.error('Error parsing matches:', error);
      }
    }
    setLoading(false);
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat hasil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-green-500 to-green-600 p-2 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Hasil Pencarian</h1>
                <p className="text-sm text-gray-600">Foto-foto yang cocok dengan wajah Anda</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/scan')}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition duration-200 flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Kembali</span>
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 border border-white/80 shadow-sm">
          {matches.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-gradient-to-br from-gray-100 to-gray-200 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Tidak Ada Foto yang Ditemukan</h3>
              <p className="text-gray-600 mb-6">
                Maaf, tidak ada foto yang cocok dengan wajah Anda ditemukan di event ini.
              </p>
              <button
                onClick={() => router.push('/scan')}
                className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-lg transition duration-200"
              >
                Coba Lagi
              </button>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  🎉 Ditemukan {matches.length} Foto!
                </h2>
                <p className="text-gray-600">
                  Berikut adalah foto-foto Anda yang berhasil dikenali oleh AI
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {matches.map((match, index) => (
                  <div key={match.photo_id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="aspect-square bg-gray-100 relative">
                      <img
                        src={match.image_url}
                        alt={`Foto ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-medium px-2 py-1 rounded-full">
                        {match.similarity.toFixed(1)}% match
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex justify-between items-center text-sm text-gray-600">
                        <span>Kecocokan:</span>
                        <span className="font-medium">{match.similarity.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}