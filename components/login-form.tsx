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

        // Method 2: Alternative router approach with refresh
        // router.push("/dashboard")
        // router.refresh()

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
        "min-h-screen bg-background flex items-center justify-center p-6",
        className
      )}
      {...props}
    >
      <Card className="w-full max-w-md border border-border/40 shadow-sm rounded-xl bg-card relative">
        {/* Exit Button */}
        <button
          onClick={() => router.push("/")}
          className="absolute top-6 left-6 w-10 h-10 bg-muted hover:bg-muted/80 rounded-full flex items-center justify-center transition-colors duration-200 z-10"
          aria-label="Kembali ke beranda"
        >
          <svg 
            className="w-5 h-5 text-muted-foreground" 
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

        <CardHeader className="text-center space-y-1 p-6 pb-2">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center">
              <span className="text-white text-lg">📸</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-light text-card-foreground">
            Masuk ke Akun
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Selamat datang kembali! Silakan masuk ke akun Anda.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <form onSubmit={handleLogin}>
            <FieldGroup className="space-y-2">
              <Field>
                <FieldLabel
                  htmlFor="email"
                  className="text-xs font-medium text-muted-foreground"
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
                  className="w-full h-9 text-sm border border-input rounded-md"
                />
              </Field>

              <Field>
                <FieldLabel
                  htmlFor="password"
                  className="text-xs font-medium text-muted-foreground"
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
                    className="w-full h-9 text-sm border border-input rounded-md pr-10"
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </Field>

              <Field className="pt-1">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-md"
                >
                  {loading ? "Masuk..." : "Lanjutkan"}
                </Button>
              </Field>

              <FieldDescription className="text-center text-xs text-muted-foreground pt-3">
                <Link
                  href="/forgot-password"
                  className="font-medium text-primary hover:underline block mb-2"
                >
                  Lupa password?
                </Link>
                Belum punya akun?{" "}
                <Link
                  href="/signup"
                  className="text-primary font-medium hover:underline"
                >
                  Daftar
                </Link>
              </FieldDescription>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}