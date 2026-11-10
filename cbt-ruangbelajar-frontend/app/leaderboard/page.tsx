'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [userRankData, setUserRankData] = useState<any>(null);
  const [totalSiswa, setTotalSiswa] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Ambil user_id dari localStorage (sesuaikan key login aplikasi Anda, misal 'user' atau 'user_id')
    let currentUserId = '';
    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        currentUserId = parsed.id || parsed.user_id || '';
      }
    } catch (e) {
      // Fallback jika disimpan langsung sebagai string ID
      currentUserId = localStorage.getItem('user_id') || '';
    }

    const url = currentUserId 
      ? `https://cbt-ruangbelajar-backend.vercel.app/api/leaderboard?user_id=${currentUserId}`
      : `https://cbt-ruangbelajar-backend.vercel.app/api/leaderboard`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setLeaderboard(data.leaderboard || []);
          setUserRankData(data.userRank || null);
          setTotalSiswa(data.totalSiswa || 0);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Gagal memuat leaderboard:', err);
        setLoading(false);
      });
  }, []);

  // Fungsi pengubah detik ke format menit & detik
  const formatDuration = (totalSeconds: number) => {
    if (!totalSeconds) return '0m 0s';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
  };

  // Cek apakah user yang login sudah ada di dalam Top 10
  const isUserInTop10 = userRankData ? userRankData.rank <= 10 : true;

  return (
    <div className="min-h-screen bg-emerald-600 p-6 md:p-10 font-sans text-white pb-24">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link href="/dashboard" className="bg-emerald-700 hover:bg-emerald-800 px-4 py-2 rounded-xl text-sm font-bold transition">
            ← Kembali ke Dashboard
          </Link>
          <h1 className="text-2xl font-black tracking-tight">Papan Peringkat Kuis</h1>
        </div>

        {/* Header / Info */}
        <div className="text-center mb-10">
          <p className="text-xs text-emerald-200 mt-1">Akumulasi total skor tertinggi dan waktu tercepat</p>
        </div>

        {/* List Ranking Top 10 */}
        {loading ? (
          <div className="text-center py-20 text-emerald-100">Memuat peringkat...</div>
        ) : leaderboard.length === 0 ? (
          <div className="bg-white text-slate-800 rounded-3xl p-10 text-center shadow-lg">
            <p className="text-gray-500">Belum ada data siswa yang menyelesaikan ujian.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {leaderboard.map((item, index) => (
              <div 
                key={item.user_id || index} 
                className="bg-white text-slate-800 rounded-2xl p-5 shadow-md flex items-center justify-between transform transition hover:scale-[1.01]"
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-white ${
                    index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-slate-400' : index === 2 ? 'bg-amber-700' : 'bg-emerald-600'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900">{item.nama_siswa}</h3>
                    <p className="text-xs text-gray-500">Selesai: {item.total_ujian_dikerjakan} paket mapel</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                        Bayes: {item.status_bayes || 'Selesai'}
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        ⏱️ Total Waktu: {formatDuration(item.duration)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="bg-emerald-50 text-emerald-700 font-black px-4 py-2 rounded-xl text-lg shadow-inner inline-block">
                    ⭐ {item.score}
                  </span>
                </div>
              </div>
            ))}

            {/* Jika User Berada di Luar Top 10, Tampilkan Kartu Khusus di Bawah */}
            {userRankData && !isUserInTop10 && (
              <div className="mt-8 pt-6 border-t border-emerald-500/50">
                <p className="text-xs text-emerald-200 mb-2 font-semibold uppercase tracking-wider text-center">Peringkat Anda Saat Ini</p>
                <div className="bg-emerald-800 text-white border-2 border-amber-400 rounded-2xl p-5 shadow-xl flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-black bg-amber-500 text-white shadow">
                      #{userRankData.rank}
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-white">{userRankData.nama_siswa} (Anda)</h3>
                      <p className="text-xs text-emerald-200">Selesai: {userRankData.total_ujian_dikerjakan} paket mapel dari {totalSiswa} total siswa</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-[10px] font-bold bg-emerald-900 text-emerald-200 px-2 py-0.5 rounded-full">
                          Bayes: {userRankData.status_bayes || 'Selesai'}
                        </span>
                        <span className="text-[10px] font-semibold text-amber-300 bg-emerald-900/60 px-2 py-0.5 rounded-full">
                          ⏱️ Total Waktu: {formatDuration(userRankData.duration)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
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