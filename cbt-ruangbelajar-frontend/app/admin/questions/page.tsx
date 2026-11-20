'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Question {
  id: number;
  exam_id: number;
  soal: string;
  opsi_a: string;
  opsi_b: string;
  opsi_c: string;
  opsi_d: string;
  kunci_jawaban: string;
}

interface ExamItem {
  id?: number | string;
  exam_id?: number | string;
  judul_ujian?: string;
  mapel?: string;
  title?: string;
}

export default function AdminQuestions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [examId, setExamId] = useState<string | null>(null);
  const [examTitle, setExamTitle] = useState<string>('Memuat...');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadQuestionsAndExam = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const [qRes, eRes] = await Promise.all([
        fetch(`/api/questions?exam_id=${encodeURIComponent(id)}`, {
          cache: 'no-store',
        }),
        fetch('/api/exams', {
          cache: 'no-store',
        }),
      ]);

      const qData = await qRes.json();
      if (qData.success && Array.isArray(qData.questions)) {
        setQuestions(qData.questions);
      } else if (Array.isArray(qData)) {
        setQuestions(qData);
      } else if (Array.isArray(qData.data)) {
        setQuestions(qData.data);
      } else {
        setQuestions([]);
      }

      const eData = await eRes.json();
      const examsList: ExamItem[] = Array.isArray(eData)
        ? eData
        : eData.exams || eData.data || [];

      if (Array.isArray(examsList)) {
        const currentExam = examsList.find(
          (e) => String(e.id) === String(id) || String(e.exam_id) === String(id)
        );
        if (currentExam) {
          setExamTitle(
            currentExam.judul_ujian ||
              currentExam.mapel ||
              currentExam.title ||
              'Ujian'
          );
        } else {
          setExamTitle('Ujian Tidak Ditemukan');
        }
      }
    } catch (err) {
      console.error('Gagal mengambil data soal/ujian:', err);
      setExamTitle('Ujian (ID: ' + id + ')');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('exam_id');
    setExamId(id);

    if (id) {
      loadQuestionsAndExam(id);
    } else {
      setExamTitle('Pilih Paket Ujian');
      setLoading(false);
    }
  }, [loadQuestionsAndExam]);

  const handleDelete = async (questionId: number) => {
    if (!confirm('Yakin ingin menghapus soal ini?')) return;

    setDeletingId(questionId);
    try {
      const res = await fetch(
        `/api/questions?id=${encodeURIComponent(String(questionId))}`,
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

      if (res.ok && (data.success || data.message)) {
        setQuestions((prev) => prev.filter((q) => q.id !== questionId));
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

  const addQuestionHref = examId
    ? `/admin/add-question?exam_id=${encodeURIComponent(examId)}`
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

        {/* Header Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <h1 className="text-2xl font-black text-slate-800">
                Kelola Soal: {examTitle}
              </h1>
              <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
                EXAM ID: {examId || '-'}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              Total Soal Tersedia:{' '}
              <strong className="text-slate-700">
                {questions.length} / 50 Soal
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

        {/* Daftar Soal */}
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
            {questions.map((q, index) => (
              <div
                key={q.id || index}
                className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-start justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2 py-0.5 rounded">
                      Soal No. {index + 1}
                    </span>
                    <span className="text-xs text-gray-400 font-medium uppercase">
                      Kunci: {q.kunci_jawaban}
                    </span>
                  </div>
                  <p className="text-slate-800 font-medium text-base mb-3 whitespace-pre-wrap">
                    {q.soal}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-600">
                    <div>A. {q.opsi_a}</div>
                    <div>B. {q.opsi_b}</div>
                    <div>C. {q.opsi_c}</div>
                    <div>D. {q.opsi_d}</div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4 shrink-0">
                  <Link
                    href={`/admin/add-question?exam_id=${encodeURIComponent(
                      String(q.exam_id || examId || '')
                    )}&edit_id=${encodeURIComponent(String(q.id))}`}
                    className="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    disabled={deletingId === q.id}
                    onClick={() => handleDelete(q.id)}
                    className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                  >
                    {deletingId === q.id ? 'Menghapus...' : 'Hapus'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}