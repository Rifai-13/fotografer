// app/dashboard/page.tsx
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
  actual_photo_count: number
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
        
        // Check session dengan timeout
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error("Session error:", sessionError)
          toast.error("Error checking session")
          router.push('/login')
          return
        }

        if (!session) {
          console.log("❌ No session found, redirecting to login")
          toast.error("Silakan login terlebih dahulu")
          router.push('/login')
          return
        }

        // Get user dari session
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError || !user) {
          console.error("User error:", userError)
          toast.error("Error mendapatkan user data")
          router.push('/login')
          return
        }

        setUser(user)
        setAuthChecked(true)

        // Fetch events menggunakan RPC function yang dioptimalkan
        console.log("📦 Fetching events with optimized query for user:", user.id)
        const { data: eventsData, error: eventsError } = await supabase
          .rpc('get_photographer_events', { p_photographer_id: user.id })

        if (eventsError) {
          console.error('Error fetching events:', eventsError)
          // Fallback ke query biasa jika RPC tidak tersedia
          await fetchEventsWithFallback(user.id)
        } else {
          console.log("🎉 Events loaded via RPC:", eventsData?.length || 0)
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

    // Fallback function jika RPC tidak tersedia
    const fetchEventsWithFallback = async (userId: string) => {
      try {
        const { data: eventsData, error: eventsError } = await supabase
          .from('events')
          .select('*')
          .eq('photographer_id', userId)
          .order('created_at', { ascending: false })

        if (eventsError) {
          throw eventsError
        }

        // Ambil photo count untuk setiap event (masih lebih baik daripada N+1 queries)
        const eventsWithCounts = await Promise.all(
          (eventsData || []).map(async (event) => {
            const { count } = await supabase
              .from('photos')
              .select('*', { count: 'exact', head: true })
              .eq('event_id', event.id)

            return {
              ...event,
              actual_photo_count: count || 0
            }
          })
        )

        setEvents(eventsWithCounts)
      } catch (error) {
        console.error('Fallback also failed:', error)
        toast.error('Gagal memuat event')
        setEvents([])
      }
    }

    checkAuthAndFetchData()
  }, [router, supabase])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      toast.success('Logout berhasil')
      window.location.href = '/'
    } catch (error) {
      console.error('Logout error:', error)
      toast.error('Gagal logout')
    }
  }

  // Refresh events data
  const refreshEvents = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const { data: eventsData, error } = await supabase
        .rpc('get_photographer_events', { p_photographer_id: user.id })

      if (!error) {
        setEvents(eventsData || [])
        toast.success('Data diperbarui')
      }
    } catch (error) {
      console.error('Refresh error:', error)
    } finally {
      setLoading(false)
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
              Kelola event dan foto-foto Anda • Total: {events.length} event
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
              <Card key={event.id} className="hover:shadow-lg transition-shadow duration-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg line-clamp-1">{event.name}</CardTitle>
                  <CardDescription className="line-clamp-1">
                    {new Date(event.date).toLocaleDateString('id-ID')} • {event.location}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {event.description || 'Tidak ada deskripsi'}
                  </p>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">
                        {event.actual_photo_count} foto
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      <Link href={`/dashboard/events/${event.id}/upload`}>
                        <Button size="sm" variant="outline">
                          Upload
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