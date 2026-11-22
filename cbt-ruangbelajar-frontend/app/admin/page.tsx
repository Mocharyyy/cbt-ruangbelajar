'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ExamCardConfig {
  exam_id: string;
  jenjang: 'SD' | 'SMP' | 'SMA/SMK';
  mapel: 'B. Indo' | 'MTK';
  judul: string;
  targetSoal: number;
}

interface QuestionItem {
  id: number | string;
  exam_id: string;
  pertanyaan?: string;
  soal?: string;
  question?: string;
  opsi_a?: string;
  opsi_b?: string;
  opsi_c?: string;
  opsi_d?: string;
  jawaban_benar?: string;
  kunci_jawaban?: string;
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
  const router = useRouter();

  const [selectedExamId, setSelectedExamId] = useState<string>('sd_bindo');
  const [countsByExam, setCountsByExam] = useState<Record<string, number>>({});
  const [questions, setQuestions] = useState<QuestionItem[]>([]);

  const [loadingCounts, setLoadingCounts] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Form tambah soal
  const [pertanyaan, setPertanyaan] = useState('');
  const [opsiA, setOpsiA] = useState('');
  const [opsiB, setOpsiB] = useState('');
  const [opsiC, setOpsiC] = useState('');
  const [opsiD, setOpsiD] = useState('');
  const [jawabanBenar, setJawabanBenar] = useState('A');

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/');
      return;
    }

    try {
      const user = JSON.parse(storedUser);
      if (user.role !== 'admin') {
        alert('Akses khusus Admin!');
        router.push('/dashboard');
      }
    } catch {
      router.push('/');
    }
  }, [router]);

  const activeCard =
    EXAM_CARDS.find((c) => c.exam_id === selectedExamId) || EXAM_CARDS[0];

  const fetchAllCardCounts = useCallback(async () => {
    try {
      setLoadingCounts(true);
      const entries = await Promise.all(
        EXAM_CARDS.map(async (card) => {
          try {
            const res = await fetch(
              `${API_BASE_URL}/api/questions?exam_id=${encodeURIComponent(card.exam_id)}`,
              { cache: 'no-store' }
            );
            const data = await res.json();
            const list = Array.isArray(data)
              ? data
              : data.questions || data.data || [];
            return [card.exam_id, list.length] as const;
          } catch {
            return [card.exam_id, 0] as const;
          }
        })
      );
      setCountsByExam(Object.fromEntries(entries));
    } finally {
      setLoadingCounts(false);
    }
  }, []);

  const fetchQuestionsByExam = useCallback(async (examId: string) => {
    try {
      setLoadingQuestions(true);
      setErrorMessage('');
      const res = await fetch(
        `${API_BASE_URL}/api/questions?exam_id=${encodeURIComponent(examId)}`,
        { cache: 'no-store' }
      );
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || 'Gagal memuat soal dari server VPS.');
        setQuestions([]);
        return;
      }

      const list: QuestionItem[] = Array.isArray(data)
        ? data
        : data.questions || data.data || [];

      setQuestions(list);
      setCountsByExam((prev) => ({ ...prev, [examId]: list.length }));
    } catch (err) {
      console.error('Gagal memuat soal:', err);
      setErrorMessage('Terjadi kesalahan koneksi ke server backend VPS.');
    } finally {
      setLoadingQuestions(false);
    }
  }, []);

  useEffect(() => {
    fetchAllCardCounts();
  }, [fetchAllCardCounts]);

  useEffect(() => {
    if (selectedExamId) {
      fetchQuestionsByExam(selectedExamId);
    }
  }, [selectedExamId, fetchQuestionsByExam]);

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pertanyaan.trim() || !opsiA.trim() || !opsiB.trim()) {
      alert('Pertanyaan serta minimal opsi A dan B wajib diisi.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage('');
      setSuccessMessage('');

      const payload = {
        exam_id: activeCard.exam_id,
        jenjang: activeCard.jenjang,
        mapel: activeCard.mapel,
        pertanyaan: pertanyaan.trim(),
        soal: pertanyaan.trim(),
        opsi_a: opsiA.trim(),
        opsi_b: opsiB.trim(),
        opsi_c: opsiC.trim(),
        opsi_d: opsiD.trim(),
        jawaban_benar: jawabanBenar,
        kunci_jawaban: jawabanBenar,
      };

      const res = await fetch(`${API_BASE_URL}/api/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok && data.success !== false) {
        setPertanyaan('');
        setOpsiA('');
        setOpsiB('');
        setOpsiC('');
        setOpsiD('');
        setJawabanBenar('A');
        setSuccessMessage(
          `Soal berhasil ditambahkan ke ${activeCard.judul} (${activeCard.exam_id}).`
        );
        await fetchQuestionsByExam(activeCard.exam_id);
      } else {
        setErrorMessage(data.message || 'Gagal menyimpan soal baru.');
      }
    } catch (err) {
      console.error('Error tambah soal:', err);
      setErrorMessage('Terjadi kesalahan koneksi saat menyimpan soal.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteQuestion = async (id: number | string) => {
    if (!confirm('Hapus soal ini?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/questions/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (res.ok && data.success !== false) {
        setSuccessMessage('Soal berhasil dihapus.');
        await fetchQuestionsByExam(activeCard.exam_id);
      } else {
        alert(data.message || 'Gagal menghapus soal.');
      }
    } catch (err) {
      console.error('Error hapus soal:', err);
      alert('Terjadi kesalahan saat menghapus soal.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6 md:p-10 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
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

        {/* Kartu Paket Ujian (SD, SMP, SMA/SMK -> B. Indo 50 soal & MTK 30 soal) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {EXAM_CARDS.map((card) => {
            const currentCount = countsByExam[card.exam_id] ?? 0;
            const isSelected = card.exam_id === selectedExamId;
            const progressPct = Math.min(
              100,
              Math.round((currentCount / card.targetSoal) * 100)
            );

            return (
              <button
                key={card.exam_id}
                type="button"
                onClick={() => setSelectedExamId(card.exam_id)}
                className={`text-left rounded-2xl p-5 border transition shadow-sm ${
                  isSelected
                    ? 'bg-white border-emerald-600 ring-2 ring-emerald-500/30'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
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

                <div className="text-lg font-black text-slate-900">
                  {card.judul}
                </div>

                <div className="mt-3 flex items-baseline justify-between text-sm">
                  <span className="font-bold text-emerald-700">
                    {loadingCounts ? '...' : `${currentCount} / ${card.targetSoal} soal`}
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
              </button>
            );
          })}
        </div>

        {/* Notifikasi */}
        {errorMessage && (
          <div className="p-4 bg-red-100 border border-red-300 text-red-700 rounded-xl text-sm font-medium">
            ⚠️ {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="p-4 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl text-sm font-medium">
            ✅ {successMessage}
          </div>
        )}

        {/* Form Tambah Soal untuk Card Aktif */}
        <form
          onSubmit={handleAddQuestion}
          className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-900">
              Tambah Soal — {activeCard.judul}
            </h2>
            <span className="text-xs font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-lg font-bold">
              exam_id: {activeCard.exam_id} • Target {activeCard.targetSoal} soal
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
              Pertanyaan / Soal
            </label>
            <textarea
              rows={3}
              value={pertanyaan}
              onChange={(e) => setPertanyaan(e.target.value)}
              placeholder={`Tuliskan soal ${activeCard.judul}...`}
              className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Opsi A
              </label>
              <input
                type="text"
                value={opsiA}
                onChange={(e) => setOpsiA(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Opsi B
              </label>
              <input
                type="text"
                value={opsiB}
                onChange={(e) => setOpsiB(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Opsi C
              </label>
              <input
                type="text"
                value={opsiC}
                onChange={(e) => setOpsiC(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Opsi D
              </label>
              <input
                type="text"
                value={opsiD}
                onChange={(e) => setOpsiD(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                Kunci Jawaban
              </label>
              <select
                value={jawabanBenar}
                onChange={(e) => setJawabanBenar(e.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold bg-white"
              >
                <option value="A">Opsi A</option>
                <option value="B">Opsi B</option>
                <option value="C">Opsi C</option>
                <option value="D">Opsi D</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition shadow-sm"
            >
              {submitting ? 'Menyimpan...' : '+ Simpan Soal'}
            </button>
          </div>
        </form>

        {/* Daftar Soal */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Daftar Soal — {activeCard.judul} ({questions.length} /{' '}
              {activeCard.targetSoal})
            </h2>
            <button
              type="button"
              onClick={() => fetchQuestionsByExam(activeCard.exam_id)}
              className="text-xs font-bold text-emerald-700 hover:underline"
            >
              ↻ Muat Ulang
            </button>
          </div>

          {loadingQuestions ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Memuat soal...
            </div>
          ) : questions.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Belum ada soal untuk {activeCard.judul} ({activeCard.exam_id}).
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {questions.map((q, idx) => {
                const teksSoal = q.pertanyaan || q.soal || q.question || '-';
                const kunci = q.jawaban_benar || q.kunci_jawaban || '-';
                return (
                  <div
                    key={String(q.id)}
                    className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-4 hover:bg-slate-50"
                  >
                    <div className="space-y-1.5">
                      <div className="text-xs font-bold text-slate-400">
                        Soal #{idx + 1} • Kunci:{' '}
                        <span className="text-emerald-700">{kunci}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {teksSoal}
                      </p>
                      <div className="text-xs text-slate-600 grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1">
                        {q.opsi_a && <div>A. {q.opsi_a}</div>}
                        {q.opsi_b && <div>B. {q.opsi_b}</div>}
                        {q.opsi_c && <div>C. {q.opsi_c}</div>}
                        {q.opsi_d && <div>D. {q.opsi_d}</div>}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="self-start bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition"
                    >
                      🗑️ Hapus
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}