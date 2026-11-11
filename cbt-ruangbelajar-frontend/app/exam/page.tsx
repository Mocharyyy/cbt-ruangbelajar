'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function ExamContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const examId = searchParams.get('exam_id') || searchParams.get('examId') || '1';
  const urlStudentExamId = searchParams.get('studentExamId');
  const [showDiscussionModal, setShowDiscussionModal] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string>('guest');
  const [studentExamId, setStudentExamId] = useState<string>(urlStudentExamId || '1');
  const [isInitializing, setIsInitializing] = useState(true);

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
        } else if (data.is_completed) {
          setIsExamFinished(true);
          setStudentExamId(String(data.student_exam_id));
        }
        setIsInitializing(false);
      })
      .catch((err) => {
        console.error('Gagal memulai sesi ujian:', err);
        setIsInitializing(false);
      });
  }, [currentUserId, examId, urlStudentExamId]);

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
          keyArr = Array.isArray(parsed) 
            ? parsed.map((k: any) => String(k).trim().toUpperCase()) 
            : key.split(',').map((k: any) => k.trim().toUpperCase());
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
      let keyObj: { [key: string]: any } = {};
      if (typeof key === 'object' && key !== null && !Array.isArray(key)) {
        keyObj = key;
      } else if (typeof key === 'string') {
        try {
          const parsed = JSON.parse(key);
          if (typeof parsed === 'object' && parsed !== null) keyObj = parsed;
        } catch (e) {
          const parts = key.split(',').map(v => v.trim().toUpperCase());
          optionsList.forEach((opt, idx) => {
            if (parts[idx]) {
              keyObj[opt.label] = parts[idx] === 'B' || parts[idx] === 'BENAR' || parts[idx] === 'TRUE';
            }
          });
        }
      }

      const userObj = typeof userAns === 'object' && userAns !== null && !Array.isArray(userAns) ? userAns : {};
      const keyKeys = Object.keys(keyObj);

      if (keyKeys.length === 0) return false;

      for (const k of keyKeys) {
        const normalizedKey = k.trim().toUpperCase();
        let matchedCorrect = keyObj[k];
        if (typeof matchedCorrect === 'string') {
          matchedCorrect = matchedCorrect.toUpperCase() === 'B' || matchedCorrect.toUpperCase() === 'BENAR' || matchedCorrect === 'true';
        }

        let matchedUser = undefined;
        for (const uk of Object.keys(userObj)) {
          if (uk.trim().toUpperCase() === normalizedKey) {
            matchedUser = userObj[uk];
            break;
          }
        }

        if (Boolean(matchedUser) !== Boolean(matchedCorrect)) return false;
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
      const totalTimeSpent = (90 * 60) - timeLeft;

      await fetch('https://cbt-ruangbelajar-backend.vercel.app/api/exam/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_exam_id: Number(studentExamId),
          final_score: calculatedScore,
          duration: totalTimeSpent > 0 ? totalTimeSpent : 0,
          answers: answers,
        }),
      });

      setIsExamFinished(true);
      localStorage.setItem(finishedKey, 'true');

      setExamResultData({
        score: calculatedScore,
        status: calculatedScore >= 80 ? 'Tinggi' : calculatedScore >= 60 ? 'Sedang' : 'Rendah',
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

            {/* B. TIPE MULTIPLE CHOICE DENGAN KOREKSI WARNA */}
            {(tipeSoal === 'multiple' || tipeSoal === 'multiple_choice') && (() => {
              let keyArr: string[] = [];
              const rawKey = currentQ.kunci_jawaban;
              if (Array.isArray(rawKey)) {
                keyArr = rawKey.map((k: any) => String(k).trim().toUpperCase());
              } else if (typeof rawKey === 'string') {
                try {
                  const parsed = JSON.parse(rawKey);
                  keyArr = Array.isArray(parsed) ? parsed.map((k: any) => String(k).trim().toUpperCase()) : rawKey.split(',').map((k: any) => k.trim().toUpperCase());
                } catch (e) {
                  keyArr = rawKey.split(',').map((k: any) => k.trim().toUpperCase());
                }
              }

              const userList = Array.isArray(currentAns) ? currentAns.map((u: any) => String(u).trim().toUpperCase()) : [];

              return (
                <div className="space-y-3 pl-2">
                  {optionsList.map((opt) => {
                    const optLabel = String(opt.label).trim().toUpperCase();
                    const isChecked = userList.includes(optLabel);
                    const isCorrectOpt = keyArr.includes(optLabel);

                    let optionStyle = 'border-slate-300 bg-white';
                    let textStyle = 'text-slate-700';

                    if (isExamFinished) {
                      if (isCorrectOpt) {
                        optionStyle = 'border-emerald-500 bg-emerald-100';
                        textStyle = 'text-emerald-900 font-bold';
                      } else if (isChecked && !isCorrectOpt) {
                        optionStyle = 'border-rose-500 bg-rose-100';
                        textStyle = 'text-rose-900 font-bold';
                      }
                    } else if (isChecked) {
                      optionStyle = 'border-[#327ca6] bg-[#327ca6] text-white';
                    }

                    return (
                      <div
                        key={opt.label}
                        onClick={() => handleMultipleChoice(opt.label)}
                        className={`flex items-start gap-3 cursor-pointer group py-2.5 px-3.5 rounded-xl border transition-all ${optionStyle}`}
                      >
                        <div className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                          isChecked || (isExamFinished && isCorrectOpt) ? 'border-current bg-current text-white' : 'border-slate-300'
                        }`}>
                          {isChecked && (
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className={`text-sm md:text-base leading-snug flex-1 ${textStyle}`}>
                          <span className="font-bold mr-1.5">{opt.label}.</span>
                          {opt.text}
                          {isExamFinished && isCorrectOpt && (
                            <span className="ml-2 text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full font-semibold">Kunci Benar</span>
                          )}
                          {isExamFinished && isChecked && !isCorrectOpt && (
                            <span className="ml-2 text-xs bg-rose-600 text-white px-2 py-0.5 rounded-full font-semibold">Jawaban Anda (Salah)</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* C. TIPE TRUE / FALSE DENGAN KOREKSI WARNA AKURAT */}
            {(tipeSoal === 'true_false' || tipeSoal === 'tf' || tipeSoal === 'kategori') && (() => {
              let keyObj: { [key: string]: any } = {};
              const rawKey = currentQ.kunci_jawaban;
              if (typeof rawKey === 'object' && rawKey !== null && !Array.isArray(rawKey)) {
                keyObj = rawKey;
              } else if (typeof rawKey === 'string') {
                try {
                  const parsed = JSON.parse(rawKey);
                  if (typeof parsed === 'object' && parsed !== null) keyObj = parsed;
                } catch (e) {
                  const parts = rawKey.split(',').map(v => v.trim().toUpperCase());
                  optionsList.forEach((opt, idx) => {
                    if (parts[idx]) {
                      keyObj[opt.label] = parts[idx] === 'B' || parts[idx] === 'BENAR' || parts[idx] === 'TRUE';
                    }
                  });
                }
              }

              const userObj = typeof currentAns === 'object' && currentAns !== null && !Array.isArray(currentAns) ? currentAns : {};

              return (
                <div className="overflow-x-auto my-4">
                  <table className="w-full border-collapse border border-slate-200 rounded-xl overflow-hidden">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 text-sm border-b">
                        <th className="p-3 border-r text-left font-bold">Pernyataan</th>
                        <th className="p-3 w-28 text-center font-bold">Benar</th>
                        <th className="p-3 w-28 text-center font-bold">Salah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {optionsList.map((opt) => {
                        const optLabel = String(opt.label).trim().toUpperCase();
                        
                        let correctVal = undefined;
                        for (const k of Object.keys(keyObj)) {
                          if (k.trim().toUpperCase() === optLabel) {
                            let val = keyObj[k];
                            if (typeof val === 'string') {
                              val = val.toUpperCase() === 'B' || val.toUpperCase() === 'BENAR' || val === 'true';
                            }
                            correctVal = Boolean(val);
                            break;
                          }
                        }

                        let userVal = undefined;
                        for (const uk of Object.keys(userObj)) {
                          if (uk.trim().toUpperCase() === optLabel) {
                            userVal = Boolean(userObj[uk]);
                            break;
                          }
                        }

                        const isRowCorrect = userVal !== undefined && userVal === correctVal;

                        return (
                          <tr key={opt.label} className="border-b hover:bg-slate-50/50">
                            <td className="p-3 border-r text-sm text-slate-700">
                              <span className="font-bold mr-1.5">{opt.label}.</span>
                              {opt.text}
                              {isExamFinished && (
                                <div className="text-xs mt-1">
                                  <span className="text-emerald-700 font-semibold">Kunci: {correctVal === true ? 'Benar' : 'Salah'}</span>
                                  {userVal !== undefined && (
                                    <span className={`ml-2 px-1.5 py-0.5 rounded font-bold ${isRowCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                      {isRowCorrect ? '✓ Sesuai (Benar)' : '✗ Tidak Sesuai (Salah)'}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className={`p-3 text-center ${isExamFinished && correctVal === true ? 'bg-emerald-50' : ''}`}>
                              <button
                                type="button"
                                onClick={() => handleTrueFalse(opt.label, true)}
                                className={`w-6 h-6 rounded-full border-2 mx-auto flex items-center justify-center transition cursor-pointer ${
                                  userVal === true 
                                    ? (isExamFinished ? (correctVal === true ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-rose-600 bg-rose-600 text-white') : 'border-[#327ca6] bg-[#327ca6]')
                                    : (isExamFinished && correctVal === true ? 'border-emerald-500 bg-emerald-100' : 'border-slate-300 bg-white')
                                }`}
                              >
                                {userVal === true && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                              </button>
                            </td>
                            <td className={`p-3 text-center ${isExamFinished && correctVal === false ? 'bg-emerald-50' : ''}`}>
                              <button
                                type="button"
                                onClick={() => handleTrueFalse(opt.label, false)}
                                className={`w-6 h-6 rounded-full border-2 mx-auto flex items-center justify-center transition cursor-pointer ${
                                  userVal === false 
                                    ? (isExamFinished ? (correctVal === false ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-rose-600 bg-rose-600 text-white') : 'border-[#327ca6] bg-[#327ca6]')
                                    : (isExamFinished && correctVal === false ? 'border-emerald-500 bg-emerald-100' : 'border-slate-300 bg-white')
                                }`}
                              >
                                {userVal === false && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}

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
                let badgeColor = 'border-gray-300 text-gray-400 bg-gray-50';

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
                      badgeColor = 'border-emerald-500 text-emerald-600 bg-emerald-50 font-bold';
                    } else {
                      badgeColor = 'border-rose-500 text-rose-600 bg-rose-50 font-bold';
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