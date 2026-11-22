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
  id: string;
  judul?: string;
  judul_ujian?: string;
  mapel: 'Matematika' | 'Bahasa Indonesia' | string;
  jenjang: 'SD' | 'SMP' | 'SMA/SMK' | string;
  kode?: string;
  deskripsi?: string;
  durasi?: number;
  target_soal?: number;
}

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'https://139.190.107.150.sslip.io'
).replace(/\/+$/, '');

function resolveJenjang(
  rawKelas?: number | string,
  rawJenjang?: string
): 'SD' | 'SMP' | 'SMA/SMK' {
  const jenjangUpper = (rawJenjang || '').trim().toUpperCase();
  if (jenjangUpper.includes('SD') || jenjangUpper.includes('MI')) return 'SD';
  if (jenjangUpper.includes('SMP') || jenjangUpper.includes('MTS')) return 'SMP';
  if (
    jenjangUpper.includes('SMA') ||
    jenjangUpper.includes('SMK') ||
    jenjangUpper.includes('MA')
  ) {
    return 'SMA/SMK';
  }

  const kelasNum = Number(rawKelas);
  if (!Number.isNaN(kelasNum) && kelasNum > 0) {
    if (kelasNum <= 6) return 'SD';
    if (kelasNum <= 9) return 'SMP';
    return 'SMA/SMK';
  }

  return 'SD';
}

function getExamsByJenjang(jenjang: 'SD' | 'SMP' | 'SMA/SMK'): ExamPackage[] {
  if (jenjang === 'SD') {
    return [
      {
        id: 'sd_bindo',
        kode: 'SD-BINDO',
        judul_ujian: 'Paket Latihan Bahasa Indonesia (SD)',
        mapel: 'Bahasa Indonesia',
        jenjang: 'SD',
        deskripsi: 'Literasi Bahasa & Pemahaman Bacaan SD (50 Soal)',
        durasi: 90,
        target_soal: 50,
      },
      {
        id: 'sd_mtk',
        kode: 'SD-MTK',
        judul_ujian: 'Paket Latihan Matematika (SD)',
        mapel: 'Matematika',
        jenjang: 'SD',
        deskripsi: 'Tes Kemampuan Akademik & Matematika SD (30 Soal)',
        durasi: 90,
        target_soal: 30,
      },
    ];
  }

  if (jenjang === 'SMP') {
    return [
      {
        id: 'smp_bindo',
        kode: 'SMP-BINDO',
        judul_ujian: 'Paket Latihan Bahasa Indonesia (SMP)',
        mapel: 'Bahasa Indonesia',
        jenjang: 'SMP',
        deskripsi: 'Literasi Bahasa & Analisis Teks SMP (50 Soal)',
        durasi: 90,
        target_soal: 50,
      },
      {
        id: 'smp_mtk',
        kode: 'SMP-MTK',
        judul_ujian: 'Paket Latihan Matematika (SMP)',
        mapel: 'Matematika',
        jenjang: 'SMP',
        deskripsi: 'Tes Kemampuan Akademik & Penalaran Matematika SMP (30 Soal)',
        durasi: 90,
        target_soal: 30,
      },
    ];
  }

  return [
    {
      id: 'sma_smk_bindo',
      kode: 'SMA-BINDO',
      judul_ujian: 'Paket Latihan Bahasa Indonesia (SMA/SMK)',
      mapel: 'Bahasa Indonesia',
      jenjang: 'SMA/SMK',
      deskripsi: 'Literasi Bahasa & Pemahaman Bacaan SMA/SMK (50 Soal)',
      durasi: 90,
      target_soal: 50,
    },
    {
      id: 'sma_smk_mtk',
      kode: 'SMA-MTK',
      judul_ujian: 'Paket Latihan Matematika (SMA/SMK)',
      mapel: 'Matematika',
      jenjang: 'SMA/SMK',
      deskripsi: 'Tes Kemampuan Akademik & Penalaran Matematika SMA/SMK (30 Soal)',
      durasi: 90,
      target_soal: 30,
    },
  ];
}

