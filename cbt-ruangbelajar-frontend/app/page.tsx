'use client';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import React, { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';

// Mengambil URL Backend dari Environment Variable Vercel
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function LoginPageContent() {
  const router = useRouter();

  // Form Input States
  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [sekolah, setSekolah] = useState('');
  const [kelasId, setKelasId] = useState('12');

  // Multi-step & Status States
  const [step, setStep] = useState<1 | 2>(1);
  const [generatedPasscode, setGeneratedPasscode] = useState('');
  const [inputPasscode, setInputPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Handle Step 1: Registrasi & Dapatkan Passcode
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${API_URL}/api/student/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama, email, sekolah, kelas_id: kelasId }),
      });

      const data = await res.json();

      if (data.success) {
        setGeneratedPasscode(data.data.passcode);
        setStep(2); // Pindah ke Langkah 2 (Input Passcode)
      } else {
        setErrorMsg(data.message || 'Gagal meregistrasi siswa');
      }
    } catch (err) {
      console.error('Error Register:', err);
      setErrorMsg('Gagal terhubung ke server backend');
    } finally {
      setLoading(false);
    }
  };

  // Handle Step 2: Verifikasi Passcode & Masuk Dashboard
  const handleVerifyAndLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${API_URL}/api/student/verify-passcode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, passcode: inputPasscode.trim().toUpperCase() }),
      });

      const data = await res.json();

      if (data.success) {
        // Simpan data user di localStorage untuk sesi login
        localStorage.setItem('studentUser', JSON.stringify(data.data));
        // Redirect ke Halaman Dashboard Ujian
        router.push('/dashboard');
      } else {
        setErrorMsg(data.message || 'Passcode salah!');
      }
    } catch (err) {
      console.error('Error Verifikasi:', err);
      setErrorMsg('Gagal terhubung ke server backend');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-blue-600 flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-blue-900 tracking-wide">TRYOUT KESIAPAN TKA</h1>
          <p className="text-xs text-slate-500 font-semibold mt-1">Bimbel Ruang Belajar</p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-semibold text-center">
            {errorMsg}
          </div>
        )}

        {/* --- STEP 1: FORM REGISTRASI --- */}
        {step === 1 && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Nama Lengkap
              </label>
              <input
                type="text"
                required
                placeholder="Masukkan nama lengkap"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-600 text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Email
              </label>
              <input
                type="email"
                required
                placeholder="contoh@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-600 text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Asal Sekolah
              </label>
              <input
                type="text"
                required
                placeholder="Nama Sekolah / Madrasah"
                value={sekolah}
                onChange={(e) => setSekolah(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-600 text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Tingkat Kelas
              </label>
              <select
                value={kelasId}
                onChange={(e) => setKelasId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-600 bg-white text-slate-800"
              >
                <option value="12">Kelas 12 (SMA / SMK / MA)</option>
                <option value="9">Kelas 9 (SMP / MTS)</option>
                <option value="6">Kelas 6 (SD / MIN)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl text-sm transition mt-2 shadow-lg shadow-blue-500/30 disabled:opacity-50"
            >
              {loading ? 'Memproses...' : 'Lanjut & Dapatkan Passcode Ujian'}
            </button>
          </form>
        )}

        {/* --- STEP 2: VERIFIKASI PASSCODE --- */}
        {step === 2 && (
          <form onSubmit={handleVerifyAndLogin} className="space-y-5">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
              <span className="text-xs text-amber-800 font-bold block mb-1">
                PASSCODE / TOKEN AKSES ANDA:
              </span>
              <div className="text-3xl font-black text-amber-900 tracking-wider my-2 font-mono select-all">
                {generatedPasscode}
              </div>
              <p className="text-[11px] text-amber-700">
                Catat/salin passcode acak di atas untuk masuk ke dalam sesi pengerjaan ujian.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1 text-center">
                Masukkan Passcode Di Atas
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: TK8F2A"
                value={inputPasscode}
                onChange={(e) => setInputPasscode(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-center font-mono tracking-widest uppercase font-bold focus:outline-none focus:border-blue-600 text-slate-800"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setErrorMsg('');
                }}
                className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl text-xs transition"
              >
                Kembali
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-2/3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-xs transition shadow-lg shadow-emerald-500/30 disabled:opacity-50"
              >
                {loading ? 'Memeriksa...' : 'Masuk Dashboard Ujian →'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// Komponen pembungkus Suspense agar aman saat di-build oleh Vercel
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-bold text-slate-600">Memuat halaman...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}