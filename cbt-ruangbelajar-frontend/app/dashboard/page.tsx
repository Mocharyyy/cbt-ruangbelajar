'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface UserData {
  id: number | string;
  nama: string;
  email?: string;
  sekolah?: string;
  kelas_id?: number | string;
  tingkat_kelas?: number | string;
  jenjang?: string;
}

interface ExamPackage {
  id: number | string;
  judul?: string;
  judul_ujian?: string;
  mapel: string;
  jenjang?: string;
  kode?: string;
  deskripsi?: string;
  durasi?: number;
}

function resolveJenjang(rawKelas?: number | string, rawJenjang?: string): 'SD' | 'SMP' | 'SMA' {
  const jenjangUpper = (rawJenjang || '').trim().toUpperCase();
  if (jenjangUpper.includes('SD') || jenjangUpper.includes('MI')) return 'SD';
  if (jenjangUpper.includes('SMP') || jenjangUpper.includes('MTS')) return 'SMP';
  if (jenjangUpper.includes('SMA') || jenjangUpper.includes('SMK') || jenjangUpper.includes('MA')) {
    return 'SMA';
  }

  const kelasNum = Number(rawKelas);
  if (!Number.isNaN(kelasNum)) {
    if (kelasNum <= 6) return 'SD';
    if (kelasNum <= 9) return 'SMP';
    return 'SMA';
  }

  return 'SMP';
}

function getFallbackExamsByJenjang(jenjang: 'SD' | 'SMP' | 'SMA'): ExamPackage[] {
  if (jenjang === 'SD') {
    return [
      { id: 1, judul_ujian: 'Paket 1 Matematika (SD)', mapel: 'Matematika', jenjang: 'SD', deskripsi: 'Latihan Soal & Pemahaman Konsep SD', durasi: 90 },
      { id: 2, judul_ujian: 'Paket 1 Bahasa Indonesia (SD)', mapel: 'Bahasa Indonesia', jenjang: 'SD', deskripsi: 'Literasi Bahasa & Pemahaman Bacaan SD', durasi: 90 },
      { id: 3, judul_ujian: 'Paket 1 IPAS (SD)', mapel: 'IPAS', jenjang: 'SD', deskripsi: 'Ilmu Pengetahuan Alam & Sosial SD', durasi: 90 },
    ];
  }

  if (jenjang === 'SMP') {
    return [
      { id: 4, judul_ujian: 'Paket 1 Matematika (SMP)', mapel: 'Matematika', jenjang: 'SMP', deskripsi: 'Latihan Soal & Penalaran Matematika SMP', durasi: 90 },
      { id: 5, judul_ujian: 'Paket 1 Bahasa Indonesia (SMP)', mapel: 'Bahasa Indonesia', jenjang: 'SMP', deskripsi: 'Literasi & Analisis Teks SMP', durasi: 90 },
      { id: 6, judul_ujian: 'Paket 1 IPA (SMP)', mapel: 'IPA', jenjang: 'SMP', deskripsi: 'Fisika, Biologi & Kimia Tingkat SMP', durasi: 90 },
      { id: 7, judul_ujian: 'Paket 1 Bahasa Inggris (SMP)', mapel: 'Bahasa Inggris', jenjang: 'SMP', deskripsi: 'Reading Comprehension & Grammar SMP', durasi: 90 },
    ];
  }

  return [
    { id: 8, judul_ujian: 'Paket 1 Matematika (SMA/SMK)', mapel: 'Matematika', jenjang: 'SMA', deskripsi: 'Latihan Soal & Penalaran Matematika SMA/SMK', durasi: 90 },
    { id: 9, judul_ujian: 'Paket 1 Bahasa Indonesia (SMA/SMK)', mapel: 'Bahasa Indonesia', jenjang: 'SMA', deskripsi: 'Literasi & Pemahaman Bacaan SMA/SMK', durasi: 90 },
    { id: 10, judul_ujian: 'Paket 1 Bahasa Inggris (SMA/SMK)', mapel: 'Bahasa Inggris', jenjang: 'SMA', deskripsi: 'Reading & Bahasa Inggris Tingkat SMA/SMK', durasi: 90 },
  ];
}

function filterExamsByJenjang(exams: ExamPackage[], jenjang: 'SD' | 'SMP' | 'SMA'): ExamPackage[] {
  const matches = exams.filter((exam) => {
    const combined = `${exam.jenjang || ''} ${exam.kode || ''} ${exam.judul_ujian || ''} ${exam.judul || ''} ${exam.mapel || ''}`.toUpperCase();

    if (jenjang === 'SD') {
      return combined.includes('SD') || combined.includes('MI') || combined.includes('IPAS');
    }
    if (jenjang === 'SMP') {
      return (
        (combined.includes('SMP') || combined.includes('MTS')) &&
        !combined.includes('SD') &&
        !combined.includes('SMA') &&
        !combined.includes('SMK')
      );
    }
    return (
      (combined.includes('SMA') || combined.includes('SMK') || combined.includes('MA')) &&
      !combined.includes('SMP') &&
      !combined.includes('SD')
    );
  });

  return matches;
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
          router.push('/');
          return;
        }

        const parsedUser = JSON.parse(savedUser) as UserData;
        const initialTingkat = parsedUser.tingkat_kelas ?? parsedUser.kelas_id ?? '';
        const initialJenjang = resolveJenjang(initialTingkat, parsedUser.jenjang);

        setUser({
          ...parsedUser,
          tingkat_kelas: initialTingkat || parsedUser.tingkat_kelas || '',
          jenjang: parsedUser.jenjang || initialJenjang,
        });

        const queryParams = new URLSearchParams();
        if (parsedUser.id !== undefined && parsedUser.id !== null) {
          queryParams.set('user_id', String(parsedUser.id));
        }
        if (initialTingkat !== '') {
          queryParams.set('kelas_id', String(initialTingkat));
          queryParams.set('tingkat_kelas', String(initialTingkat));
        }
        queryParams.set('jenjang', initialJenjang);

        const res = await fetch(`/api/exams?${queryParams.toString()}`);
        const data = await res.json();

        const resolvedTingkat =
          data?.user?.tingkat_kelas ??
          data?.user?.kelas_id ??
          initialTingkat;
        const activeJenjang = resolveJenjang(
          resolvedTingkat,
          data?.user?.jenjang ?? parsedUser.jenjang
        );

        const updatedUser: UserData = {
          ...parsedUser,
          nama: data?.user?.nama || parsedUser.nama,
          tingkat_kelas: resolvedTingkat || parsedUser.tingkat_kelas || '',
          jenjang: data?.user?.jenjang || activeJenjang,
          sekolah: data?.user?.sekolah || parsedUser.sekolah,
        };
        setUser(updatedUser);
        localStorage.setItem('studentUser', JSON.stringify(updatedUser));

        const rawExams: ExamPackage[] = Array.isArray(data?.exams)
          ? data.exams
          : Array.isArray(data?.data)
          ? data.data
          : [];

        const filteredExams = filterExamsByJenjang(rawExams, activeJenjang);

        if (res.ok && data?.success && filteredExams.length > 0) {
          setExamList(filteredExams);
        } else {
          setExamList(getFallbackExamsByJenjang(activeJenjang));
        }
      } catch (err) {
        console.error('Gagal memuat dashboard:', err);
        const fallbackJenjang = resolveJenjang(user?.tingkat_kelas ?? user?.kelas_id, user?.jenjang);
        setExamList(getFallbackExamsByJenjang(fallbackJenjang));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleMulaiUjian = (examId: number | string) => {
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