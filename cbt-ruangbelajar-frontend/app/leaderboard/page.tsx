'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type JenjangType = 'SD' | 'SMP' | 'SMA/SMK';

interface LeaderboardItem {
  user_id?: number | string;
  nama_siswa: string;
  jenjang?: string;
  total_ujian_dikerjakan: number;
  status_bayes?: string;
  klasifikasi?: string;
  duration: number; // dalam detik
  score: number;
}

interface UserRankData extends LeaderboardItem {
  rank: number;
}

const JENJANG_LIST: JenjangType[] = ['SD', 'SMP', 'SMA/SMK'];

function normalizeJenjang(raw?: string | null): JenjangType {
  if (!raw) return 'SD';
  const upper = String(raw).trim().toUpperCase();
  if (upper.includes('SMA') || upper.includes('SMK') || upper.includes('MA')) {
    return 'SMA/SMK';
  }
  if (upper.includes('SMP') || upper.includes('MTS')) {
    return 'SMP';
  }
  return 'SD';
}

export default function LeaderboardPage() {
  const [selectedJenjang, setSelectedJenjang] = useState<JenjangType>('SD');
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [userRankData, setUserRankData] = useState<UserRankData | null>(null);
  const [totalSiswa, setTotalSiswa] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Deteksi jenjang user dari localStorage saat pertama kali masuk
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        const rawJenjang =
          parsed.jenjang || parsed.jenjang_pendidikan || parsed.level || localStorage.getItem('jenjang');
        if (rawJenjang) {
          setSelectedJenjang(normalizeJenjang(rawJenjang));
        }
      } else {
        const fallbackJenjang = localStorage.getItem('jenjang');
        if (fallbackJenjang) {
          setSelectedJenjang(normalizeJenjang(fallbackJenjang));
        }
      }
    } catch {
      // biarkan default SD
    }
  }, []);

  const fetchLeaderboard = useCallback(async (jenjang: JenjangType) => {
    setLoading(true);
    setErrorMsg('');

    let currentUserId = '';
    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        currentUserId = String(parsed.id || parsed.user_id || '');
      }
    } catch {
      currentUserId = localStorage.getItem('user_id') || '';
    }

    const params = new URLSearchParams();
    params.set('jenjang', jenjang);
    if (currentUserId) {
      params.set('user_id', currentUserId);
    }

    try {
      const res = await fetch(`/api/leaderboard?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await res.json();

      if (data.success) {
        const list: LeaderboardItem[] = Array.isArray(data.leaderboard) ? data.leaderboard : [];
        // Pastikan urutan: skor tertinggi dulu, lalu waktu tercepat jika skor sama
        const sorted = [...list].sort((a, b) => {
          const scoreDiff = Number(b.score || 0) - Number(a.score || 0);
          if (scoreDiff !== 0) return scoreDiff;
          return Number(a.duration || 0) - Number(b.duration || 0);
        });
        setLeaderboard(sorted);
        setUserRankData(data.userRank || null);
        setTotalSiswa(Number(data.totalSiswa) || sorted.length);
      } else {
        setLeaderboard([]);
        setUserRankData(null);
        setTotalSiswa(0);
      }
    } catch (err) {
      console.error('Gagal memuat leaderboard:', err);
      setErrorMsg('Gagal memuat data peringkat. Pastikan endpoint /api/leaderboard tersedia.');
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard(selectedJenjang);
  }, [selectedJenjang, fetchLeaderboard]);

  const formatDuration = (totalSeconds: number) => {
    const sec = Math.max(0, Number(totalSeconds) || 0);
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = sec % 60;
    if (hours > 0) {
      return `${hours}j ${minutes}m ${seconds}d`;
    }
    return `${minutes}m ${seconds}d`;
  };

  const formatAvgDuration = (totalSeconds: number, totalExams: number) => {
    if (!totalExams || totalExams <= 0) return '0m 0d';
    return formatDuration(Math.round((Number(totalSeconds) || 0) / totalExams));
  };

  const isUserInTop10 = userRankData ? userRankData.rank <= 10 : true;

  return (
    <div className="min-h-screen bg-emerald-600 p-6 md:p-10 font-sans text-white pb-24">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <Link
            href="/dashboard"
            className="bg-emerald-700 hover:bg-emerald-800 px-4 py-2 rounded-xl text-sm font-bold transition"
          >
            ← Kembali ke Dashboard
          </Link>
          <h1 className="text-2xl font-black tracking-tight">Papan Peringkat Kuis</h1>
        </div>

        {/* Selector Jenjang Terpisah: SD, SMP, SMA/SMK */}
        <div className="bg-emerald-700/70 p-1.5 rounded-2xl grid grid-cols-3 gap-2 mb-6 shadow-inner">
          {JENJANG_LIST.map((jenjang) => {
            const active = selectedJenjang === jenjang;
            return (
              <button
                key={jenjang}
                type="button"
                onClick={() => setSelectedJenjang(jenjang)}
                className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer ${
                  active
                    ? 'bg-white text-emerald-700 shadow-md'
                    : 'text-emerald-100 hover:bg-emerald-700'
                }`}
              >
                Leaderboard {jenjang}
              </button>
            );
          })}
        </div>

        {/* Header / Info */}
        <div className="text-center mb-8">
          <p className="text-sm font-bold text-white">
            Jenjang {selectedJenjang} — Akumulasi Total Skor Tertinggi & Waktu Tercepat
          </p>
          <p className="text-xs text-emerald-100 mt-1">
            Total skor dijumlahkan dari riwayat mapel yang selesai; urutan prioritas skor tertinggi lalu total waktu paling singkat.
          </p>
        </div>

        {errorMsg && (
          <div className="bg-rose-100 text-rose-800 rounded-2xl p-4 mb-6 text-sm font-semibold text-center">
            {errorMsg}
          </div>
        )}

        {/* List Ranking */}
        {loading ? (
          <div className="text-center py-20 text-emerald-100 font-semibold">
            Memuat peringkat jenjang {selectedJenjang}...
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="bg-white text-slate-800 rounded-3xl p-10 text-center shadow-lg">
            <p className="text-gray-600 font-semibold">
              Belum ada data siswa yang menyelesaikan ujian pada jenjang {selectedJenjang}.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {leaderboard.map((item, index) => {
              const classificationLabel =
                item.klasifikasi || item.status_bayes || 'Terklasifikasi';
              return (
                <div
                  key={item.user_id || index}
                  className="bg-white text-slate-800 rounded-2xl p-5 shadow-md flex items-center justify-between gap-4 transform transition hover:scale-[1.01]"
                >
                  <div className="flex items-center space-x-4">
                    <div
                      className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-black text-white ${
                        index === 0
                          ? 'bg-amber-500'
                          : index === 1
                          ? 'bg-slate-400'
                          : index === 2
                          ? 'bg-amber-700'
                          : 'bg-emerald-600'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-base text-slate-900">{item.nama_siswa}</h3>
                        <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                          {normalizeJenjang(item.jenjang || selectedJenjang)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Selesai: {item.total_ujian_dikerjakan} paket mapel • Rata-rata:{' '}
                        {formatAvgDuration(item.duration, item.total_ujian_dikerjakan)}/paket
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                          Klasifikasi: {classificationLabel}
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          ⏱️ Total Waktu: {formatDuration(item.duration)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="bg-emerald-50 text-emerald-700 font-black px-4 py-2 rounded-xl text-lg shadow-inner inline-block">
                      ⭐ {item.score}
                    </span>
                    <p className="text-[10px] text-gray-400 mt-1">Akumulasi Skor</p>
                  </div>
                </div>
              );
            })}

            {/* Jika User Berada di Luar Top 10, Tampilkan Kartu Khusus di Bawah */}
            {userRankData && !isUserInTop10 && (
              <div className="mt-8 pt-6 border-t border-emerald-500/50">
                <p className="text-xs text-emerald-200 mb-2 font-semibold uppercase tracking-wider text-center">
                  Peringkat Anda Saat Ini ({selectedJenjang})
                </p>
                <div className="bg-emerald-800 text-white border-2 border-amber-400 rounded-2xl p-5 shadow-xl flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-black bg-amber-500 text-white shadow">
                      #{userRankData.rank}
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-white">
                        {userRankData.nama_siswa} (Anda)
                      </h3>
                      <p className="text-xs text-emerald-200">
                        Selesai: {userRankData.total_ujian_dikerjakan} paket mapel dari {totalSiswa}{' '}
                        siswa {selectedJenjang}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className="text-[10px] font-bold bg-emerald-900 text-emerald-200 px-2 py-0.5 rounded-full">
                          Klasifikasi: {userRankData.klasifikasi || userRankData.status_bayes || 'Selesai'}
                        </span>
                        <span className="text-[10px] font-semibold text-amber-300 bg-emerald-900/60 px-2 py-0.5 rounded-full">
                          ⏱️ Total Waktu: {formatDuration(userRankData.duration)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="bg-amber-400 text-slate-900 font-black px-4 py-2 rounded-xl text-lg shadow-inner inline-block">
                      ⭐ {userRankData.score}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}