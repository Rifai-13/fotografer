// app/results/loading.tsx
export default function ResultsLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 py-8">
      <div className="container mx-auto px-4 sm:px-6">
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-2">
            <div className="text-2xl">📸</div>
            <span className="text-2xl font-bold text-gray-900">
              Foto<span className="text-blue-600">AI</span>
            </span>
          </div>
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