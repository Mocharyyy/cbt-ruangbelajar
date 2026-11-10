'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function ExamContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Parameter URL exam_id
  const examId = searchParams.get('exam_id') || searchParams.get('examId') || '1';
  const urlStudentExamId = searchParams.get('studentExamId');
  const [showDiscussionModal, setShowDiscussionModal] = useState(false);

  // State untuk menyimpan ID User yang sedang aktif login
  const [currentUserId, setCurrentUserId] = useState<string>('guest');
  const [studentExamId, setStudentExamId] = useState<string>(urlStudentExamId || '1');
  const [isInitializing, setIsInitializing] = useState(true);

  // 1. Ambil User ID & Inisialisasi Sesi Ujian Unik per User
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        const uid = String(parsed.id || parsed.user_id || 'guest');
        setCurrentUserId(uid);
      } else {
        const fallbackId = localStorage.getItem('user_id') || 'guest';
        setCurrentUserId(fallbackId);
      }
    } catch (e) {
      setCurrentUserId('guest');
    }
  }, []);

  useEffect(() => {
    if (currentUserId === 'guest' || urlStudentExamId) {
      if (urlStudentExamId) setStudentExamId(urlStudentExamId);
      setIsInitializing(false);
      return;
    }

    fetch('https://cbt-ruangbelajar-backend.vercel.app/api/student/start-exam', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: Number(currentUserId),
        exam_id: Number(examId),
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.student_exam_id) {
          setStudentExamId(String(data.student_exam_id));
        }
        setIsInitializing(false);
      })
      .catch((err) => {
        console.error('Gagal memulai sesi ujian:', err);
        setIsInitializing(false);
      });
  }, [currentUserId, examId, urlStudentExamId]);

  // Key LocalStorage Unik Berdasarkan User ID + Exam ID + Student Exam ID
  const timerKey = `cbt_timer_${currentUserId}_${examId}_${studentExamId}`;
  const finishedKey = `cbt_finished_${currentUserId}_${examId}_${studentExamId}`;
  const answersKey = `cbt_answers_${currentUserId}_${examId}_${studentExamId}`;

  const [isExamStarted, setIsExamStarted] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const [isExamFinished, setIsExamFinished] = useState(false);

  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: number]: any }>({});
  const [timeLeft, setTimeLeft] = useState(90 * 60);

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [examResultData, setExamResultData] = useState({
    score: 0,
    status: 'Rendah',
  });

  useEffect(() => {
    if (isInitializing) return;

    if (typeof window !== 'undefined') {
      const isFinishedSaved = localStorage.getItem(finishedKey) === 'true';
      setIsExamFinished(isFinishedSaved);

      const savedAns = localStorage.getItem(answersKey);
      if (savedAns) {
        try { setAnswers(JSON.parse(savedAns)); } catch (e) {}
      }

      const savedTime = localStorage.getItem(timerKey);
      if (savedTime !== null) {
        setTimeLeft(Number(savedTime));
      }
    }
  }, [isInitializing, finishedKey, answersKey, timerKey]);

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

  useEffect(() => {
    if (!isExamStarted || isExamFinished || isResultModalOpen || isInitializing) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinishExam();
          return 0;
        }
        const nextTime = prev - 1;
        localStorage.setItem(timerKey, String(nextTime));
        return nextTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isExamStarted, isExamFinished, isResultModalOpen, isInitializing, timerKey]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const saveAnswerToDB = async (questionId: number, answerValue: any) => {
    if (isExamFinished) return;
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

  const checkIsCorrect = (q: any, userAns: any) => {
    if (userAns === undefined || userAns === null) return false;
    let key = q.kunci_jawaban;
    if (key === undefined || key === null) return false;

    const tipe = (q.tipe_soal || 'single').toLowerCase();

    if (tipe === 'single' || tipe === 'single_choice' || tipe === 'pilihan_ganda') {
      if (typeof key === 'string') {
        try {
          const parsed = JSON.parse(key);
          if (typeof parsed === 'string') key = parsed;
        } catch (e) {}
      }
      return String(userAns).trim().toUpperCase() === String(key).trim().toUpperCase();
    }

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
      return JSON.stringify([...userArr].sort()) === JSON.stringify([...keyArr].sort());
    }

    if (tipe === 'true_false' || tipe === 'tf' || tipe === 'kategori') {
      let keyObj: { [key: string]: boolean } = {};
      if (typeof key === 'object' && key !== null && !Array.isArray(key)) {
        keyObj = key;
      } else if (typeof key === 'string') {
        try {
          const parsed = JSON.parse(key);
          if (typeof parsed === 'object' && parsed !== null) keyObj = parsed;
        } catch (e) {}
      }

      const userObj = typeof userAns === 'object' && userAns !== null && !Array.isArray(userAns) ? userAns : {};
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
        if (matchedVal !== keyObj[k]) return false;
      }
      return true;
    }

    return String(userAns).trim().toUpperCase() === String(key).trim().toUpperCase();
  };

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

      const totalSoal = questions.length > 0 ? questions.length : 1;
      const calculatedScore = Math.round((correctCount / totalSoal) * 100);

      await fetch('https://cbt-ruangbelajar-backend.vercel.app/api/exam/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_exam_id: Number(studentExamId),
          final_score: calculatedScore,
          answers: answers,
        }),
      });

      setIsExamFinished(true);
      localStorage.setItem(finishedKey, 'true');

      setExamResultData({
        score: calculatedScore,
        status: calculatedScore >= 70 ? 'Tinggi' : 'Rendah',
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

  if (loading || isInitializing) {
    return (
      <div className="min-h-screen bg-[#eaf7f7] flex items-center justify-center">
        <p className="font-bold text-[#40b159] animate-pulse text-lg">Memuat Sesi Ujian...</p>
      </div>
    );
  }

  if (!isExamStarted) {
    return (
      <div className="min-h-screen bg-[#eaf7f7] flex flex-col items-center justify-center p-4 font-sans">
        <h1 className="text-2xl md:text-3xl font-extrabold text-[#2a3038] mb-6 text-center tracking-wide">
          PETUNJUK PENGERJAAN SOAL CBT
        </h1>

        <div className="max-w-3xl w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 md:p-8 text-slate-700 leading-relaxed text-sm md:text-base mb-8">
          <ol className="list-decimal list-inside space-y-3">
            <li>Setiap paket soal terdiri atas <b>{questions.length} soal</b> yang wajib dikerjakan dengan cermat.</li>
            <li>Bacalah soal dengan saksama sebelum menjawab.</li>
            <li>Klik tombol <b>Berikutnya</b> atau <b>Sebelumnya</b> untuk navigasi soal.</li>
            <li>Setelah selesai, klik tombol <b>Akhiri Ujian</b>.</li>
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

  const handleSingleChoice = (label: string) => {
    if (isExamFinished) return;
    const updatedAnswers = { ...answers, [currentQ.id]: label };
    setAnswers(updatedAnswers);
    localStorage.setItem(answersKey, JSON.stringify(updatedAnswers));
    saveAnswerToDB(currentQ.id, label);
  };

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

      <div className="w-full max-w-5xl mx-auto px-4 my-3">
        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden flex">
          <div
            className="bg-[#52b765] transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6 mb-20">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 md:p-8 min-h-[420px] flex flex-col justify-between">
          <div>
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

            {/* B. TIPE MULTIPLE CHOICE (PILIHAN GANDA KOMPLEKS) */}
            {(tipeSoal === 'multiple' || tipeSoal === 'multiple_choice') && (
              <div className="space-y-3 pl-2">
                {optionsList.map((opt) => {
                  const list = Array.isArray(currentAns) ? currentAns : [];
                  const isChecked = list.includes(opt.label);
                  return (
                    <div
                      key={opt.label}
                      onClick={() => handleMultipleChoice(opt.label)}
                      className="flex items-start gap-3 cursor-pointer group py-2 px-3 rounded-xl border border-slate-300 hover:border-slate-400 bg-white"
                    >
                      <div className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                        isChecked ? 'border-[#327ca6] bg-[#327ca6]' : 'border-slate-300'
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
                              currentAns?.[opt.label] === true ? 'border-[#327ca6] bg-[#327ca6]' : 'border-slate-300 bg-white'
                            }`}
                          >
                            {currentAns?.[opt.label] === true && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                          </button>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleTrueFalse(opt.label, false)}
                            className={`w-6 h-6 rounded-full border-2 mx-auto flex items-center justify-center transition cursor-pointer ${
                              currentAns?.[opt.label] === false ? 'border-[#327ca6] bg-[#327ca6]' : 'border-slate-300 bg-white'
                            }`}
                          >
                            {currentAns?.[opt.label] === false && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {isExamFinished && (
              <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                <p className="font-bold text-slate-700 mb-1">Kunci Jawaban Sistem:</p>
                <p className="text-emerald-700 font-semibold">{getCorrectKeyString(currentQ)}</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t border-slate-200 py-3 px-6">
        <div className="max-w-5xl mx-auto flex justify-between items-center gap-4">
          <button
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex(currentIndex - 1)}
            className="px-6 py-2.5 bg-[#29aae1] hover:bg-[#1f96c9] text-white font-bold rounded-full text-sm disabled:opacity-30 transition shadow-sm cursor-pointer"
          >
            Sebelumnya
          </button>

          <button
            disabled={currentIndex === questions.length - 1}
            onClick={() => setCurrentIndex(currentIndex + 1)}
            className="px-6 py-2.5 bg-[#52b765] hover:bg-[#439e54] text-white font-bold rounded-full text-sm disabled:opacity-30 transition shadow-sm ml-auto cursor-pointer"
          >
            Berikutnya
          </button>
        </div>
      </footer>

      {showQuestionModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border">
            <h3 className="font-bold text-slate-800 text-lg mb-4">Daftar Nomor Soal</h3>
            <div className="grid grid-cols-5 sm:grid-cols-8 gap-2.5 max-h-72 overflow-y-auto p-1">
              {questions.map((q, idx) => (
                <button
                  key={q.id || idx}
                  onClick={() => {
                    setCurrentIndex(idx);
                    setShowQuestionModal(false);
                  }}
                  className={`h-10 rounded-xl font-bold text-sm transition flex items-center justify-center border cursor-pointer ${
                    idx === currentIndex ? 'bg-[#327ca6] text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
            <button onClick={() => setShowQuestionModal(false)} className="mt-4 px-5 py-2 bg-slate-100 rounded-full text-sm">Tutup</button>
          </div>
        </div>
      )}

      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 text-center max-w-md w-full">
            <h3 className="text-xl font-medium mb-4">Peringatan</h3>
            <p className="text-gray-500 mb-6">Apakah Anda ingin mengakhiri Ujian ini?</p>
            <button
              onClick={() => {
                setIsConfirmModalOpen(false);
                handleFinishExam();
              }}
              className="bg-rose-500 text-white px-8 py-2 rounded-full font-bold"
            >
              Selesaikan
            </button>
          </div>
        </div>
      )}

      {isResultModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 text-center">
            <h2 className="text-xl font-bold mb-2">Ujian Selesai</h2>
            <p className="text-4xl font-extrabold text-emerald-600 mb-6">{examResultData.score}</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full py-3 bg-sky-500 text-white font-bold rounded-full"
            >
              Kembali ke Dashboard
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