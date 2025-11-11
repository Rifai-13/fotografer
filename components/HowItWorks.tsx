export default function HowItWorks() {
  const steps = [
    {
      number: '01',
      icon: '📤',
      title: 'Upload Foto Event',
      description: 'Fotografer meng-upload semua foto hasil liputan event ke dalam sistem galeri kami.'
    },
    {
      number: '02',
      icon: '👤',
      title: 'Scan Wajah Anda',
      description: 'Anda cukup upload foto selfie untuk memulai proses pencarian otomatis.'
    },
    {
      number: '03',
      icon: '⚡',
      title: 'Temukan Instan',
      description: 'AI kami menemukan semua foto Anda secara otomatis dalam hitungan detik.'
    }
  ]

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Cara Kerja Sistem Kami
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Teknologi AI canggih yang memudahkan Anda menemukan foto dalam sekejap
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div 
              key={index}
              className="bg-gray-50 rounded-2xl p-8 text-center relative border border-gray-200 hover:shadow-lg transition-all duration-300"
            >
              <div className="absolute top-6 left-6 text-2xl font-bold text-gray-300">
                {step.number}
              </div>
              <div className="text-6xl mb-6">{step.icon}</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                {step.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}