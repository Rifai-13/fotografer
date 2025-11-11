"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from 'sonner'
import Link from 'next/link'

interface Event {
  id: string
  name: string
  description: string
  date: string
  location: string
  status: string
  photo_count: number
  created_at: string
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      try {
        console.log("🔍 Checking authentication...")
        
        // Check if we have a session first
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error("Session error:", sessionError)
          toast.error("Error checking session")
          router.push('/login')
          return
        }

        console.log("📋 Session found:", session)

        if (!session) {
          console.log("❌ No session found, redirecting to login")
          toast.error("Silakan login terlebih dahulu")
          router.push('/login')
          return
        }

        // Get user from session
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError) {
          console.error("User error:", userError)
          toast.error("Error mendapatkan user data")
          router.push('/login')
          return
        }

        console.log("✅ User authenticated:", user)

        if (!user) {
          console.log("❌ No user found, redirecting to login")
          toast.error("User tidak ditemukan")
          router.push('/login')
          return
        }

        setUser(user)
        setAuthChecked(true)

        // Fetch events created by this photographer
        console.log("📦 Fetching events for user:", user.id)
        const { data: eventsData, error: eventsError } = await supabase
          .from('events')
          .select('*')
          .eq('photographer_id', user.id)
          .order('created_at', { ascending: false })

        if (eventsError) {
          console.error('Error fetching events:', eventsError)
          toast.error('Gagal memuat event')
        } else {
          console.log("🎉 Events loaded:", eventsData?.length || 0)
          setEvents(eventsData || [])
        }

      } catch (error) {
        console.error('Unexpected error:', error)
        toast.error('Terjadi kesalahan sistem')
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    checkAuthAndFetchData()
  }, [router, supabase])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      toast.success('Logout berhasil')
      // Use window.location to ensure complete logout and redirect
      window.location.href = '/'
    } catch (error) {
      console.error('Logout error:', error)
      toast.error('Gagal logout')
    }
  }

  // Show loading only if we're still checking auth
  if (loading && !authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Memeriksa autentikasi...</p>
        </div>
      </div>
    )
  }

  // If auth check is done but no user, don't show content
  if (!user && authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Mengarahkan ke login...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="text-2xl">📸</div>
              <span className="text-2xl font-bold text-card-foreground">
                Foto<span className="text-primary">AI</span> Dashboard
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                Halo, {user?.user_metadata?.full_name || user?.email || 'Fotografer'}
              </span>
              <Button 
                onClick={handleLogout}
                variant="outline"
                size="sm"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-card-foreground mb-2">
              Event Saya
            </h1>
            <p className="text-muted-foreground">
              Kelola event dan foto-foto Anda
            </p>
          </div>
          <Link href="/dashboard/events/create">
            <Button className="bg-primary hover:bg-primary/90">
              + Buat Event Baru
            </Button>
          </Link>
        </div>

        {/* Events Grid */}
        {events.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <div className="text-6xl mb-4">📷</div>
              <h3 className="text-xl font-semibold text-card-foreground mb-2">
                Belum ada event
              </h3>
              <p className="text-muted-foreground mb-6">
                Mulai dengan membuat event pertama Anda
              </p>
              <Link href="/dashboard/events/create">
                <Button className="bg-primary hover:bg-primary/90">
                  Buat Event Pertama
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <Card key={event.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">{event.name}</CardTitle>
                  <CardDescription>
                    {new Date(event.date).toLocaleDateString('id-ID')} • {event.location}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {event.description}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {event.photo_count} foto
                    </span>
                    <div className="flex space-x-2">
                      <Link href={`/dashboard/events/${event.id}/upload`}>
                        <Button size="sm" variant="outline">
                          Upload Foto
                        </Button>
                      </Link>
                      <Link href={`/dashboard/events/${event.id}/manage`}>
                        <Button size="sm">
                          Kelola
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}