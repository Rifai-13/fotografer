"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { toast } from 'sonner'
import Image from 'next/image'

export default function CreateEventPage() {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    date: '',
    location: ''
  })
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        toast.error('Anda harus login untuk membuat event')
        router.push('/login')
        return
      }

      const { error } = await supabase.from('events').insert({
        photographer_id: user.id,
        name: formData.name,
        description: formData.description,
        date: formData.date,
        location: formData.location,
        status: 'active'
      })

      if (error) {
        throw new Error(error.message)
      }

      toast.success('Event berhasil dibuat')
      router.push('/dashboard')
    } catch (error: any) {
      toast.error('Gagal membuat event', {
        description: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleExit = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 py-8">
      <div className="container mx-auto px-4 sm:px-6">
        <Card className="max-w-2xl mx-auto border border-blue-200/60 shadow-lg rounded-2xl bg-white/80 backdrop-blur-sm relative overflow-hidden">
          {/* Background Decorative Elements */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-600"></div>
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-100 rounded-full opacity-50"></div>
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-200 rounded-full opacity-30"></div>

          {/* Exit Button */}
          <button
            onClick={handleExit}
            className="absolute top-6 left-6 w-10 h-10 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-full flex items-center justify-center transition-all duration-200 z-50 group cursor-pointer"
            aria-label="Kembali ke dashboard"
            type="button"
          >
            <svg 
              className="w-5 h-5 text-blue-600 group-hover:text-blue-700" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M10 19l-7-7m0 0l7-7m-7 7h18" 
              />
            </svg>
          </button>

          <CardHeader className="text-center space-y-1 p-8 pb-4 relative z-10">
            {/* Logo Section */}
            <div className="flex justify-center mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-24 h-20 bg-gradient-to-br rounded-xl flex items-center justify-center shadow-lg">
                  <Image
                    src="/logo.png"
                    alt="Logo"
                    width={92}
                    height={32}
                    className="text-white"
                  />
                </div>
              </div>
            </div>
            
            <CardTitle className="text-2xl font-bold text-blue-900">
              Buat Event Baru
            </CardTitle>
            <CardDescription className="text-blue-600/80">
              Isi detail event untuk mulai mengumpulkan foto
            </CardDescription>
          </CardHeader>

          <CardContent className="p-8 pt-2 relative z-10">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="text-sm font-medium text-blue-900 mb-2 block">
                  Nama Event *
                </label>
                <Input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Contoh: Event Lari 10K Jakarta 2024"
                  required
                  className="w-full h-11 text-sm border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white/50"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-blue-900 mb-2 block">
                  Deskripsi
                </label>
                <Textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Deskripsi event, lokasi detail, dan informasi penting lainnya..."
                  rows={4}
                  className="w-full text-sm border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white/50 resize-none"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-blue-900 mb-2 block">
                  Tanggal Event *
                </label>
                <Input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                  className="w-full h-11 text-sm border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white/50"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-blue-900 mb-2 block">
                  Lokasi *
                </label>
                <Input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="Contoh: Gelora Bung Karno, Jakarta"
                  required
                  className="w-full h-11 text-sm border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white/50"
                />
              </div>

              <div className="flex space-x-4 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/dashboard')}
                  className="flex-1 h-11 border-2 border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-11 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-sm font-semibold rounded-lg shadow-lg shadow-blue-500/25 hover:shadow-blue-600/25 transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:transform-none"
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Membuat Event...</span>
                    </div>
                  ) : (
                    "Buat Event"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}