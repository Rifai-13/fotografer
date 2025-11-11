export default function Events() {
  const events = [
    {
      title: 'Event Lari 10K',
      date: '15 Oktober 2023',
      participants: '2,500+ Peserta',
      photos: '15,000+ Foto',
      color: 'from-blue-500 to-blue-600'
    },
    {
      title: 'Seminar Teknologi',
      date: '22 Oktober 2023',
      participants: '1,200+ Peserta',
      photos: '8,000+ Foto',
      color: 'from-purple-500 to-purple-600'
    },
    {
      title: 'Konser Musik',
      date: '5 November 2023',
      participants: '5,000+ Peserta',
      photos: '25,000+ Foto',
      color: 'from-pink-500 to-pink-600'
    }
  ]

  return (
    <section className="py-20 bg-gray-50">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Event Terbaru
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Temukan foto Anda dari berbagai event yang telah kami liput
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {events.map((event, index) => (
            <div 
              key={index}
              className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2"
            >
              <div className={`bg-gradient-to-r ${event.color} p-6 text-white`}>
                <h3 className="text-2xl font-bold mb-2">{event.title}</h3>
                <p className="text-white/90">{event.date}</p>
              </div>
              
              <div className="p-6">
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center py-3 border-b border-gray-200">
                    <span className="text-gray-600">Peserta</span>
                    <span className="font-semibold text-gray-900">{event.participants}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-gray-200">
                    <span className="text-gray-600">Foto</span>
                    <span className="font-semibold text-gray-900">{event.photos}</span>
                  </div>
                </div>
                
                <button className="w-full bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors duration-200">
                  Cari Foto Saya
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}