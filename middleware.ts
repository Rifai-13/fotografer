// middleware.ts
import { createClient } from '@/lib/supabase/middleware' // Impor dari helper middleware
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { supabase, response } = createClient(request)

  // Ini akan me-refresh session (cookie) jika sudah expired
  const { data: { session } } = await supabase.auth.getSession()

  const hasAuth = !!session

  const { pathname } = request.nextUrl

  console.log('🛡️ Supabase Middleware - Path:', pathname)
  console.log('🛡️ Supabase Middleware - Has session:', hasAuth)

  // Logika redirect-mu (ini sudah benar, hanya ganti var `hasAuth`)
  if (!hasAuth && pathname.startsWith('/dashboard')) {
    console.log('🛡️ Redirecting to login (no session)')
    const url = new URL(request.url)
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (hasAuth && (pathname.startsWith('/login') || pathname.startsWith('/signup'))) {
    console.log('🛡️ Redirecting to dashboard (has session)')
    const url = new URL(request.url)
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup'],
}