'use client';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type QuestionType = 'single' | 'multiple' | 'true_false';

interface QuestionFormState {
  exam_id: string;
  tipe_soal: QuestionType;
  teks_sebelum_gambar: string;
  gambar_soal: string;
  teks_sesudah_gambar: string;
  opsi_a_text: string;
  opsi_a_img: string;
  opsi_b_text: string;
  opsi_b_img: string;
  opsi_c_text: string;
  opsi_c_img: string;
  opsi_d_text: string;
  opsi_d_img: string;
  kunci_jawaban: string;
}

const DEFAULT_TF_KEY = 'B,B,B,B';

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'https://139.190.107.150.sslip.io'
).replace(/\/+$/, '');

function compressImageToDataUrl(
  file: File,
  maxWidth = 900,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Gagal memproses file gambar'));
      img.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
    reader.readAsDataURL(file);
  });
}

function AddEditQuestionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const examId = searchParams.get('exam_id') || 'sd_bindo';
  const editId = searchParams.get('edit_id');

  const [formData, setFormData] = useState<QuestionFormState>({
    exam_id: examId,
    tipe_soal: 'single',
    teks_sebelum_gambar: '',
    gambar_soal: '',
    teks_sesudah_gambar: '',
    opsi_a_text: '',
    opsi_a_img: '',
    opsi_b_text: '',
    opsi_b_img: '',
    opsi_c_text: '',
    opsi_c_img: '',
    opsi_d_text: '',
    opsi_d_img: '',
    kunci_jawaban: 'A',
  });

  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, exam_id: examId }));
  }, [examId]);

  useEffect(() => {
    if (!editId) return;

    let active = true;
    setIsFetching(true);

    fetch(`${API_BASE_URL}/api/admin/questions/${encodeURIComponent(editId)}`, {
      cache: 'no-store',
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Gagal memuat data soal lama');
        }
        return data;
      })
      .then((data) => {
        if (!active) return;
        const q =
          data.data ||
          data.question ||
          (Array.isArray(data.questions) ? data.questions[0] : null);
        if (q) {
          const loadedType: QuestionType =
            q.tipe_soal === 'multiple' || q.tipe_soal === 'true_false'
              ? q.tipe_soal
              : 'single';

          setFormData({
            exam_id: String(q.exam_id || examId),
            tipe_soal: loadedType,
            teks_sebelum_gambar: q.teks_sebelum_gambar || q.soal || '',
            gambar_soal: q.gambar_soal || q.image_url || '',
            teks_sesudah_gambar: q.teks_sesudah_gambar || q.teks_lanjutan || '',
            opsi_a_text: q.opsi_a_text || q.opsi_a || '',
            opsi_a_img: q.opsi_a_img || '',
            opsi_b_text: q.opsi_b_text || q.opsi_b || '',
            opsi_b_img: q.opsi_b_img || '',
            opsi_c_text: q.opsi_c_text || q.opsi_c || '',
            opsi_c_img: q.opsi_c_img || '',
            opsi_d_text: q.opsi_d_text || q.opsi_d || '',
            opsi_d_img: q.opsi_d_img || '',
            kunci_jawaban:
              q.kunci_jawaban ||
              (loadedType === 'true_false' ? DEFAULT_TF_KEY : 'A'),
          });
        }
      })
      .catch((err) => {
        console.error('Gagal memuat data soal:', err);
        if (active) {
          alert(
            err instanceof Error
              ? err.message
              : 'Terjadi kesalahan saat mengambil data soal lama.'
          );
        }
      })
      .finally(() => {
        if (active) setIsFetching(false);
      });

    return () => {
      active = false;
    };
  }, [editId, examId]);

  const handleTypeChange = (nextType: QuestionType) => {
    setFormData((prev) => {
      let nextKey = prev.kunci_jawaban;
      if (nextType === 'single') {
        const firstValid = prev.kunci_jawaban
          .split(',')
          .map((s) => s.trim())
          .find((s) => ['A', 'B', 'C', 'D'].includes(s));
        nextKey = firstValid || 'A';
      } else if (nextType === 'true_false') {
        const parts = prev.kunci_jawaban
          .split(',')
          .map((s) => s.trim().toUpperCase());
        const isValidTF =
          parts.length === 4 && parts.every((p) => p === 'B' || p === 'S');
        nextKey = isValidTF ? parts.join(',') : DEFAULT_TF_KEY;
      } else if (nextType === 'multiple') {
        const validOpts = prev.kunci_jawaban
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter((s) => ['A', 'B', 'C', 'D'].includes(s));
        nextKey = Array.from(new Set(validOpts)).sort().join(',') || 'A';
      }

      return {
        ...prev,
        tipe_soal: nextType,
        kunci_jawaban: nextKey,
      };
    });
  };

  const handleFileUpload = async (
    field: keyof QuestionFormState,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await compressImageToDataUrl(file);
      setFormData((prev) => ({ ...prev, [field]: dataUrl }));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal memproses gambar');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.teks_sebelum_gambar.trim() && !formData.gambar_soal) {
      alert('Isi soal atau gambar soal wajib diisi minimal salah satunya.');
      return;
    }

    if (formData.tipe_soal === 'multiple' && !formData.kunci_jawaban.trim()) {
      alert('Pilih minimal satu kunci jawaban untuk soal pilihan ganda kompleks.');
      return;
    }

    setLoading(true);

    try {
      const resolvedExamId = formData.exam_id || examId;

      const finalPayload = {
        ...formData,
        exam_id: resolvedExamId,
        pertanyaan: formData.teks_sebelum_gambar || '',
        soal: formData.teks_sebelum_gambar || '',
        image_url: formData.gambar_soal || '',
        teks_lanjutan: formData.teks_sesudah_gambar || '',
        teks_sesudah_gambar: formData.teks_sesudah_gambar || '',
        opsi_a: formData.opsi_a_text || '',
        opsi_b: formData.opsi_b_text || '',
        opsi_c: formData.opsi_c_text || '',
        opsi_d: formData.opsi_d_text || '',
        jawaban_benar: formData.kunci_jawaban,
      };

      const endpoint = editId
        ? `${API_BASE_URL}/api/admin/questions/${encodeURIComponent(editId)}`
        : `${API_BASE_URL}/api/admin/questions`;
      const method = editId ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload),
      });

      const rawText = await res.text();
      let data: { success?: boolean; message?: string; error?: string } = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw new Error('Respons server tidak valid saat menyimpan soal');
      }

      if (res.ok && data.success !== false) {
        alert(
          editId
            ? 'Soal berhasil diperbarui!'
            : 'Soal berhasil disimpan dan langsung masuk ke ujian siswa!'
        );
        router.push(
          `/admin/questions?exam_id=${encodeURIComponent(resolvedExamId)}`
        );
        router.refresh();
      } else {
        alert(
          'Gagal menyimpan soal: ' +
            (data.message || data.error || 'Kesalahan server')
        );
      }
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Gagal menyambung ke server');
    } finally {
      setLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-600 font-bold text-sm">Memuat data soal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link
            href={`/admin/questions?exam_id=${encodeURIComponent(examId)}`}
            className="text-sm font-bold text-blue-600 hover:text-blue-800 transition"
          >
            ← Kembali ke Daftar Soal
          </Link>
          <span className="text-xs font-bold bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
            Exam ID: {examId}
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-8">
          <h1 className="text-2xl font-black text-slate-800 mb-6 pb-4 border-b">
            {editId ? 'Edit Soal Ujian' : 'Input Soal Ujian Baru'}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                Tipe Soal
              </label>
              <select
                value={formData.tipe_soal}
                onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
                className="w-full px-4 py-2.5 border rounded-xl font-semibold text-sm bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
              >
                <option value="single">
                  Single Choice (Pilihan Ganda 1 Jawaban)
                </option>
                <option value="multiple">
                  Multiple Choice (Pilihan Ganda Kompleks / Lebih dari 1 Jawaban)
                </option>
                <option value="true_false">
                  Tabel Benar / Salah (True / False)
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                Isi Soal / Pertanyaan Utama (Spasi dan Enter akan terjaga rapi)
              </label>
              <textarea
                rows={4}
                value={formData.teks_sebelum_gambar}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    teks_sebelum_gambar: e.target.value,
                  })
                }
                className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm whitespace-pre-wrap"
                placeholder="Tuliskan teks soal di sini..."
              />
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-gray-300">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Gambar Soal / Diagram (Opsional)
              </label>
              <p className="text-[11px] text-gray-400 mb-2">
                Kosongkan jika soal tidak menggunakan gambar.
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload('gambar_soal', e)}
                className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {formData.gambar_soal && (
                <div className="mt-2">
                  <img
                    src={formData.gambar_soal}
                    alt="Preview Soal"
                    className="h-28 rounded border object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, gambar_soal: '' })}
                    className="mt-1 text-xs text-red-600 hover:underline font-semibold"
                  >
                    Hapus Gambar
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Teks Pertanyaan Lanjutan / Keterangan Bawah Gambar (Opsional)
              </label>
              <p className="text-[11px] text-gray-400 mb-2">
                Isi jika ada penjelasan atau pertanyaan tambahan di bawah gambar.
              </p>
              <textarea
                rows={3}
                value={formData.teks_sesudah_gambar}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    teks_sesudah_gambar: e.target.value,
                  })
                }
                className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm whitespace-pre-wrap"
                placeholder="Keterangan atau kelanjutan teks di bawah gambar..."
              />
            </div>

            {formData.tipe_soal === 'true_false' ? (
              <div>
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4">
                  Pernyataan Tabel (Benar / Salah)
                </h2>
                {(['a', 'b', 'c', 'd'] as const).map((opt) => {
                  const keyText = `opsi_${opt}_text` as const;
                  return (
                    <div key={opt} className="mb-3 flex items-center space-x-3">
                      <span className="w-8 text-xs font-black uppercase text-blue-700">
                        {opt.toUpperCase()}.
                      </span>
                      <input
                        type="text"
                        placeholder={`Pernyataan ${opt.toUpperCase()}...`}
                        value={formData[keyText]}
                        onChange={(e) =>
                          setFormData({ ...formData, [keyText]: e.target.value })
                        }
                        className="flex-1 px-3 py-2 border rounded-lg text-sm bg-white"
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div>
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4">
                  Pernyataan / Opsi Jawaban (Teks / Gambar)
                </h2>
                {(['a', 'b', 'c', 'd'] as const).map((opt) => {
                  const keyText = `opsi_${opt}_text` as const;
                  const keyImg = `opsi_${opt}_img` as const;

                  return (
                    <div
                      key={opt}
                      className="p-4 mb-3 bg-slate-50 rounded-xl border border-gray-200 space-y-3"
                    >
                      <span className="text-xs font-black uppercase text-blue-700">
                        Opsi {opt.toUpperCase()}
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                          type="text"
                          placeholder={`Jawaban teks ${opt.toUpperCase()}...`}
                          value={formData[keyText]}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              [keyText]: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                        />
                        <div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(keyImg, e)}
                            className="block w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700"
                          />
                          {formData[keyImg] && (
                            <div className="mt-2 flex items-center space-x-2">
                              <img
                                src={formData[keyImg]}
                                alt="Preview Opsi"
                                className="h-12 rounded border object-contain"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setFormData({ ...formData, [keyImg]: '' })
                                }
                                className="text-[11px] text-red-600 hover:underline font-semibold"
                              >
                                Hapus
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-4 border-t border-gray-100">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-3">
                Kunci Jawaban Benar
              </label>

              {formData.tipe_soal === 'single' && (
                <select
                  value={formData.kunci_jawaban}
                  onChange={(e) =>
                    setFormData({ ...formData, kunci_jawaban: e.target.value })
                  }
                  className="w-full md:w-1/3 px-4 py-2.5 border rounded-xl text-sm font-bold bg-white focus:ring-2 focus:ring-blue-600"
                >
                  <option value="A">Opsi A</option>
                  <option value="B">Opsi B</option>
                  <option value="C">Opsi C</option>
                  <option value="D">Opsi D</option>
                </select>
              )}

              {formData.tipe_soal === 'multiple' && (
                <div className="flex items-center space-x-6 bg-slate-50 p-4 rounded-xl border border-gray-200">
                  {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                    const selectedList = formData.kunci_jawaban
                      .split(',')
                      .map((item) => item.trim())
                      .filter(Boolean);
                    const isChecked = selectedList.includes(opt);

                    const handleCheckboxChange = (
                      e: React.ChangeEvent<HTMLInputElement>
                    ) => {
                      let updatedList = [...selectedList];
                      if (e.target.checked) {
                        if (!updatedList.includes(opt)) updatedList.push(opt);
                      } else {
                        updatedList = updatedList.filter((item) => item !== opt);
                      }
                      updatedList.sort();
                      setFormData({
                        ...formData,
                        kunci_jawaban: updatedList.join(','),
                      });
                    };

                    return (
                      <label
                        key={opt}
                        className="flex items-center space-x-2 cursor-pointer font-bold text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={handleCheckboxChange}
                          className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <span>Opsi {opt}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {formData.tipe_soal === 'true_false' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-gray-200">
                  {(['A', 'B', 'C', 'D'] as const).map((opt, idx) => {
                    const currentAnswers = formData.kunci_jawaban.split(',');
                    const val =
                      currentAnswers[idx] === 'S' || currentAnswers[idx] === 'B'
                        ? currentAnswers[idx]
                        : 'B';

                    const handleTFChange = (newVal: string) => {
                      const arr =
                        currentAnswers.length === 4
                          ? [...currentAnswers]
                          : ['B', 'B', 'B', 'B'];
                      arr[idx] = newVal;
                      setFormData({ ...formData, kunci_jawaban: arr.join(',') });
                    };

                    return (
                      <div key={opt} className="flex flex-col space-y-1">
                        <span className="text-xs font-bold text-slate-600">
                          Pernyataan {opt}:
                        </span>
                        <select
                          value={val}
                          onChange={(e) => handleTFChange(e.target.value)}
                          className="px-3 py-1.5 border rounded-lg text-sm font-bold bg-white"
                        >
                          <option value="B">Benar (B)</option>
                          <option value="S">Salah (S)</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="text-xs text-gray-400 mt-2">
                Format kunci tersimpan di database:{' '}
                <strong className="text-blue-600">
                  {formData.kunci_jawaban || '-'}
                </strong>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg transition duration-200 text-sm disabled:opacity-50"
            >
              {loading ? 'Menyimpan Soal...' : 'Simpan Soal Ujian'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function AddEditQuestionPage() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-center font-bold text-slate-600">
          Memuat halaman...
        </div>
      }
    >
      <AddEditQuestionContent />
    </Suspense>
  );
}