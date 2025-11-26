"use client"

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Image from "next/image";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  const handleExit = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    console.log("Exit button clicked")
    router.push("/")
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      console.log("🔄 Attempting login with:", email)
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error("❌ Login error:", error)
        toast.error("Login gagal", {
          description: error.message,
        })
        return
      }

      if (data.user && data.session) {
        console.log("✅ Login successful, user:", data.user)
        console.log("🔑 Session:", data.session)
        
        // Force session refresh and wait for it
        await supabase.auth.setSession(data.session)
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        console.log("🔄 Current session after set:", currentSession)

        toast.success("Login berhasil", {
          description: "Mengarahkan ke dashboard...",
        })

        // Method 1: Use window.location for guaranteed redirect
        setTimeout(() => {
          window.location.href = "/dashboard"
        }, 1000)
      }
    } catch (error: any) {
      console.error("❌ Unexpected error:", error)
      toast.error("Terjadi kesalahan", {
        description: error.message || "Terjadi kesalahan yang tidak terduga",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={cn(
        "min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center p-6",
        className
      )}
      {...props}
    >
      <Card className="w-full max-w-md border border-blue-200/60 shadow-lg rounded-2xl bg-white/80 backdrop-blur-sm relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-600"></div>
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-100 rounded-full opacity-50"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-200 rounded-full opacity-30"></div>

        {/* Exit Button - FIXED */}
        <button
          onClick={handleExit}
          className="absolute top-6 left-6 w-10 h-10 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-full flex items-center justify-center transition-all duration-200 z-50 group cursor-pointer"
          aria-label="Kembali ke beranda"
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
            Masuk ke Akun
          </CardTitle>
          <CardDescription className="text-blue-600/80">
            Selamat datang kembali! Silakan masuk ke akun Anda.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-8 pt-2 relative z-10">
          <form onSubmit={handleLogin}>
            <FieldGroup className="space-y-4">
              <Field>
                <FieldLabel
                  htmlFor="email"
                  className="text-sm font-medium text-blue-900"
                >
                  Email
                </FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@contoh.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 text-sm border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white/50"
                />
              </Field>

              <Field>
                <FieldLabel
                  htmlFor="password"
                  className="text-sm font-medium text-blue-900"
                >
                  Password
                </FieldLabel>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-11 text-sm border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white/50 pr-12"
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-blue-400 hover:text-blue-600 transition-colors"
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </Field>

              <Field className="pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-sm font-semibold rounded-lg shadow-lg shadow-blue-500/25 hover:shadow-blue-600/25 transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:transform-none"
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Memproses...</span>
                    </div>
                  ) : (
                    "Masuk ke Dashboard"
                  )}
                </Button>
              </Field>

              {/* Fixed: Replace nested p elements with div */}
              <div className="text-center space-y-3 pt-4">
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline block transition-colors"
                >
                  Lupa password?
                </Link>
                
                <div className="border-t border-blue-200 pt-4">
                  <div className="text-xs text-blue-600/80">
                    Belum punya akun?{" "}
                    <Link
                      href="/signup"
                      className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                    >
                      Daftar sekarang
                    </Link>
                  </div>
                </div>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}