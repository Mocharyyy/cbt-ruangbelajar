'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface SubjectCard {
  id: number;
  examId: number;
  name: string;
  code: string;
  level: string;
  questionCount: number;
}

export default function AdminDashboard() {
  const [subjects, setSubjects] = useState<SubjectCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Daftar dasar 11 paket soal (SD: 1-3, SMP: 4-7, SMA: 8-11) dengan target 50 soal
    const baseExams = [
      { id: 1, examId: 1, name: 'Ujian Matematika (SD)', code: 'SD-01', level: 'SD' },
      { id: 2, examId: 2, name: 'Ujian Bahasa Indonesia (SD)', code: 'SD-02', level: 'SD' },
      { id: 3, examId: 3, name: 'Ujian IPAS (SD)', code: 'SD-03', level: 'SD' },
      { id: 4, examId: 4, name: 'Ujian Matematika (SMP)', code: 'SMP-01', level: 'SMP' },
      { id: 5, examId: 5, name: 'Ujian Bahasa Indonesia (SMP)', code: 'SMP-02', level: 'SMP' },
      { id: 6, examId: 6, name: 'Ujian IPA (SMP)', code: 'SMP-03', level: 'SMP' },
      { id: 7, examId: 7, name: 'Ujian Bahasa Inggris (SMP)', code: 'SMP-04', level: 'SMP' },
      { id: 8, examId: 8, name: 'Ujian Matematika (SMA)', code: 'SMA-01', level: 'SMA' },
      { id: 9, examId: 9, name: 'Ujian Bahasa Indonesia (SMA)', code: 'SMA-02', level: 'SMA' },
      { id: 10, examId: 10, name: 'Ujian Fisika/Kimia (SMA)', code: 'SMA-03', level: 'SMA' },
      { id: 11, examId: 11, name: 'Ujian Bahasa Inggris (SMA)', code: 'SMA-04', level: 'SMA' },
    ];

    // Ambil jumlah soal aktif secara real-time untuk setiap exam_id dari database
    Promise.all(
      baseExams.map(async (exam) => {
        try {
          const res = await fetch(`/api/questions?exam_id=${exam.examId}`);
          const data = await res.json();
          
          let count = 0;
          if (data.success && typeof data.total === 'number') {
            count = data.total;
          } else if (data.success && Array.isArray(data.questions)) {
            count = data.questions.length;
          } else if (Array.isArray(data)) {
            count = data.length;
          }

          return {
            ...exam,
            questionCount: count,
          };
        } catch (err) {
          console.error(`Gagal mengambil jumlah soal untuk exam_id ${exam.examId}:`, err);
          return { ...exam, questionCount: 0 };
        }
      })
    ).then((updatedSubjects) => {
      setSubjects(updatedSubjects);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 pb-6 border-b border-gray-200">
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            Panel Admin: Manajemen Paket Soal CBT
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Kelola soal (Target: 50 soal per paket, Durasi: 90 menit) berdasarkan jenjang SD, SMP, dan SMA/SMK.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-500 font-medium">Memuat data paket soal...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {subjects.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded">
                      {item.code} • {item.level}
                    </span>
                    <span className="text-xs text-gray-400 font-semibold">
                      Exam ID: {item.examId}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-800 mb-1">{item.name}</h2>
                  <p className="text-xs text-gray-500 mb-6">
                    Soal Tersedia: <strong className="text-slate-700">{item.questionCount} / 50 Soal</strong> (90 Menit)
                  </p>
                </div>

                <Link
                  href={`/admin/questions?exam_id=${item.examId}`}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-center text-sm shadow-sm transition block"
                >
                  Kelola Soal
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}