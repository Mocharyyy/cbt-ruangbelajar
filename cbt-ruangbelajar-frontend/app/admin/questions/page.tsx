'use client';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Question {
  id: number | string;
  exam_id: string | number;
  tipe_soal?: string;
  soal?: string;
  pertanyaan?: string;
  teks_sebelum_gambar?: string;
  image_url?: string;
  gambar_soal?: string;
  teks_sesudah_gambar?: string;
  teks_lanjutan?: string;
  opsi_a?: string;
  opsi_a_text?: string;
  opsi_a_img?: string;
  opsi_b?: string;
  opsi_b_text?: string;
  opsi_b_img?: string;
  opsi_c?: string;
  opsi_c_text?: string;
  opsi_c_img?: string;
  opsi_d?: string;
  opsi_d_text?: string;
  opsi_d_img?: string;
  kunci_jawaban: unknown;
}

interface ExamItem {
  id?: number | string;
  exam_id?: number | string;
  judul_ujian?: string;
  mapel?: string;
  title?: string;
}

const EXAM_META: Record<string, { title: string; target: number }> = {
  sd_bindo: { title: 'SD - Bahasa Indonesia', target: 50 },
  sd_mtk: { title: 'SD - Matematika', target: 30 },
  smp_bindo: { title: 'SMP - Bahasa Indonesia', target: 50 },
  smp_mtk: { title: 'SMP - Matematika', target: 30 },
  sma_smk_bindo: { title: 'SMA/SMK - Bahasa Indonesia', target: 50 },
  sma_smk_mtk: { title: 'SMA/SMK - Matematika', target: 30 },
};

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'https://139.190.107.150.sslip.io'
).replace(/\/+$/, '');

function resolveAssetUrl(url?: string): string {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (!trimmed) return '';
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function getQuestionMainText(q: Question): string {
  return (
    q.soal ||
    q.teks_sebelum_gambar ||
    q.pertanyaan ||
    ''
  ).trim();
}

function getOptionText(
  q: Question,
  opt: 'a' | 'b' | 'c' | 'd'
): string {
  const direct = q[`opsi_${opt}`];
  const textField = q[`opsi_${opt}_text`];
  return String(textField || direct || '').trim();
}

function getOptionImage(q: Question, opt: 'a' | 'b' | 'c' | 'd'): string {
  return resolveAssetUrl(q[`opsi_${opt}_img`]);
}

function formatAnswerKey(key: unknown): string {
  if (key === undefined || key === null || key === '') return '-';
  if (Array.isArray(key)) {
    return key.map((item) => String(item).trim()).filter(Boolean).join(', ') || '-';
  }
  if (typeof key === 'object') {
    const entries = Object.entries(key as Record<string, unknown>);
    if (entries.length === 0) return '-';
    return entries.map(([k, v]) => `${k}: ${String(v)}`).join(', ');
  }
  if (typeof key === 'string') {
    const trimmed = key.trim();
    if (!trimmed) return '-';
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed !== trimmed) {
        return formatAnswerKey(parsed);
      }
    } catch {
      // Bukan JSON valid, tampilkan string apa adanya
    }
    return trimmed;
  }
  return String(key);
}

function formatQuestionType(tipe?: string): string {
  const normalized = (tipe || 'single').toLowerCase();
  if (normalized === 'multiple' || normalized === 'multiple_choice') {
    return 'Multiple Choice';
  }
  if (normalized === 'true_false' || normalized === 'tf' || normalized === 'kategori') {
    return 'Benar / Salah';
  }
  return 'Single Choice';
}

function AdminQuestionsContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('exam_id');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [examTitle, setExamTitle] = useState<string>('Memuat...');
  const [targetQuestions, setTargetQuestions] = useState<number>(50);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | string | null>(null);

  const loadQuestionsAndExam = useCallback(async (targetId: string) => {
    setLoading(true);
    try {
      const preset = EXAM_META[targetId];
      if (preset) {
        setExamTitle(preset.title);
        setTargetQuestions(preset.target);
      } else {
        setTargetQuestions(50);
      }

      const [qRes, eRes] = await Promise.all([
        fetch(
          `${API_BASE_URL}/api/questions?exam_id=${encodeURIComponent(targetId)}`,
          { cache: 'no-store' }
        ),
        fetch(`${API_BASE_URL}/api/exams`, {
          cache: 'no-store',
        }),
      ]);

      const qData = await qRes.json();
      if (qRes.ok && qData.success && Array.isArray(qData.questions)) {
        setQuestions(qData.questions);
      } else if (qRes.ok && Array.isArray(qData)) {
        setQuestions(qData);
      } else if (qRes.ok && Array.isArray(qData.data)) {
        setQuestions(qData.data);
      } else {
        setQuestions([]);
      }

      if (!preset && eRes.ok) {
        const eData = await eRes.json();
        const examsList: ExamItem[] = Array.isArray(eData)
          ? eData
          : eData.exams || eData.data || [];

        if (Array.isArray(examsList)) {
          const currentExam = examsList.find(
            (e) =>
              String(e.id) === String(targetId) ||
              String(e.exam_id) === String(targetId)
          );
          if (currentExam) {
            setExamTitle(
              currentExam.judul_ujian ||
                currentExam.mapel ||
                currentExam.title ||
                `Paket Ujian (${targetId})`
            );
          } else {
            setExamTitle(`Paket Ujian (${targetId})`);
          }
        }
      }
    } catch (err) {
      console.error('Gagal mengambil data soal/ujian:', err);
      if (!EXAM_META[targetId]) {
        setExamTitle(`Ujian (ID: ${targetId})`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (id) {
      loadQuestionsAndExam(id);
    } else {
      setQuestions([]);
      setExamTitle('Pilih Paket Ujian');
      setLoading(false);
    }
  }, [id, loadQuestionsAndExam]);

  const handleDelete = async (questionId: number | string) => {
    if (!confirm('Yakin ingin menghapus soal ini?')) return;

    setDeletingId(questionId);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/admin/questions/${encodeURIComponent(String(questionId))}`,
        {
          method: 'DELETE',
          cache: 'no-store',
        }
      );

      let data: { success?: boolean; message?: string; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (res.ok && data.success !== false) {
        setQuestions((prev) => prev.filter((q) => String(q.id) !== String(questionId)));
      } else {
        alert(data.message || data.error || 'Gagal menghapus soal.');
      }
    } catch (err) {
      console.error('Error delete:', err);
      alert('Terjadi kesalahan saat menghapus soal.');
    } finally {
      setDeletingId(null);
    }
  };

  const addQuestionHref = id
    ? `/admin/add-question?exam_id=${encodeURIComponent(id)}`
    : '/admin/add-question';

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      <div className="max-w-5xl mx-auto">
        <Link
          href="/admin"
          className="text-sm font-semibold text-blue-600 hover:underline inline-block mb-6"
        >
          ← Kembali ke Dashboard Mapel
        </Link>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-2xl font-black text-slate-800">
                Kelola Soal: {examTitle}
              </h1>
              <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
                EXAM ID: {id || '-'}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              Total Soal Tersedia:{' '}
              <strong className="text-slate-700">
                {questions.length} / {targetQuestions} Soal
              </strong>{' '}
              (Durasi: 90 Menit)
            </p>
          </div>

          <div className="mt-4 md:mt-0">
            <Link
              href={addQuestionHref}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-5 rounded-xl text-sm shadow-sm transition inline-block"
            >
              + Tambah Soal Baru
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500">
            Memuat data soal...
          </div>
        ) : questions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
            <p className="text-gray-500 mb-4">
              Belum ada soal untuk mata pelajaran ini.
            </p>
            <Link
              href={addQuestionHref}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-xl text-sm inline-block"
            >
              Buat Soal Pertama
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((q, index) => {
              const mainText = getQuestionMainText(q);
              const questionImg = resolveAssetUrl(q.image_url || q.gambar_soal);
              const afterText = String(
                q.teks_sesudah_gambar || q.teks_lanjutan || ''
              ).trim();
              const isTrueFalse = ['true_false', 'tf', 'kategori'].includes(
                (q.tipe_soal || '').toLowerCase()
              );

              return (
                <div
                  key={q.id || index}
                  className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-start justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-0.5 rounded">
                        Soal No. {index + 1}
                      </span>
                      <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-0.5 rounded">
                        {formatQuestionType(q.tipe_soal)}
                      </span>
                      <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded font-semibold">
                        Kunci: {formatAnswerKey(q.kunci_jawaban)}
                      </span>
                    </div>

                    {mainText ? (
                      <p className="text-slate-800 font-medium text-base mb-3 whitespace-pre-wrap">
                        {mainText}
                      </p>
                    ) : (
                      <p className="text-slate-400 italic text-sm mb-3">
                        (Tidak ada teks soal utama)
                      </p>
                    )}

                    {questionImg && (
                      <div className="mb-3">
                        <img
                          src={questionImg}
                          alt={`Gambar Soal ${index + 1}`}
                          className="max-h-52 rounded-lg border object-contain bg-slate-50"
                        />
                      </div>
                    )}

                    {afterText && (
                      <p className="text-slate-600 text-sm mb-3 whitespace-pre-wrap">
                        {afterText}
                      </p>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs text-gray-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      {(['a', 'b', 'c', 'd'] as const).map((opt) => {
                        const optText = getOptionText(q, opt);
                        const optImg = getOptionImage(q, opt);

                        return (
                          <div key={opt} className="flex flex-col gap-1">
                            <div>
                              <span className="font-bold text-slate-800 uppercase">
                                {opt.toUpperCase()}.
                              </span>{' '}
                              {optText || (
                                <span className="text-gray-400 italic">
                                  {isTrueFalse
                                    ? 'Pernyataan kosong'
                                    : optImg
                                      ? '(Gambar)'
                                      : '-'}
                                </span>
                              )}
                            </div>
                            {optImg && (
                              <img
                                src={optImg}
                                alt={`Opsi ${opt.toUpperCase()}`}
                                className="h-14 w-fit rounded border object-contain bg-white"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <Link
                      href={`/admin/add-question?exam_id=${encodeURIComponent(
                        String(q.exam_id || id || '')
                      )}&edit_id=${encodeURIComponent(String(q.id))}`}
                      className="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      disabled={deletingId === q.id}
                      onClick={() => handleDelete(q.id)}
                      className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
                    >
                      {deletingId === q.id ? 'Menghapus...' : 'Hapus'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminQuestionsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <p className="text-slate-600 font-bold text-sm">
            Memuat halaman soal...
          </p>
        </div>
      }
    >
      <AdminQuestionsContent />
    </Suspense>
  );
}