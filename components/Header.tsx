import Link from 'next/link'

export default function Header() {
  return (
    <header className="bg-white/95 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100 shadow-sm">
      <div className="container mx-auto px-4 sm:px-6">
        <nav className="flex justify-between items-center py-4">
          <Link href="/" className="flex items-center space-x-2">
            <div className="text-2xl">📸</div>
            <span className="text-2xl font-bold text-gray-900">
              Foto<span className="text-indigo-600">AI</span>
            </span>
          </Link>
          
          <div className="flex items-center space-x-4">
            <Link 
              href="/login" 
              className="px-6 py-2 text-gray-700 font-medium rounded-lg hover:text-gray-900 transition-colors duration-200"
            >
              Masuk
            </Link>
            <Link 
              href="/signup" 
              className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors duration-200 shadow-sm"
            >
              Daftar
            </Link>
          </div>
        </nav>
      </div>
    </header>
  )
}