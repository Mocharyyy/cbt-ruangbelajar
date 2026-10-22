'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function ExamContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Mendukung parameter URL baik 'exam_id' maupun 'examId' agar tidak miss
  const examId = searchParams.get('exam_id') || searchParams.get('examId') || '1';
  const studentExamId = searchParams.get('studentExamId') || '1';
  const [showDiscussionModal, setShowDiscussionModal] = useState(false);

  // 1. State Navigasi & Status Pengerjaan
  const [isExamStarted, setIsExamStarted] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // 2. State Data Soal & Jawaban
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: number]: any }>({});

  // 3. Timer Ujian (CountDown 90 Menit = 54000 detik)
  const [timeLeft, setTimeLeft] = useState(90 * 60);

  // 4. State Modal Konfirmasi & Rekap Hasil Ujian (Naïve Bayes)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [examResultData, setExamResultData] = useState({
    score: 0,
    status: 'Rendah',
  });

  // Handler Buka Modal Konfirmasi
  const handleOpenConfirmModal = () => {
    setIsConfirmModalOpen(true);
  };

  // 1. Fetch Soal (Disesuaikan agar aman dengan examId dan berbagai format response backend)
  useEffect(() => {
    if (!examId) return;

    fetch(`https://cbt-ruangbelajar-backend.vercel.app/api/exams/${examId}/questions`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setQuestions(data.data);
        } else if (data.success && Array.isArray(data.questions)) {
          setQuestions(data.questions);
        } else if (Array.isArray(data)) {
          setQuestions(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching exam:', err);
        setLoading(false);
      });
  }, [examId]);

  // 2. Timer Running & Auto Finish saat habis
  useEffect(() => {
    if (!isExamStarted) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinishExam(); // Auto submit jika waktu habis
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isExamStarted, answers, questions]);

  // Format Waktu (HH:MM:SS)
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  // 3. Helper Simpan Jawaban Ke Database
  const saveAnswerToDB = async (questionId: number, answerValue: any) => {
    try {
      await fetch('https://cbt-ruangbelajar-backend.vercel.app/api/student/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_exam_id: Number(studentExamId),
          question_id: questionId,
          jawaban: answerValue,
        }),
      });
    } catch (err) {
      console.error('Gagal menyimpan jawaban ke DB:', err);
    }
  };

  // 4. Selesai Ujian & Hitung Nilai (Kirim Ke Express Backend + Naive Bayes)
  const handleFinishExam = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      let correctCount = 0;

      questions.forEach((q: any) => {
        const userAns = answers[q.id];
        const key = q.kunci_jawaban;

        if (!userAns) return;

        const tipe = (q.tipe_soal || 'single').toLowerCase();

        if (tipe === 'single' || tipe === 'single_choice' || tipe === 'pilihan_ganda') {
          if (String(userAns).trim().toUpperCase() === String(key).trim().toUpperCase()) {
            correctCount++;
          }
        } else if (tipe === 'multiple' || tipe === 'multiple_choice') {
          const userArr = Array.isArray(userAns) ? [...userAns].sort() : [];
          const keyArr = Array.isArray(key) ? [...key].sort() : [];
          if (JSON.stringify(userArr) === JSON.stringify(keyArr)) {
            correctCount++;
          }
        } else if (tipe === 'true_false' || tipe === 'tf' || tipe === 'kategori') {
          if (JSON.stringify(userAns) === JSON.stringify(key)) {
            correctCount++;
          }
        }
      });

      const calculatedScore = questions.length > 0 
        ? Math.round((correctCount / questions.length) * 100) 
        : 0;

      // Kirim hasil ke Backend (DITAMBAHKAN KEMBALI answers: answers)
      const response = await fetch('https://cbt-ruangbelajar-backend.vercel.app/api/exam/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_exam_id: Number(studentExamId),
          final_score: calculatedScore,
          answers: answers, // <-- PENTING: Jangan dihapus agar backend tidak error!
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        throw new Error(`Server mengembalikan status ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setExamResultData({
          score: calculatedScore,
          status: result.status_kesiapan || 'Rendah',
        });
        setIsResultModalOpen(true); 
      } else {
        alert('Gagal mengakhiri ujian: ' + (result.message || 'Terjadi kesalahan pada server'));
      }
    } catch (error: any) {
      console.error('Error saat menyelesaikan ujian:', error);
      alert('Terjadi kesalahan koneksi/server saat mengirim jawaban: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

if (loading) {
  return (
    <div className="min-h-screen bg-[#eaf7f7] flex items-center justify-center">
      <p className="font-bold text-[#40b159] animate-pulse text-lg">Memuat Soal Ujian...</p>
    </div>
  );
}
  // ==========================================
  // LAYAR 1: PETUNJUK PENGERJAAN
  // ==========================================
  if (!isExamStarted) {
    return (
      <div className="min-h-screen bg-[#eaf7f7] flex flex-col items-center justify-center p-4 font-sans">
        <h1 className="text-2xl md:text-3xl font-extrabold text-[#2a3038] mb-6 text-center tracking-wide">
          PETUNJUK PENGERJAAN SOAL CBT
        </h1>

        <div className="max-w-3xl w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 md:p-8 text-slate-700 leading-relaxed text-sm md:text-base mb-8">
          <ol className="list-decimal list-inside space-y-3">
            <li>
              Setiap paket soal terdiri atas <b>{questions.length > 0 ? questions.length : 'beberapa'} soal</b> yang wajib dikerjakan dengan cermat.
            </li>
            <li>Bacalah soal dengan saksama sebelum menjawab.</li>
            <li>
              Berikut cara mengerjakan soal dengan berbagai tipe:
              <ul className="list-[lower-alpha] list-inside pl-6 mt-1.5 space-y-1 text-slate-600">
                <li><b>Soal pilihan ganda sederhana:</b> Klik salah satu jawaban yang Anda anggap benar.</li>
                <li>
                  <b>Soal pilihan ganda kompleks (MCMA):</b> Beri tanda centang pada kotak untuk setiap jawaban yang Anda anggap benar.
                </li>
                <li>
                  <b>Soal pilihan ganda kompleks kategori:</b> Klik pilihan Benar atau Salah pada kolom tabel untuk setiap pernyataan.
                </li>
              </ul>
            </li>
            <li>Klik tombol <b>Berikutnya</b> jika Anda ingin melihat soal berikutnya.</li>
            <li>Klik tombol <b>Sebelumnya</b> jika Anda ingin melihat/memperbaiki jawaban soal sebelumnya.</li>
            <li>Untuk melihat daftar seluruh nomor soal, klik tombol <b>Daftar Soal</b>.</li>
            <li>Setelah semua soal dikerjakan dan Anda yakin, klik tombol <b>Akhiri Ujian</b>.</li>
          </ol>
        </div>

        <div className="flex items-center justify-center gap-4 w-full max-w-xl">
          <button
            onClick={() => setIsExamStarted(true)}
            className="flex-1 py-3.5 px-6 bg-[#40b159] hover:bg-[#369a4c] text-white font-bold rounded-full transition shadow-md text-center"
          >
            Mulai Mengerjakan
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="flex-1 py-3.5 px-6 bg-white hover:bg-slate-50 text-[#40b159] border-2 border-[#40b159] font-bold rounded-full transition shadow-sm text-center"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-[#eaf7f7] flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold text-red-600 mb-2">Belum Ada Soal</h2>
        <p className="text-sm text-slate-500 mb-4">Soal untuk paket ini belum diinput oleh Admin.</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-6 py-2.5 bg-[#40b159] text-white font-bold rounded-full text-sm"
        >
          Kembali ke Dashboard
        </button>
      </div>
    );
  }

  // ==========================================
  // LAYAR 2: LEMBAR PENGERJAAN SOAL
  // ==========================================
  const currentQ = questions[currentIndex];
  const currentAns = answers[currentQ.id];

  const tipeSoal = (currentQ.tipe_soal || 'single').toLowerCase();
  const questionText = currentQ.soal || '';
const teksLanjutan = currentQ.teks_lanjutan || '';

  const optionsList = [
    { label: 'A', text: currentQ.opsi_a },
    { label: 'B', text: currentQ.opsi_b },
    { label: 'C', text: currentQ.opsi_c },
    { label: 'D', text: currentQ.opsi_d },
    { label: 'E', text: currentQ.opsi_e },
  ].filter((opt) => opt.text && String(opt.text).trim() !== '');

  // Handler Choice Single
  const handleSingleChoice = (label: string) => {
    const updatedAnswers = { ...answers, [currentQ.id]: label };
    setAnswers(updatedAnswers);
    saveAnswerToDB(currentQ.id, label);
  };

  // Handler Pilihan Ganda Kompleks
  const handleMultipleChoice = (label: string) => {
    const list = Array.isArray(currentAns) ? currentAns : [];
    const isChecked = list.includes(label);
    const next = isChecked ? list.filter((a: string) => a !== label) : [...list, label];
    const updatedAnswers = { ...answers, [currentQ.id]: next };
    setAnswers(updatedAnswers);
    saveAnswerToDB(currentQ.id, next);
  };

  // Handler Benar/Salah
 const handleTrueFalse = (optLabel: string, isTrue: boolean) => {
    const prevObj = typeof currentAns === 'object' && currentAns !== null && !Array.isArray(currentAns)
      ? (currentAns as { [key: string]: boolean })
      : {};
    const nextObj = { ...prevObj, [optLabel]: isTrue };
    const updatedAnswers = { ...answers, [currentQ.id]: nextObj };
    setAnswers(updatedAnswers);
    saveAnswerToDB(currentQ.id, nextObj);
  };

  return (
    <div className="min-h-screen bg-[#eaf7f7] flex flex-col font-sans">
      
      {/* Top Header & Timer */}
      <header className="pt-6 pb-2 px-4 flex flex-col items-center justify-center">
        <h1 className="text-lg md:text-xl font-bold text-[#327ca6] mb-1 text-center">
          Paket Ujian CBT - Ruang Belajar
        </h1>
        <div className="text-red-500 font-extrabold text-lg md:text-xl mb-4 tracking-wider">
          {formatTime(timeLeft)}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowQuestionModal(true)}
            className="flex items-center gap-2 bg-[#52b765] hover:bg-[#439e54] text-white font-bold px-6 py-2.5 rounded-full text-sm shadow-sm transition"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            Daftar Soal
          </button>

          <button
  type="button"
  onClick={() => setIsConfirmModalOpen(true)}
  className="bg-white border-2 border-rose-500 text-rose-500 hover:bg-rose-50 font-bold px-6 py-2.5 rounded-full text-sm transition cursor-pointer"
>
  Akhiri Ujian
</button>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="w-full max-w-5xl mx-auto px-4 my-3">
        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden flex">
          <div
            className="bg-[#52b765] transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Main Question Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6 mb-20">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 md:p-8 min-h-[420px] flex flex-col justify-between">
          <div>
            
            {/* Gambar Soal (Jika Ada) */}
{currentQ.image_url && currentQ.image_url.trim() !== '' && (
  <div className="mb-6">
    <img
      src={
        currentQ.image_url.startsWith('http')
          ? currentQ.image_url
          : `https://cbt-ruangbelajar-backend.vercel.app${currentQ.image_url}`
      }
      alt="Gambar Soal"
      className="max-h-72 object-contain rounded-lg border"
    />
  </div>
)}

           {/* PERTANYAAN UTAMA (Sejajar rapi di samping nomor 1, tidak dobel, otomatis mengambil teks dari admin) */}
