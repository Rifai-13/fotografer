"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { toast } from 'sonner'

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

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 sm:px-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Buat Event Baru</CardTitle>
            <CardDescription>
              Isi detail event untuk mulai mengumpulkan foto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Nama Event *
                </label>
                <Input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Contoh: Event Lari 10K Jakarta 2024"
                  required
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Deskripsi
                </label>
                <Textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Deskripsi event, lokasi detail, dan informasi penting lainnya..."
                  rows={4}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Tanggal Event *
                </label>
                <Input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Lokasi *
                </label>
                <Input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="Contoh: Gelora Bung Karno, Jakarta"
                  required
                  className="w-full"
                />
              </div>

              <div className="flex space-x-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/dashboard')}
                  className="flex-1"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-primary hover:bg-primary/90"
                >
                  {loading ? 'Membuat...' : 'Buat Event'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}