"use client";

import type React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { toast } from "sonner";

export default function SignupForm() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    whatsappNumber: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = "Email harus diisi";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Format email tidak valid";
    }

    if (!formData.password) {
      newErrors.password = "Password harus diisi";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password minimal 6 karakter";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Password tidak cocok";
    }

    if (!formData.fullName) {
      newErrors.fullName = "Nama lengkap harus diisi";
    }

    if (!formData.whatsappNumber) {
      newErrors.whatsappNumber = "Nomor WhatsApp harus diisi";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Harap perbaiki error pada form");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Mendaftarkan akun...");

    try {
      // Register user dengan Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: formData.fullName,
            whatsapp_number: formData.whatsappNumber,
          },
        },
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (authData.user) {
        console.log("✅ Auth user created:", authData.user.id);

        // TIDAK PERLU INSERT MANUAL LAGI - SUDAH DITANGANI OLEH TRIGGER
        // Trigger akan otomatis membuat record di tabel users

        toast.success("Akun berhasil dibuat!", {
          description: "Silakan periksa email Anda untuk mengkonfirmasi akun.",
          id: toastId,
        });

        // Redirect setelah delay singkat
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      }
    } catch (error: any) {
      console.error("Registration error:", error);
      toast.error("Terjadi kesalahan", {
        description: error.message || "Terjadi kesalahan yang tidak terduga",
        id: toastId,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl border border-border/40 shadow-sm rounded-xl bg-card relative">
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

        <CardHeader className="text-center space-y-1 pb-8">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center">
              <span className="text-white text-lg">📸</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-light text-card-foreground">
            Daftar sebagai Fotografer
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Buat akun untuk mulai menampilkan karya Anda
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8">
          <form onSubmit={handleRegister} className="space-y-6">
            {/* Name Field */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Nama Lengkap *
              </label>
              <Input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Masukkan nama lengkap Anda"
                required
                className={`w-full h-11 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary ${
                  errors.fullName ? "border-red-500" : "border-input"
                }`}
              />
              {errors.fullName && (
                <p className="text-red-500 text-sm mt-1">{errors.fullName}</p>
              )}
            </div>

            {/* Email Field */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Email *
              </label>
              <Input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="nama@email.com"
                required
                className={`w-full h-11 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary ${
                  errors.email ? "border-red-500" : "border-input"
                }`}
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email}</p>
              )}
            </div>

            {/* WhatsApp Number Field */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Nomor WhatsApp *
              </label>
              <Input
                type="tel"
                name="whatsappNumber"
                value={formData.whatsappNumber}
                onChange={handleChange}
                placeholder="+6281234567890"
                required
                className={`w-full h-11 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary ${
                  errors.whatsappNumber ? "border-red-500" : "border-input"
                }`}
              />
              {errors.whatsappNumber && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.whatsappNumber}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-2">
                Kami akan menggunakan ini untuk menghubungi Anda terkait event
                dan pembaruan.
              </p>
            </div>

            {/* Password Field */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Password *
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Buat password yang kuat"
                  required
                  minLength={6}
                  className={`w-full h-11 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary pr-10 ${
                    errors.password ? "border-red-500" : "border-input"
                  }`}
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={
                    showPassword ? "Sembunyikan password" : "Tampilkan password"
                  }
                >
                  {showPassword ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password}</p>
              )}
              <p className="text-sm text-muted-foreground mt-2">
                Minimal 6 karakter. Disarankan menggunakan kombinasi huruf,
                angka, dan simbol.
              </p>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Konfirmasi Password *
              </label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Ulangi password Anda"
                  required
                  className={`w-full h-11 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary pr-10 ${
                    errors.confirmPassword ? "border-red-500" : "border-input"
                  }`}
                />
                <button
                  type="button"
                  onClick={toggleConfirmPasswordVisibility}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={
                    showConfirmPassword
                      ? "Sembunyikan password"
                      : "Tampilkan password"
                  }
                >
                  {showConfirmPassword ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            {/* Terms Agreement */}
            <div className="flex items-start space-x-3 pt-4">
              <input
                type="checkbox"
                id="terms"
                required
                className="w-4 h-4 text-primary border-border rounded focus:ring-primary/40 mt-0.5"
              />
              <label
                htmlFor="terms"
                className="text-sm text-muted-foreground font-normal cursor-pointer"
              >
                Saya menyetujui{" "}
                <Link href="/terms" className="text-primary hover:underline">
                  Syarat & Ketentuan
                </Link>{" "}
                dan{" "}
                <Link href="/privacy" className="text-primary hover:underline">
                  Kebijakan Privasi
                </Link>
              </label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg shadow-sm hover:shadow transition-all duration-200"
            >
              {loading ? "Mendaftarkan..." : "Buat Akun"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground pt-6 border-t border-border">
            <p>
              Sudah punya akun?{" "}
              <Link
                href="/login"
                className="font-medium text-primary hover:underline"
              >
                Masuk di sini
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