<div className="text-base md:text-lg text-slate-800 font-medium mb-6 leading-relaxed flex items-start">
  <span className="font-bold mr-2 flex-shrink-0">{currentIndex + 1}.</span>
  <div className="flex-1">
    {currentQ.teks_lanjutan || currentQ.teks_sesudah_gambar || currentQ.soal || questionText || ''}
  </div>
</div>

            {/* Variabel Penanda Mode Review Pembahasan */}
          {
            (() => {
              const isReviewMode = !isResultModalOpen && !showDiscussionModal && examResultData !== null;
              const keyAns = currentQ?.kunci_jawaban || currentQ?.kunciJawaban;

              return (
                <div className="space-y-4">
                  
                  {/* A. TIPE SINGLE CHOICE */}
                  {(tipeSoal === 'single' || tipeSoal === 'single_choice' || tipeSoal === 'pilihan_ganda') && (
                    <div className="space-y-3 pl-2">
                      {optionsList.map((opt) => {
                        const isSelected = currentAns === opt.label;
                        let optionStyle = "border-slate-300 bg-white group-hover:border-slate-400";
                        let bgCardStyle = "bg-white border-slate-200 text-slate-700";
                        let badgeLabel = null;

                        if (isReviewMode) {
                          const isUserChoice = String(opt.label).trim().toUpperCase() === String(currentAns).trim().toUpperCase();
                          const isKeyChoice = String(opt.label).trim().toUpperCase() === String(keyAns).trim().toUpperCase();
                          const userIsWrong = String(currentAns).trim().toUpperCase() !== String(keyAns).trim().toUpperCase();

                          if (isKeyChoice && userIsWrong) {
                            // Siswa salah -> Kunci benar dimunculkan HIJAU
                            bgCardStyle = "bg-emerald-50 border-emerald-500 text-emerald-900 font-bold";
                            optionStyle = "border-emerald-500 bg-emerald-500";
                            badgeLabel = <span className="ml-auto text-xs bg-emerald-500 text-white px-3 py-1 rounded-full font-semibold">Kunci Benar</span>;
                          } else if (isUserChoice && userIsWrong) {
                            // Siswa salah -> Pilihan siswa dimunculkan MERAH
                            bgCardStyle = "bg-rose-50 border-rose-500 text-rose-900 font-bold";
                            optionStyle = "border-rose-500 bg-rose-500";
                            badgeLabel = <span className="ml-auto text-xs bg-rose-500 text-white px-3 py-1 rounded-full font-semibold">Pilihan Kamu (Salah)</span>;
                          } else if (isUserChoice && !userIsWrong) {
                            // Siswa benar -> Cukup hijau, TANPA warna merah
                            bgCardStyle = "bg-emerald-50 border-emerald-500 text-emerald-900 font-bold";
                            optionStyle = "border-emerald-500 bg-emerald-500";
                            badgeLabel = <span className="ml-auto text-xs bg-emerald-500 text-white px-3 py-1 rounded-full font-semibold">Jawaban Kamu (Benar)</span>;
                          }
                        } else if (isSelected) {
                          optionStyle = "border-[#327ca6] bg-[#327ca6]";
                          bgCardStyle = "bg-sky-50 border-sky-400 text-sky-900";
                        }

                        return (
                          <div
                            key={opt.label}
                            onClick={() => {
                              if (!isReviewMode) handleSingleChoice(opt.label);
                            }}
                            className={`flex items-center p-3.5 rounded-xl border-2 transition-all ${isReviewMode ? 'cursor-default' : 'cursor-pointer'} ${bgCardStyle}`}
                          >
                            <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all mr-3 ${optionStyle}`}>
                              {(isSelected || (isReviewMode && String(opt.label).trim().toUpperCase() === String(keyAns).trim().toUpperCase() && String(currentAns).trim().toUpperCase() !== String(keyAns).trim().toUpperCase())) && (
                                <div className="w-2 h-2 rounded-full bg-white" />
                              )}
                            </div>
                            <span className="text-sm md:text-base leading-snug flex-1">
                              {opt.text}
                            </span>
                            {badgeLabel}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* B. TIPE MULTIPLE CHOICE */}
                  {(tipeSoal === 'multiple' || tipeSoal === 'multiple_choice') && (
                    <div className="space-y-3 pl-2">
                      {optionsList.map((opt) => {
                        const list = Array.isArray(currentAns) ? currentAns : [];
                        const isChecked = list.includes(opt.label);
                        const keyList = Array.isArray(keyAns) ? keyAns : [keyAns];

                        let optionStyle = "border-slate-300 bg-white group-hover:border-slate-400";
                        let bgCardStyle = "bg-white border-slate-200 text-slate-700";
                        let badgeLabel = null;

                        if (isReviewMode) {
                          const isKeyMatch = keyList.map(k => String(k).trim().toUpperCase()).includes(String(opt.label).trim().toUpperCase());
                          const isUserMatch = list.map(u => String(u).trim().toUpperCase()).includes(String(opt.label).trim().toUpperCase());
                          
                          // Cek apakah jawaban multiple siswa secara keseluruhan benar atau ada yang meleset
                          const isAllCorrect = keyList.length === list.length && keyList.every(k => list.includes(k));

                          if (isKeyMatch && !isAllCorrect) {
                            // Ada yang salah -> Kunci yang belum terpilih dimunculkan HIJAU
                            bgCardStyle = "bg-emerald-50 border-emerald-500 text-emerald-900 font-bold";
                            optionStyle = "border-emerald-500 bg-emerald-500";
                            badgeLabel = <span className="ml-auto text-xs bg-emerald-500 text-white px-3 py-1 rounded-full font-semibold">Kunci Benar</span>;
                          } else if (isUserMatch && !isAllCorrect) {
                            // Pilihan siswa yang meleset/salah -> MERAH
                            bgCardStyle = "bg-rose-50 border-rose-500 text-rose-900 font-bold";
                            optionStyle = "border-rose-500 bg-rose-500";
                            badgeLabel = <span className="ml-auto text-xs bg-rose-500 text-white px-3 py-1 rounded-full font-semibold">Pilihan Kamu (Salah)</span>;
                          } else if (isUserMatch && isAllCorrect) {
                            // Siswa benar semua -> HIJAU tanpa merah
                            bgCardStyle = "bg-emerald-50 border-emerald-500 text-emerald-900 font-bold";
                            optionStyle = "border-emerald-500 bg-emerald-500";
                            badgeLabel = <span className="ml-auto text-xs bg-emerald-500 text-white px-3 py-1 rounded-full font-semibold">Jawaban Kamu (Benar)</span>;
                          }
                        } else if (isChecked) {
                          optionStyle = "border-[#327ca6] bg-[#327ca6]";
                          bgCardStyle = "bg-sky-50 border-sky-400 text-sky-900";
                        }

                        return (
                          <div
                            key={opt.label}
                            onClick={() => {
                              if (!isReviewMode) handleMultipleChoice(opt.label);
                            }}
                            className={`flex items-center p-3.5 rounded-xl border-2 transition-all ${isReviewMode ? 'cursor-default' : 'cursor-pointer'} ${bgCardStyle}`}
                          >
                            <div className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all mr-3 ${optionStyle}`}>
                              {(isChecked || (isReviewMode && Array.isArray(keyList) && keyList.includes(opt.label))) && (
                                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className="text-sm md:text-base leading-snug flex-1">
                              {opt.text}
                            </span>
                            {badgeLabel}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* C. TIPE TRUE / FALSE */}
                  {(tipeSoal === 'true_false' || tipeSoal === 'tf' || tipeSoal === 'kategori') && (
                    <div className="overflow-x-auto my-4">
                      <table className="w-full border-collapse border border-slate-200">
                        <thead>
                          <tr className="bg-slate-50 text-slate-700 text-sm border-b">
                            <th className="p-3 border-r text-left font-bold">Pernyataan</th>
                            <th className="p-3 w-28 text-center font-bold">Benar</th>
                            <th className="p-3 w-28 text-center font-bold">Salah</th>
                          </tr>
                        </thead>
                        <tbody>
                          {optionsList.map((opt) => {
                            const userChoice = currentAns?.[opt.label];
                            const correctChoice = keyAns?.[opt.label];
                            const isRowWrong = userChoice !== correctChoice;

                            return (
                              <tr key={opt.label} className="border-b hover:bg-slate-50/50">
                                <td className="p-3 border-r text-sm text-slate-700">{opt.text}</td>
                                
                                {/* Tombol Pilihan BENAR */}
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    disabled={isReviewMode}
                                    onClick={() => handleTrueFalse(opt.label, true)}
                                    className={`w-6 h-6 rounded-full border-2 mx-auto flex items-center justify-center transition ${
                                      isReviewMode
                                        ? isRowWrong && correctChoice === true
                                          ? 'border-emerald-500 bg-emerald-500' // Kunci benar (hijau) jika siswa salah
                                          : userChoice === true && isRowWrong
                                          ? 'border-rose-500 bg-rose-500'     // Pilihan siswa salah (merah)
                                          : userChoice === true && !isRowWrong
                                          ? 'border-emerald-500 bg-emerald-500' // Siswa sudah benar (hijau) tanpa merah
                                          : 'border-slate-300 bg-white'
                                        : userChoice === true 
                                        ? 'border-[#327ca6] bg-[#327ca6]' 
                                        : 'border-slate-300 bg-white'
                                    }`}
                                  >
                                    {((userChoice === true) || (isReviewMode && isRowWrong && correctChoice === true)) && (
                                      <div className="w-2.5 h-2.5 rounded-full bg-white" />
                                    )}
                                  </button>
                                </td>

                                {/* Tombol Pilihan SALAH */}
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    disabled={isReviewMode}
                                    onClick={() => handleTrueFalse(opt.label, false)}
                                    className={`w-6 h-6 rounded-full border-2 mx-auto flex items-center justify-center transition ${
                                      isReviewMode
                                        ? isRowWrong && correctChoice === false
                                          ? 'border-emerald-500 bg-emerald-500' // Kunci benar (hijau) jika siswa salah
                                          : userChoice === false && isRowWrong
                                          ? 'border-rose-500 bg-rose-500'     // Pilihan siswa salah (merah)
                                          : userChoice === false && !isRowWrong
                                          ? 'border-emerald-500 bg-emerald-500' // Siswa sudah benar (hijau) tanpa merah
                                          : 'border-slate-300 bg-white'
                                        : userChoice === false 
                                        ? 'border-[#327ca6] bg-[#327ca6]' 
                                        : 'border-slate-300 bg-white'
                                    }`}
                                  >
                                    {((userChoice === false) || (isReviewMode && isRowWrong && correctChoice === false)) && (
                                      <div className="w-2.5 h-2.5 rounded-full bg-white" />
                                    )}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                </div>
              );
            })()
          }

          </div>
        </div>
      </main>

      {/* Bottom Fixed Navigation Bar */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t border-slate-200 py-3 px-6">
        <div className="max-w-5xl mx-auto flex justify-between items-center gap-4">
          <button
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex(currentIndex - 1)}
            className="px-6 py-2.5 bg-[#29aae1] hover:bg-[#1f96c9] text-white font-bold rounded-full text-sm disabled:opacity-30 transition shadow-sm"
          >
            Sebelumnya
          </button>

          <button
            disabled={currentIndex === questions.length - 1}
            onClick={() => setCurrentIndex(currentIndex + 1)}
            className="px-6 py-2.5 bg-[#52b765] hover:bg-[#439e54] text-white font-bold rounded-full text-sm disabled:opacity-30 transition shadow-sm ml-auto"
          >
            Berikutnya
          </button>
        </div>
      </footer>

      {/* Modal Daftar Soal */}
      {showQuestionModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border">
            <div className="flex justify-between items-center mb-4 pb-3 border-b">
              <h3 className="font-bold text-slate-800 text-lg">Daftar Nomor Soal</h3>
              <button
                onClick={() => setShowQuestionModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

           <div className="grid grid-cols-5 sm:grid-cols-8 gap-2.5 max-h-72 overflow-y-auto p-1">
  {questions.map((q, idx) => {
    const ansVal = answers[q.id];
    
    // Pengecekan cerdas untuk semua tipe soal (bisa string, array, atau objek benar/salah)
    let isAnswered = false;
    if (ansVal !== undefined && ansVal !== null) {
      if (Array.isArray(ansVal)) {
        isAnswered = ansVal.length > 0;
      } else if (typeof ansVal === 'object') {
        // Dianggap sudah dijawab jika objeknya memiliki minimal 1 properti
        isAnswered = Object.keys(ansVal).length > 0;
      } else {
        isAnswered = String(ansVal).trim() !== '';
      }
    }

    const isCurrent = idx === currentIndex;
    return (
      <button
        key={q.id || idx}
        onClick={() => {
          setCurrentIndex(idx);
          setShowQuestionModal(false);
        }}
        className={`h-10 rounded-xl font-bold text-sm transition flex items-center justify-center border ${
          isCurrent
            ? 'bg-[#327ca6] text-white border-[#327ca6]'
            : isAnswered
            ? 'bg-[#52b765] text-white border-[#52b765]'
            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
        }`}
      >
        {idx + 1}
      </button>
    );
  })}
</div>

            <div className="mt-6 pt-3 border-t flex justify-end">
              <button
                onClick={() => setShowQuestionModal(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-full text-sm"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

{/* MODAL KONFIRMASI (GAMBAR 2) */}
{isConfirmModalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
    <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 text-center">
      
      {/* Tombol Silang (X) */}
      <button
        type="button"
        onClick={() => setIsConfirmModalOpen(false)}
        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Judul Peringatan */}
      <h3 className="text-xl font-medium text-gray-600 mt-2 mb-4">Peringatan</h3>

      {/* Pesan Konfirmasi */}
      <p className="text-gray-500 mb-8 font-normal">Apakah Anda ingin mengakhiri Ujian ini ?</p>

      {/* Tombol Selesaikan */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => {
            setIsConfirmModalOpen(false);
            handleFinishExam();
          }}
          disabled={isSubmitting}
          className="bg-[#f43f5e] hover:bg-[#e11d48] text-white font-medium px-10 py-2.5 rounded-full shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          {isSubmitting ? 'Memproses...' : 'Selesaikan'}
        </button>
      </div>

    </div>
  </div>
)}

{/* MODAL REKAP HASIL UJIAN (INDIKATOR NAIVE BAYES) */}
{isResultModalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
    <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl p-6 md:p-8 border border-gray-100 animate-in fade-in zoom-in duration-200">
      
      {/* Header Judul Paket */}
      <div className="text-center mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-700 tracking-wide mb-1">
          Paket Ujian CBT - Ruang Belajar
        </h1>
        <div className="flex justify-between items-center text-xs md:text-sm text-sky-500 font-medium px-2 mt-2">
          <span>Paket 1 Ujian CBT - Tarka Fest</span>
          <span className="text-gray-400 font-normal">07/10/2026</span>
        </div>
      </div>

      {/* Grid Dua Kolom (Total Skor & Indikator Nilai Naïve Bayes) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        
        {/* Box Kiri: TOTAL SKOR */}
        <div className="bg-[#60a5fa] rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between border border-blue-300">
          <div className="bg-[#3b82f6]/30 py-3 text-center">
            <h2 className="text-white font-bold text-base md:text-lg tracking-wider">
              TOTAL SKOR
            </h2>
          </div>
          <div className="py-10 text-center">
            <span className="text-white font-extrabold text-5xl md:text-6xl tracking-tight">
              {Number(examResultData.score).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Box Kanan: INDIKATOR NILAI NAÏVE BAYES */}
        <div className="bg-[#f3f4f6] rounded-2xl overflow-hidden shadow-sm border border-gray-200 flex flex-col justify-between">
          <div className="bg-gray-300 py-3 text-center">
            <h2 className="text-gray-700 font-bold text-base md:text-lg tracking-wider">
              INDIKATOR NILAI
            </h2>
          </div>
          <div className="p-4 md:p-6 text-center space-y-2.5 font-semibold text-sm md:text-base flex flex-col justify-center h-full">
            <div className={`p-2 rounded-xl transition-all ${examResultData.score >= 80 ? 'bg-emerald-100 ring-2 ring-emerald-500 font-bold' : 'opacity-50'}`}>
              <span className="text-emerald-600">80 - 100 = Tinggi</span>
            </div>
            <div className={`p-2 rounded-xl transition-all ${examResultData.score >= 60 && examResultData.score < 80 ? 'bg-amber-100 ring-2 ring-amber-500 font-bold' : 'opacity-50'}`}>
              <span className="text-amber-600">60 - 79 = Sedang</span>
            </div>
            <div className={`p-2 rounded-xl transition-all ${examResultData.score < 60 ? 'bg-rose-100 ring-2 ring-rose-500 font-bold' : 'opacity-50'}`}>
              <span className="text-rose-600">0 - 59 = Rendah</span>
            </div>
          </div>
        </div>

      </div>

      {/* Tombol Aksi Bawah */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-gray-100">
        <div className="flex gap-2 w-full sm:w-auto">
          <button
  type="button"
  onClick={() => {
    setIsResultModalOpen(false); // Tutup modal hasil
    setShowDiscussionModal(true); // Buka modal daftar pembahasan
  }}
  className="flex-1 sm:flex-none bg-[#4ad076] hover:bg-[#3fb867] text-white font-semibold px-6 py-2.5 rounded-full shadow-xs transition cursor-pointer text-sm"
>
  Pembahasan
</button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex-1 sm:flex-none bg-[#38bdf8] hover:bg-[#0284c7] text-white font-semibold px-6 py-2.5 rounded-full shadow-sm transition cursor-pointer text-sm"
          >
            Ulangi
          </button>
        </div>

        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="w-full sm:w-auto border-2 border-[#38bdf8] text-[#38bdf8] hover:bg-sky-50 font-semibold px-8 py-2.5 rounded-full transition cursor-pointer text-sm"
        >
          Kembali
        </button>
      </div>

    </div>
  </div>
)}

{/* MODAL POP-UP DAFTAR NOMOR SOAL (PEMBAHASAN) */}
{showDiscussionModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
    <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 md:p-8 text-center animate-in fade-in zoom-in duration-200">
      
      {/* Tombol Silang (X) */}
      <button
        type="button"
        onClick={() => setShowDiscussionModal(false)}
        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Judul Modal */}
      <h3 className="text-gray-500 font-medium text-lg mb-4">Daftar Nomor Soal</h3>

      {/* Baris Total Soal */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <button
          type="button"
          className="w-8 h-8 rounded-lg border border-orange-400 text-orange-500 flex items-center justify-center text-sm font-bold hover:bg-orange-50 transition cursor-pointer"
        >
          &lt;
        </button>
        <span className="text-gray-600 font-medium text-sm">
          Total : {questions.length} Soal
        </span>
        <button
          type="button"
          className="w-8 h-8 rounded-lg border border-orange-400 text-orange-500 flex items-center justify-center text-sm font-bold hover:bg-orange-50 transition cursor-pointer"
        >
          &gt;
        </button>
      </div>

      {/* Grid Nomor Soal */}
      <div className="grid grid-cols-5 gap-3 max-h-64 overflow-y-auto p-2 mb-6">
        {questions.map((q, idx) => {
          const userAns = answers[q.id];
          const keyAns = q.kunci_jawaban;
          let badgeColor = 'border-gray-300 text-gray-400 bg-gray-50'; // Tidak dijawab (Abu-abu)

          if (userAns !== undefined && userAns !== null && userAns !== '') {
            if (String(userAns).trim().toUpperCase() === String(keyAns).trim().toUpperCase()) {
              badgeColor = 'border-emerald-500 text-emerald-600 bg-emerald-50 font-bold'; // Benar (Hijau)
            } else {
              badgeColor = 'border-rose-500 text-rose-600 bg-rose-50 font-bold'; // Salah (Merah)
            }
          }

          return (
            <button
              key={q.id || idx}
              type="button"
              onClick={() => {
                setCurrentIndex(idx);
                setShowDiscussionModal(false);
              }}
              className={`w-11 h-11 mx-auto rounded-full border-2 flex items-center justify-center text-base transition-all hover:scale-105 cursor-pointer ${badgeColor}`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Keterangan Warna Indikator */}
      <div className="flex justify-center items-center gap-6 text-xs text-gray-500 font-medium mb-4">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
          <span>Benar</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-rose-500 inline-block"></span>
          <span>Salah</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-gray-300 inline-block"></span>
          <span>Tidak Dijawab</span>
        </div>
      </div>

      {/* Footer Note */}
      <p className="text-xs text-gray-500 font-normal">
        *Klik pada nomor yang <span className="text-rose-500 font-semibold">salah</span> untuk melihat kunci jawaban
      </p>

    </div>
  </div>
)}

    </div>
  );
}

export default function ExamPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center font-bold text-[#52b765]">Memuat Ujian...</div>}>
      <ExamContent />
    </Suspense>
  );
}