'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface UserData {
  id: number;
  nama: string;
  email: string;
  sekolah: string;
  tingkat_kelas: number | string;
  jenjang?: string;
}

interface ExamPackage {
  id: number;
  judul?: string;
  judul_ujian?: string;
  mapel: string;
  deskripsi?: string;
  durasi?: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [examList, setExamList] = useState<ExamPackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const savedUser = localStorage.getItem('studentUser') || localStorage.getItem('user');
        if (!savedUser) {
          router.push('/login');
          return;
        }

        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);

        const res = await fetch(`http://localhost:5000/api/exams?user_id=${parsedUser.id}`);
        const data = await res.json();
        
        if (data.success) {
          const fetchedExams = data.exams || [];
          
          if (fetchedExams.length === 0) {
            const tingkat = Number(data.user?.tingkat_kelas || parsedUser.tingkat_kelas || 6);
            if (tingkat <= 6) {
              setExamList([
                { id: 1, judul_ujian: 'Paket 1 Latihan Matematika Utama', mapel: 'Matematika', deskripsi: 'Tes Kemampuan Akademik (TKA)', durasi: 90 },
                { id: 2, judul_ujian: 'Paket 1 Latihan Bahasa Indonesia', mapel: 'Bahasa Indonesia', deskripsi: 'Literasi Bahasa & Pemahaman Bacaan', durasi: 90 },
                { id: 3, judul_ujian: 'Paket 1 Latihan IPAS', mapel: 'IPAS', deskripsi: 'Pemahaman Konsep IPA & IPS', durasi: 90 },
              ]);
            } else {
              setExamList([
                { id: 1, judul_ujian: 'Paket 1 Latihan Matematika Utama', mapel: 'Matematika', deskripsi: 'Tes Kemampuan Akademik (TKA)', durasi: 90 },
                { id: 2, judul_ujian: 'Paket 1 Latihan Bahasa Indonesia', mapel: 'Bahasa Indonesia', deskripsi: 'Literasi Bahasa & Pemahaman Bacaan', durasi: 90 },
                { id: 3, judul_ujian: 'Paket 1 Latihan IPA', mapel: 'IPA', deskripsi: 'Sains & Konsep Alam', durasi: 90 },
                { id: 4, judul_ujian: 'Paket 1 Latihan Bahasa Inggris', mapel: 'Bahasa Inggris', deskripsi: 'Reading & Grammar', durasi: 90 },
              ]);
            }
          } else {
            setExamList(fetchedExams);
          }

          if (data.user) {
            const updated = {
              ...parsedUser,
              nama: data.user.nama || parsedUser.nama,
              tingkat_kelas: data.user.tingkat_kelas || parsedUser.tingkat_kelas,
              jenjang: data.user.jenjang || parsedUser.jenjang,
              sekolah: data.user.sekolah || parsedUser.sekolah
            };
            setUser(updated);
            localStorage.setItem('studentUser', JSON.stringify(updated));
          }
        }
      } catch (err) {
        console.error('Gagal memuat dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleMulaiUjian = (examId: number) => {
    router.push(`/exam?exam_id=${examId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="font-bold text-emerald-600 animate-pulse text-lg">Memuat Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-700 text-white font-black flex items-center justify-center text-lg shadow">
              RB
            </div>
            <div>
              <h1 className="font-extrabold text-blue-900 leading-tight">CBT RUANG BELAJAR</h1>
              <p className="text-xs text-slate-500 font-medium">Portal Ujian & Simulasi Online</p>
            </div>
          </div>

          {user && (
            <div className="text-right">
              <span className="block font-bold text-slate-700 text-sm">{user.nama}</span>
              <span className="text-xs text-slate-500">
                {user.sekolah || 'Siswa'} {user.tingkat_kelas ? `(Kelas ${user.tingkat_kelas})` : ''}
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full px-6 py-8 flex-1">
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-800 rounded-3xl p-8 text-white mb-8 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="relative z-10">
            <span className="inline-block px-3 py-1 bg-blue-500/30 backdrop-blur-md rounded-full text-xs font-semibold text-blue-200 mb-3 border border-blue-400/30">
              Computer Based Test {user?.jenjang ? `(${user.jenjang})` : ''}
            </span>
            <h2 className="text-3xl font-extrabold mb-2">
              Halo, <span className="text-yellow-300">{user?.nama || 'Siswa'}!</span> 👋
            </h2>
            <p className="text-blue-100 max-w-xl text-sm leading-relaxed">
              Selamat datang di sistem latihan ujian. Silakan pilih paket mata pelajaran sesuai jenjang kelas kamu di bawah ini (90 Menit • 50 Soal).
            </p>
          </div>

          <div className="mt-6 md:mt-0 relative z-10">
            <Link 
              href="/leaderboard" 
              className="bg-white/20 hover:bg-white/30 text-white font-bold py-3 px-6 rounded-2xl backdrop-blur-md transition flex items-center space-x-2 border border-white/30 shadow-sm"
            >
              <span>🏆</span>
              <span>Papan Peringkat</span>
            </Link>
          </div>

          <div className="absolute right-[-20px] bottom-[-40px] opacity-15 font-black text-9xl text-white select-none pointer-events-none">
            CBT
          </div>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-800">Daftar Paket Soal Tersedia</h3>
            <p className="text-xs text-slate-500">Pilihlah salah satu paket di bawah untuk memulai sesi pengerjaan.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {examList.map((exam) => (
            <div
              key={exam.id}
              className="bg-white rounded-3xl border border-slate-200 hover:border-blue-400 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-200 group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-100 text-blue-700">
                    {exam.mapel}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold flex items-center space-x-1">
                    <span>⏱️</span> <span>{exam.durasi || 90} Menit</span>
                  </span>
                </div>

                <div className="flex items-start gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-600 text-white font-bold text-xl flex items-center justify-center shrink-0 shadow-md">
                    📚
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors leading-snug">
                      {exam.judul_ujian || exam.judul}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {exam.deskripsi || 'Simulasi Ujian Berbasis Komputer (50 Soal)'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-4">
                <button
                  onClick={() => handleMulaiUjian(exam.id)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-2xl transition duration-200 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <span>Mulai Kerjakan</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        © 2026 Bimbel Ruang Belajar • Tryout CBT System
      </footer>
    </div>
  );
}