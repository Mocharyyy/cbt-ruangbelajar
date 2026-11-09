'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function ExamContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Parameter URL exam_id / examId
  const examId = searchParams.get('exam_id') || searchParams.get('examId') || '1';
  const studentExamId = searchParams.get('studentExamId') || '1';
  const [showDiscussionModal, setShowDiscussionModal] = useState(false);

  // Key LocalStorage Unik untuk Sesi Ujian Ini
  const timerKey = `cbt_timer_${examId}_${studentExamId}`;
  const finishedKey = `cbt_finished_${examId}_${studentExamId}`;
  const answersKey = `cbt_answers_${examId}_${studentExamId}`;

  // 1. State Navigasi & Status Pengerjaan
  const [isExamStarted, setIsExamStarted] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Status Apakah Ujian Sudah Diselesaikan
  const [isExamFinished, setIsExamFinished] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(finishedKey) === 'true';
    }
    return false;
  });

  // 2. State Data Soal & Jawaban (Persistent dengan LocalStorage)
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: number]: any }>(() => {
    if (typeof window !== 'undefined') {
      const savedAns = localStorage.getItem(answersKey);
      if (savedAns) {
        try { return JSON.parse(savedAns); } catch (e) { return {}; }
      }
    }
    return {};
  });

  // 3. Timer Ujian (Persistent Countdown 90 Menit = 5400 detik)
  const [timeLeft, setTimeLeft] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTime = localStorage.getItem(timerKey);
      if (savedTime !== null) {
        return Number(savedTime);
      }
    }
    return 90 * 60;
  });

  // 4. State Modal Konfirmasi & Rekap Hasil Ujian
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [examResultData, setExamResultData] = useState({
    score: 0,
    status: 'Rendah',
  });

  // 1. Fetch Soal Ujian dari Backend
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

  // 2. Timer Ujian (Berjalan dari pertama klik sampai selesai, berhenti jika ujian selesai)
  useEffect(() => {
    if (!isExamStarted || isExamFinished || isResultModalOpen) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinishExam(); // Auto submit jika waktu habis
          return 0;
        }
        const nextTime = prev - 1;
        localStorage.setItem(timerKey, String(nextTime));
        return nextTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isExamStarted, isExamFinished, isResultModalOpen, timerKey]);

  // Format Waktu (HH:MM:SS)
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  // Helper Simpan Jawaban Ke Database & LocalStorage
  const saveAnswerToDB = async (questionId: number, answerValue: any) => {
    if (isExamFinished) return; // Jangan simpan jika sudah selesai
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

  // =========================================================================
  // HELPER PERHITUNGAN & VALIDASI JAWABAN AKURAT (3 TIPE SOAL)
  // =========================================================================
  const checkIsCorrect = (q: any, userAns: any) => {
    if (userAns === undefined || userAns === null) return false;
    
    let key = q.kunci_jawaban;
    if (key === undefined || key === null) return false;

    const tipe = (q.tipe_soal || 'single').toLowerCase();

    // A. Single Choice (Pilihan Ganda)
    if (tipe === 'single' || tipe === 'single_choice' || tipe === 'pilihan_ganda') {
      if (typeof key === 'string') {
        try {
          const parsed = JSON.parse(key);
          if (typeof parsed === 'string') key = parsed;
        } catch (e) {}
      }
      return String(userAns).trim().toUpperCase() === String(key).trim().toUpperCase();
    }

    // B. Multiple Choice (Pilihan Ganda Kompleks / MCMA)
    if (tipe === 'multiple' || tipe === 'multiple_choice') {
      let keyArr: string[] = [];
      if (Array.isArray(key)) {
        keyArr = key.map((k: any) => String(k).trim().toUpperCase());
      } else if (typeof key === 'string') {
        try {
          const parsed = JSON.parse(key);
          if (Array.isArray(parsed)) {
            keyArr = parsed.map((k: any) => String(k).trim().toUpperCase());
          } else {
            keyArr = key.split(',').map((k: any) => k.trim().toUpperCase());
          }
        } catch (e) {
          keyArr = key.split(',').map((k: any) => k.trim().toUpperCase());
        }
      }

      const userArr = Array.isArray(userAns) 
        ? userAns.map((u: any) => String(u).trim().toUpperCase())
        : [];

      if (userArr.length !== keyArr.length) return false;
      
      const sortedUser = [...userArr].sort();
      const sortedKey = [...keyArr].sort();
      return JSON.stringify(sortedUser) === JSON.stringify(sortedKey);
    }

    // C. True / False Table (Benar/Salah)
    if (tipe === 'true_false' || tipe === 'tf' || tipe === 'kategori') {
      let keyObj: { [key: string]: boolean } = {};
      if (typeof key === 'object' && key !== null && !Array.isArray(key)) {
        keyObj = key;
      } else if (typeof key === 'string') {
        try {
          const parsed = JSON.parse(key);
          if (typeof parsed === 'object' && parsed !== null) {
            keyObj = parsed;
          }
        } catch (e) {}
      }

      const userObj = typeof userAns === 'object' && userAns !== null && !Array.isArray(userAns)
        ? userAns
        : {};

      const keyKeys = Object.keys(keyObj);
      const userKeys = Object.keys(userObj);

      if (keyKeys.length === 0) return false;

      for (const k of keyKeys) {
        const normalizedKey = k.trim().toUpperCase();
        let matchedVal = undefined;
        for (const uk of userKeys) {
          if (uk.trim().toUpperCase() === normalizedKey) {
            matchedVal = userObj[uk];
            break;
          }
        }
        if (matchedVal !== keyObj[k]) {
          return false;
        }
      }
      return true;
    }

    return String(userAns).trim().toUpperCase() === String(key).trim().toUpperCase();
  };

  // Helper untuk mendapatkan kunci jawaban format string murni untuk ditampilkan saat pembahasan
  const getCorrectKeyString = (q: any) => {
    let key = q.kunci_jawaban;
    if (key === undefined || key === null) return '-';
    if (typeof key === 'string') {
      try {
        const parsed = JSON.parse(key);
        if (typeof parsed === 'string') return parsed;
        if (Array.isArray(parsed)) return parsed.join(', ');
      } catch (e) {}
      return key;
    }
    if (Array.isArray(key)) return key.join(', ');
    return String(key);
  };

  // 4. Selesai Ujian & Hitung Nilai Akhir
  const handleFinishExam = async () => {
    if (isSubmitting || isExamFinished) return;
    setIsSubmitting(true);

    try {
      let correctCount = 0;

      questions.forEach((q: any) => {
        const userAns = answers[q.id];
        if (userAns !== undefined && userAns !== null) {
          if (checkIsCorrect(q, userAns)) {
            correctCount++;
          }
        }
      });

      const totalSoal = questions.length > 0 ? questions.length : 50;
      const calculatedScore = Math.round((correctCount / totalSoal) * 100);

      // Kirim hasil ke Express Backend
      const response = await fetch('https://cbt-ruangbelajar-backend.vercel.app/api/exam/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_exam_id: Number(studentExamId),
          final_score: calculatedScore,
          answers: answers,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
      }

      const result = await response.json().catch(() => ({ success: true }));

      // Set status selesai dan simpan ke localStorage
      setIsExamFinished(true);
      localStorage.setItem(finishedKey, 'true');

      setExamResultData({
        score: calculatedScore,
        status: result.status_kesiapan || 'Rendah',
      });
      setIsResultModalOpen(true); 
    } catch (error: any) {
      console.error('Error saat menyelesaikan ujian:', error);
      setIsExamFinished(true);
      localStorage.setItem(finishedKey, 'true');
      setIsResultModalOpen(true);
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
            className="flex-1 py-3.5 px-6 bg-[#40b159] hover:bg-[#369a4c] text-white font-bold rounded-full transition shadow-md text-center cursor-pointer"
          >
            Mulai Mengerjakan
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="flex-1 py-3.5 px-6 bg-white hover:bg-slate-50 text-[#40b159] border-2 border-[#40b159] font-bold rounded-full transition shadow-sm text-center cursor-pointer"
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
          className="px-6 py-2.5 bg-[#40b159] text-white font-bold rounded-full text-sm cursor-pointer"
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

  const optionsList = [
    { label: 'A', text: currentQ.opsi_a },
    { label: 'B', text: currentQ.opsi_b },
    { label: 'C', text: currentQ.opsi_c },
    { label: 'D', text: currentQ.opsi_d },
    { label: 'E', text: currentQ.opsi_e },
  ].filter((opt) => opt.text && String(opt.text).trim() !== '');

  // Handler Choice Single
  const handleSingleChoice = (label: string) => {
    if (isExamFinished) return; // Blokir ubah jawaban jika sudah selesai
    const updatedAnswers = { ...answers, [currentQ.id]: label };
    setAnswers(updatedAnswers);
    localStorage.setItem(answersKey, JSON.stringify(updatedAnswers));
    saveAnswerToDB(currentQ.id, label);
  };

  // Handler Multiple Choice
  const handleMultipleChoice = (label: string) => {
    if (isExamFinished) return;
    const list = Array.isArray(currentAns) ? currentAns : [];
    const isChecked = list.includes(label);
    const next = isChecked ? list.filter((a: string) => a !== label) : [...list, label];
    const updatedAnswers = { ...answers, [currentQ.id]: next };
    setAnswers(updatedAnswers);
    localStorage.setItem(answersKey, JSON.stringify(updatedAnswers));
    saveAnswerToDB(currentQ.id, next);
  };

  // Handler Benar/Salah
  const handleTrueFalse = (optLabel: string, isTrue: boolean) => {
    if (isExamFinished) return;
    const prevObj = typeof currentAns === 'object' && currentAns !== null && !Array.isArray(currentAns)
      ? (currentAns as { [key: string]: boolean })
      : {};
    const nextObj = { ...prevObj, [optLabel]: isTrue };
    const updatedAnswers = { ...answers, [currentQ.id]: nextObj };
    setAnswers(updatedAnswers);
    localStorage.setItem(answersKey, JSON.stringify(updatedAnswers));
    saveAnswerToDB(currentQ.id, nextObj);
  };

  return (
    <div className="min-h-screen bg-[#eaf7f7] flex flex-col font-sans">
      
      {/* Top Header & Timer */}
      <header className="pt-6 pb-2 px-4 flex flex-col items-center justify-center">
        <h1 className="text-lg md:text-xl font-bold text-[#327ca6] mb-1 text-center">
          Paket Ujian CBT - Ruang Belajar
        </h1>
        <div className={`font-extrabold text-lg md:text-xl mb-4 tracking-wider ${isExamFinished ? 'text-gray-400' : 'text-red-500'}`}>
          {isExamFinished ? 'Ujian Telah Selesai (Waktu Berhenti)' : formatTime(timeLeft)}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowQuestionModal(true)}
            className="flex items-center gap-2 bg-[#52b765] hover:bg-[#439e54] text-white font-bold px-6 py-2.5 rounded-full text-sm shadow-sm transition cursor-pointer"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            Daftar Soal
          </button>

          {!isExamFinished ? (
            <button
              type="button"
              onClick={() => setIsConfirmModalOpen(true)}
              className="bg-white border-2 border-rose-500 text-rose-500 hover:bg-rose-50 font-bold px-6 py-2.5 rounded-full text-sm transition cursor-pointer"
            >
              Akhiri Ujian
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsResultModalOpen(true)}
              className="bg-white border-2 border-sky-500 text-sky-500 hover:bg-sky-50 font-bold px-6 py-2.5 rounded-full text-sm transition cursor-pointer"
            >
              Lihat Hasil & Pembahasan
            </button>
          )}
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
            
            {/* Banner Review Mode jika Ujian Sudah Selesai */}
            {isExamFinished && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm flex justify-between items-center">
                <span>Mode Pembahasan: Anda sedang meninjau soal. Waktu berhenti dan jawaban terkunci.</span>
                <button
                  onClick={() => setIsResultModalOpen(true)}
                  className="bg-amber-600 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-amber-700"
                >
                  Kembali ke Rekap
                </button>
              </div>
            )}

            {/* Gambar Soal */}
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

            {/* Pertanyaan Utama */}
            <div className="text-base md:text-lg text-slate-800 font-medium mb-6 leading-relaxed flex items-start">
              <span className="font-bold mr-2 flex-shrink-0">{currentIndex + 1}.</span>
              <div className="flex-1">
                {currentQ.teks_lanjutan || currentQ.teks_sesudah_gambar || currentQ.soal || questionText || ''}
              </div>
            </div>

            {/* A. TIPE SINGLE CHOICE */}
            {(tipeSoal === 'single' || tipeSoal === 'single_choice' || tipeSoal === 'pilihan_ganda') && (
              <div className="space-y-3 pl-2">
                {optionsList.map((opt) => {
                  const isSelected = currentAns === opt.label;
                  const isCorrectKey = isExamFinished && String(opt.label).trim().toUpperCase() === String(currentQ.kunci_jawaban || '').trim().toUpperCase();
                  
                  let optionStyle = 'border-slate-300 group-hover:border-slate-400 bg-white';
                  let textStyle = 'text-slate-700';

                  if (isExamFinished) {
                    if (isCorrectKey) {
                      optionStyle = 'border-emerald-500 bg-emerald-100';
                      textStyle = 'text-emerald-900 font-bold';
                    } else if (isSelected && !isCorrectKey) {
                      optionStyle = 'border-rose-500 bg-rose-100';
                      textStyle = 'text-rose-900 font-bold';
                    }
                  } else if (isSelected) {
                    optionStyle = 'border-[#327ca6] bg-[#327ca6] text-white';
                  }

                  return (
                    <div
                      key={opt.label}
                      onClick={() => handleSingleChoice(opt.label)}
                      className={`flex items-start gap-3 cursor-pointer group py-2 px-3 rounded-xl border transition-all ${optionStyle}`}
                    >
                      <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                        isSelected || isCorrectKey ? 'border-current' : 'border-slate-300'
                      }`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-current" />}
                      </div>
                      <span className={`text-sm md:text-base leading-snug ${textStyle}`}>
                        <span className="font-bold mr-1.5">{opt.label}.</span>
                        {opt.text}
                        {isExamFinished && isCorrectKey && <span className="ml-2 text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full">Kunci Benar</span>}
                        {isExamFinished && isSelected && !isCorrectKey && <span className="ml-2 text-xs bg-rose-600 text-white px-2 py-0.5 rounded-full">Jawaban Anda (Salah)</span>}
                      </span>
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
                  return (
                    <div
                      key={opt.label}
                      onClick={() => handleMultipleChoice(opt.label)}
                      className="flex items-start gap-3 cursor-pointer group py-1"
                    >
                      <div className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                        isChecked ? 'border-[#327ca6] bg-[#327ca6]' : 'border-slate-300 group-hover:border-slate-400'
                      }`}>
                        {isChecked && (
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm md:text-base text-slate-700 leading-snug">
                        <span className="font-bold mr-1.5">{opt.label}.</span>
                        {opt.text}
                      </span>
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
                    {optionsList.map((opt) => (
                      <tr key={opt.label} className="border-b hover:bg-slate-50/50">
                        <td className="p-3 border-r text-sm text-slate-700">{opt.text}</td>
                        
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleTrueFalse(opt.label, true)}
                            className={`w-6 h-6 rounded-full border-2 mx-auto flex items-center justify-center transition cursor-pointer ${
                              currentAns?.[opt.label] === true 
                                ? 'border-[#327ca6] bg-[#327ca6]' 
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {currentAns?.[opt.label] === true && (
                              <div className="w-2.5 h-2.5 rounded-full bg-white" />
                            )}
                          </button>
                        </td>

                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleTrueFalse(opt.label, false)}
                            className={`w-6 h-6 rounded-full border-2 mx-auto flex items-center justify-center transition cursor-pointer ${
                              currentAns?.[opt.label] === false 
                                ? 'border-[#327ca6] bg-[#327ca6]' 
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {currentAns?.[opt.label] === false && (
                              <div className="w-2.5 h-2.5 rounded-full bg-white" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Info Kunci Jawaban jika Ujian Sudah Selesai */}
            {isExamFinished && (
              <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                <p className="font-bold text-slate-700 mb-1">Kunci Jawaban Sistem:</p>
                <p className="text-emerald-700 font-semibold">{getCorrectKeyString(currentQ)}</p>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* Bottom Fixed Navigation Bar */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t border-slate-200 py-3 px-6">
        <div className="max-w-5xl mx-auto flex justify-between items-center gap-4">
          <button
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex(currentIndex - 1)}
            className="px-6 py-2.5 bg-[#29aae1] hover:bg-[#1f96c9] text-white font-bold rounded-full text-sm disabled:opacity-30 transition shadow-sm cursor-pointer"
          >
            Sebelumnya
          </button>

          {isExamFinished && (
            <button
              onClick={() => setIsResultModalOpen(true)}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-full text-sm transition shadow-sm cursor-pointer"
            >
              Buka Rekap Hasil
            </button>
          )}

          <button
            disabled={currentIndex === questions.length - 1}
            onClick={() => setCurrentIndex(currentIndex + 1)}
            className="px-6 py-2.5 bg-[#52b765] hover:bg-[#439e54] text-white font-bold rounded-full text-sm disabled:opacity-30 transition shadow-sm ml-auto cursor-pointer"
          >
            Berikutnya
          </button>
        </div>
      </footer>

      {/* MODAL DAFTAR SOAL (SAAT EXAM) */}
      {showQuestionModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border">
            <div className="flex justify-between items-center mb-4 pb-3 border-b">
              <h3 className="font-bold text-slate-800 text-lg">Daftar Nomor Soal</h3>
              <button
                onClick={() => setShowQuestionModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-8 gap-2.5 max-h-72 overflow-y-auto p-1">
              {questions.map((q, idx) => {
                const ansVal = answers[q.id];
                
                let isAnswered = false;
                if (ansVal !== undefined && ansVal !== null) {
                  if (Array.isArray(ansVal)) {
                    isAnswered = ansVal.length > 0;
                  } else if (typeof ansVal === 'object') {
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
                    className={`h-10 rounded-xl font-bold text-sm transition flex items-center justify-center border cursor-pointer ${
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

            <div className="mt-6 pt-3 border-t flex justify-between">
              {isExamFinished && (
                <button
                  onClick={() => {
                    setShowQuestionModal(false);
                    setShowDiscussionModal(true);
                  }}
                  className="px-4 py-2 bg-emerald-100 text-emerald-800 font-bold rounded-full text-xs hover:bg-emerald-200 cursor-pointer"
                >
                  Buka Pembahasan Warna
                </button>
              )}
              <button
                onClick={() => setShowQuestionModal(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-full text-sm cursor-pointer ml-auto"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI (AKHIRI UJIAN) */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 text-center">
            
            <button
              type="button"
              onClick={() => setIsConfirmModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="text-xl font-medium text-gray-600 mt-2 mb-4">Peringatan</h3>
            <p className="text-gray-500 mb-8 font-normal">Apakah Anda ingin mengakhiri Ujian ini ?</p>

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

      {/* MODAL REKAP HASIL UJIAN */}
      {isResultModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl p-6 md:p-8 border border-gray-100 animate-in fade-in zoom-in duration-200">
            
            <div className="text-center mb-6">
              <h1 className="text-xl md:text-2xl font-bold text-gray-700 tracking-wide mb-1">
                Paket Ujian CBT - Ruang Belajar
              </h1>
              <div className="flex justify-between items-center text-xs md:text-sm text-sky-500 font-medium px-2 mt-2">
                <span>Paket Ujian CBT</span>
                <span className="text-gray-400 font-normal">Selesai</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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

            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-gray-100">
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setIsResultModalOpen(false);
                    setShowDiscussionModal(true);
                  }}
                  className="flex-1 sm:flex-none bg-[#4ad076] hover:bg-[#3fb867] text-white font-semibold px-6 py-2.5 rounded-full shadow-xs transition cursor-pointer text-sm"
                >
                  Pembahasan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Reset localStorage untuk ujian baru jika ingin diulang
                    localStorage.removeItem(timerKey);
                    localStorage.removeItem(finishedKey);
                    localStorage.removeItem(answersKey);
                    window.location.reload();
                  }}
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

      {/* MODAL POP-UP PEMBAHASAN (SINKRON DENGAN WARNA BENAR/SALAH) */}
      {showDiscussionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 md:p-8 text-center animate-in fade-in zoom-in duration-200">
            
            <button
              type="button"
              onClick={() => setShowDiscussionModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="text-gray-700 font-bold text-lg mb-1">Pembahasan Daftar Nomor Soal</h3>
            <p className="text-xs text-gray-500 mb-4">Klik nomor merah atau hijau untuk melihat detail soal & kunci jawaban</p>

            <div className="grid grid-cols-5 gap-3 max-h-64 overflow-y-auto p-2 mb-6">
              {questions.map((q, idx) => {
                const userAns = answers[q.id];
                let badgeColor = 'border-gray-300 text-gray-400 bg-gray-50'; // Tidak dijawab

                if (userAns !== undefined && userAns !== null) {
                  let isNotEmpty = false;
                  if (Array.isArray(userAns)) {
                    isNotEmpty = userAns.length > 0;
                  } else if (typeof userAns === 'object') {
                    isNotEmpty = Object.keys(userAns).length > 0;
                  } else {
                    isNotEmpty = String(userAns).trim() !== '';
                  }

                  if (isNotEmpty) {
                    if (checkIsCorrect(q, userAns)) {
                      badgeColor = 'border-emerald-500 text-emerald-600 bg-emerald-50 font-bold'; // Benar (Hijau)
                    } else {
                      badgeColor = 'border-rose-500 text-rose-600 bg-rose-50 font-bold'; // Salah (Merah)
                    }
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

            <button
              type="button"
              onClick={() => setShowDiscussionModal(false)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-full text-sm cursor-pointer"
            >
              Tutup
            </button>

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