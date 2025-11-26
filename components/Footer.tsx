import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center space-x-2 mb-6">
              <Image
                src="/logo.png"
                alt="Logo"
                width={92}
                height={62}
                className="text-white"
              />
            </Link>
            <p className="text-gray-400 mb-6 leading-relaxed">
              Platform pencarian foto berbasis AI yang membantu Anda menemukan
              momen berharga dari berbagai event.
            </p>
            <div className="flex space-x-4">
              {["Instagram", "Twitter", "Facebook", "LinkedIn"].map(
                (social) => (
                  <a
                    key={social}
                    href="#"
                    className="text-gray-400 hover:text-white transition-colors duration-200"
                  >
                    {social}
                  </a>
                )
              )}
            </div>
          </div>

          {/* Links */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h4 className="font-semibold text-lg mb-4">Perusahaan</h4>
              <div className="space-y-2">
                {["Tentang Kami", "Karir", "Blog", "Partner"].map((link) => (
                  <a
                    key={link}
                    href="#"
                    className="block text-gray-400 hover:text-white transition-colors duration-200"
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-lg mb-4">Layanan</h4>
              <div className="space-y-2">
                {["Pencarian Foto", "Fotografer", "Event Organizer", "API"].map(
                  (link) => (
                    <a
                      key={link}
                      href="#"
                      className="block text-gray-400 hover:text-white transition-colors duration-200"
                    >
                      {link}
                    </a>
                  )
                )}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-lg mb-4">Bantuan</h4>
              <div className="space-y-2">
                {[
                  "Pusat Bantuan",
                  "Kontak",
                  "Privasi",
                  "Syarat & Ketentuan",
                ].map((link) => (
                  <a
                    key={link}
                    href="#"
                    className="block text-gray-400 hover:text-white transition-colors duration-200"
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm">
            &copy; 2023 Sehat87. Semua hak dilindungi.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            {["Privasi", "Syarat", "Cookies"].map((link) => (
              <a
                key={link}
                href="#"
                className="text-gray-400 hover:text-white text-sm transition-colors duration-200"
              >
                {link}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
