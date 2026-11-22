'use client';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface ExamCardConfig {
  exam_id: string;
  jenjang: 'SD' | 'SMP' | 'SMA/SMK';
  mapel: 'B. Indo' | 'MTK';
  judul: string;
  targetSoal: number;
}

const EXAM_CARDS: ExamCardConfig[] = [
  {
    exam_id: 'sd_bindo',
    jenjang: 'SD',
    mapel: 'B. Indo',
    judul: 'SD - Bahasa Indonesia',
    targetSoal: 50,
  },
  {
    exam_id: 'sd_mtk',
    jenjang: 'SD',
    mapel: 'MTK',
    judul: 'SD - Matematika',
    targetSoal: 30,
  },
  {
    exam_id: 'smp_bindo',
    jenjang: 'SMP',
    mapel: 'B. Indo',
    judul: 'SMP - Bahasa Indonesia',
    targetSoal: 50,
  },
  {
    exam_id: 'smp_mtk',
    jenjang: 'SMP',
    mapel: 'MTK',
    judul: 'SMP - Matematika',
    targetSoal: 30,
  },
  {
    exam_id: 'sma_smk_bindo',
    jenjang: 'SMA/SMK',
    mapel: 'B. Indo',
    judul: 'SMA/SMK - Bahasa Indonesia',
    targetSoal: 50,
  },
  {
    exam_id: 'sma_smk_mtk',
    jenjang: 'SMA/SMK',
    mapel: 'MTK',
    judul: 'SMA/SMK - Matematika',
    targetSoal: 30,
  },
];

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'https://139.190.107.150.sslip.io'
).replace(/\/+$/, '');

export default function AdminExamCardsPage() {
  const [countsByExam, setCountsByExam] = useState<Record<string, number>>({});
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchAllCardCounts = useCallback(async () => {
    try {
      setLoadingCounts(true);
      setErrorMessage('');

      const entries = await Promise.all(
        EXAM_CARDS.map(async (card) => {
          try {
            const res = await fetch(
              `${API_BASE_URL}/api/questions?exam_id=${encodeURIComponent(card.exam_id)}`,
              { cache: 'no-store' }
            );
            if (!res.ok) {
              return [card.exam_id, 0] as const;
            }
            const data = await res.json();
            const list = Array.isArray(data)
              ? data
              : Array.isArray(data.questions)
                ? data.questions
                : Array.isArray(data.data)
                  ? data.data
                  : [];
            return [card.exam_id, list.length] as const;
          } catch {
            return [card.exam_id, 0] as const;
          }
        })
      );

      setCountsByExam(Object.fromEntries(entries));
    } catch (err) {
      console.error('Gagal memuat jumlah soal:', err);
      setErrorMessage('Gagal memuat jumlah soal dari server VPS.');
    } finally {
      setLoadingCounts(false);
    }
  }, []);

  useEffect(() => {
    fetchAllCardCounts();
  }, [fetchAllCardCounts]);

  return (
    <div className="min-h-screen bg-slate-100 p-6 md:p-10 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900">
              Bank Soal SD, SMP &amp; SMA/SMK
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              B. Indo (50 soal) &amp; MTK (30 soal) per paket ujian
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={fetchAllCardCounts}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2 rounded-xl text-sm font-bold transition shadow-sm cursor-pointer"
            >
              ↻ Refresh
            </button>
            <Link
              href="/admin/users"
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2 rounded-xl text-sm font-bold transition shadow-sm"
            >
              👥 Riwayat Login Users
            </Link>
            <Link
              href="/dashboard"
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition shadow-sm"
            >
              ← Kembali ke Dashboard
            </Link>
          </div>
        </div>

        {errorMessage && (
          <div className="p-4 bg-red-100 border border-red-300 text-red-700 rounded-xl text-sm font-medium">
            ⚠️ {errorMessage}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {EXAM_CARDS.map((card) => {
            const currentCount = countsByExam[card.exam_id] ?? 0;
            const progressPct = Math.min(
              100,
              Math.round((currentCount / card.targetSoal) * 100)
            );

            return (
              <div
                key={card.exam_id}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span
                      className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${
                        card.mapel === 'B. Indo'
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {card.jenjang} • {card.mapel}
                    </span>
                    <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {card.exam_id}
                    </span>
                  </div>

                  <h2 className="text-lg font-black text-slate-900">
                    {card.judul}
                  </h2>

                  <div className="mt-3 flex items-baseline justify-between text-sm">
                    <span className="font-bold text-emerald-700">
                      {loadingCounts
                        ? '...'
                        : `${currentCount} / ${card.targetSoal} soal`}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      Target: {card.targetSoal} soal
                    </span>
                  </div>

                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-emerald-600 transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <Link
                    href={`/admin/questions?exam_id=${encodeURIComponent(card.exam_id)}`}
                    className="block w-full text-center bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition shadow-sm"
                  >
                    Kelola Soal →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}