'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

 useEffect(() => {
    // Gunakan '/api/leaderboard' jika backend dan frontend satu domain (Vercel)
    // Atau ganti dengan URL backend online kamu jika terpisah (contoh: 'https://backend-kamu.railway.app/api/leaderboard')
    fetch('/api/leaderboard')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setLeaderboard(data.leaderboard || []);
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

  return (
    <div className="min-h-screen bg-emerald-600 p-6 md:p-10 font-sans text-white">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link href="/dashboard" className="bg-emerald-700 hover:bg-emerald-800 px-4 py-2 rounded-xl text-sm font-bold transition">
            ← Kembali ke Dashboard
          </Link>
          <h1 className="text-2xl font-black tracking-tight">Papan Peringkat Kuis</h1>
        </div>

        {/* Header / Info */}
        <div className="text-center mb-10">
          <p className="text-xs text-emerald-200 mt-1">Akumulasi total skor dari seluruh ujian yang diselesaikan</p>
        </div>

        {/* List Ranking */}
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
          </div>
        )}
      </div>
    </div>
  );
}