function normalizeTwoMapelExams(
  exams: ExamPackage[],
  jenjang: 'SD' | 'SMP' | 'SMA/SMK'
): ExamPackage[] {
  const allowedIds =
    jenjang === 'SD'
      ? ['sd_bindo', 'sd_mtk']
      : jenjang === 'SMP'
        ? ['smp_bindo', 'smp_mtk']
        : ['sma_smk_bindo', 'sma_smk_mtk'];

  const filtered = exams.filter((exam) => {
    const idStr = String(exam.id || '');
    const mapelUpper = String(exam.mapel || '').toUpperCase();
    const isAllowedMapel =
      mapelUpper.includes('MATEMATIKA') ||
      mapelUpper.includes('MTK') ||
      mapelUpper.includes('BAHASA INDONESIA') ||
      mapelUpper.includes('BINDO');

    return allowedIds.includes(idStr) && isAllowedMapel;
  });

  if (filtered.length === 0) {
    return getExamsByJenjang(jenjang);
  }

  const defaults = getExamsByJenjang(jenjang);
  return defaults.map((def) => filtered.find((f) => String(f.id) === def.id) || def);
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [examList, setExamList] = useState<ExamPackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const savedUser =
          localStorage.getItem('studentUser') || localStorage.getItem('user');
        if (!savedUser) {
          router.push('/');
          return;
        }

        const parsedUser = JSON.parse(savedUser) as UserData;
        const initialTingkat =
          parsedUser.tingkat_kelas ?? parsedUser.kelas_id ?? '';
        const initialJenjang = resolveJenjang(
          initialTingkat,
          parsedUser.jenjang
        );

        setUser({
          ...parsedUser,
          tingkat_kelas: initialTingkat || parsedUser.tingkat_kelas || '',
          jenjang: initialJenjang,
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

        const res = await fetch(
          `${API_BASE_URL}/api/exams?${queryParams.toString()}`,
          { cache: 'no-store' }
        );
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
          jenjang: activeJenjang,
          sekolah: data?.user?.sekolah || parsedUser.sekolah,
        };
        setUser(updatedUser);
        localStorage.setItem('studentUser', JSON.stringify(updatedUser));

        const rawExams: ExamPackage[] = Array.isArray(data?.exams)
          ? data.exams
          : Array.isArray(data?.data)
            ? data.data
            : [];

        setExamList(normalizeTwoMapelExams(rawExams, activeJenjang));
      } catch (err) {
        console.error('Gagal memuat dashboard:', err);
        const fallbackJenjang = resolveJenjang(
          user?.tingkat_kelas ?? user?.kelas_id,
          user?.jenjang
        );
        setExamList(getExamsByJenjang(fallbackJenjang));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleMulaiUjian = (examId: string) => {
    router.push(`/exam?exam_id=${encodeURIComponent(examId)}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="font-bold text-emerald-600 animate-pulse text-lg">
          Memuat Dashboard...
        </p>
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
              <h1 className="font-extrabold text-blue-900 leading-tight">
                CBT RUANG BELAJAR
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Portal Ujian &amp; Simulasi Online (B. Indo &amp; MTK)
              </p>
            </div>
          </div>

          {user && (
            <div className="text-right">
              <span className="block font-bold text-slate-700 text-sm">
                {user.nama}
              </span>
              <span className="text-xs text-slate-500">
                {user.sekolah || 'Siswa'}{' '}
                {user.tingkat_kelas ? `(Kelas ${user.tingkat_kelas})` : ''}
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
              Halo,{' '}
              <span className="text-yellow-300">
                {user?.nama || 'Siswa'}!
              </span>{' '}
              👋
            </h2>
            <p className="text-blue-100 max-w-xl text-sm leading-relaxed">
              Pilih mata pelajaran <strong>Bahasa Indonesia</strong> (50 soal)
              atau <strong>Matematika</strong> (30 soal) sesuai jenjang{' '}
              <strong>{user?.jenjang || 'SD / SMP / SMA-SMK'}</strong> kamu di
              bawah ini.
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
            <h3 className="text-xl font-bold text-slate-800">
              Daftar Paket Soal Tersedia ({user?.jenjang || 'SD / SMP / SMA-SMK'})
            </h3>
            <p className="text-xs text-slate-500">
              Tersedia 2 mata pelajaran: Bahasa Indonesia (50 soal) dan
              Matematika (30 soal).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {examList.map((exam) => (
            <div
              key={exam.id}
              className="bg-white rounded-3xl border border-slate-200 hover:border-blue-400 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-200 group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-100 text-blue-700">
                    {exam.jenjang} • {exam.mapel}
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
                      {exam.deskripsi ||
                        `Simulasi Ujian (${exam.target_soal || 50} Soal)`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => handleMulaiUjian(exam.id)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-2xl transition duration-200 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <span>Mulai Kerjakan</span>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
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