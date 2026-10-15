'use client';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// Ambil URL Backend dari Environment Variable Vercel (fallback ke localhost jika dijalankan lokal)
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function AddEditQuestionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const examId = searchParams.get('exam_id') || '1';
  const editId = searchParams.get('edit_id');

  const [formData, setFormData] = useState({
    exam_id: examId,
    tipe_soal: 'single', // Tipe: 'single', 'multiple', 'true_false'
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

  const [files, setFiles] = useState<{ [key: string]: File | null }>({
    gambar_soal: null,
    opsi_a_img: null,
    opsi_b_img: null,
    opsi_c_img: null,
    opsi_d_img: null,
  });

  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (!editId) return;

    setIsFetching(true);
    fetch(`${API_URL}/api/admin/questions/${editId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          const q = data.data;
          setFormData({
            exam_id: q.exam_id || examId,
            tipe_soal: q.tipe_soal || 'single',
            teks_sebelum_gambar: q.teks_sebelum_gambar || q.soal || '',
            gambar_soal: q.gambar_soal || q.image_url || '',
            teks_sesudah_gambar: q.teks_sesudah_gambar || '',
            opsi_a_text: q.opsi_a_text || q.opsi_a || '',
            opsi_a_img: q.opsi_a_img || '',
            opsi_b_text: q.opsi_b_text || q.opsi_b || '',
            opsi_b_img: q.opsi_b_img || '',
            opsi_c_text: q.opsi_c_text || q.opsi_c || '',
            opsi_c_img: q.opsi_c_img || '',
            opsi_d_text: q.opsi_d_text || q.opsi_d || '',
            opsi_d_img: q.opsi_d_img || '',
            kunci_jawaban: q.kunci_jawaban || 'A',
          });
        }
      })
      .catch((err) => {
        console.error('Gagal memuat data soal:', err);
        alert('Terjadi kesalahan saat mengambil data soal lama.');
      })
      .finally(() => setIsFetching(false));
  }, [editId, examId]);

  const handleFileUpload = (field: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFiles((prev) => ({ ...prev, [field]: file }));
      const previewUrl = URL.createObjectURL(file);
      setFormData((prev) => ({ ...prev, [field]: previewUrl }));
    }
  };

  const uploadSingleFile = async (file: File): Promise<string> => {
    const uploadData = new FormData();
    uploadData.append('image', file);

    const res = await fetch(`${API_URL}/api/admin/upload`, {
      method: 'POST',
      body: uploadData,
    });

    const data = await res.json();
    if (data.success && data.imageUrl) {
      return data.imageUrl;
    }
    throw new Error('Gagal mengunggah file gambar');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payloadData: Record<string, any> = { ...formData };
      const fileKeys = ['gambar_soal', 'opsi_a_img', 'opsi_b_img', 'opsi_c_img', 'opsi_d_img'];

      for (const key of fileKeys) {
        const fileToUpload = files[key];
        if (fileToUpload) {
          const uploadedUrl = await uploadSingleFile(fileToUpload);
          payloadData[key] = uploadedUrl;
        } else if (typeof payloadData[key] === 'string' && payloadData[key].startsWith('blob:')) {
          payloadData[key] = '';
        }
      }

      const finalPayload = {
        ...payloadData,
        soal: payloadData.teks_sebelum_gambar || '',
        image_url: payloadData.gambar_soal || '',
        teks_lanjutan: payloadData.teks_sesudah_gambar || '',
      };

      const endpoint = editId
        ? `${API_URL}/api/admin/questions/${editId}`
        : `${API_URL}/api/admin/questions`;

      const method = editId ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload),
      });

      const data = await res.json();
      if (data.success) {
        alert(editId ? 'Soal berhasil diperbarui!' : 'Soal berhasil ditambahkan!');
        router.push(`/admin/questions?exam_id=${examId}`);
      } else {
        alert('Gagal menyimpan soal: ' + data.message);
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat mengunggah gambar atau menyambung ke server');
    } finally {
      setLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
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
            href={`/admin/questions?exam_id=${examId}`}
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
                onChange={(e) => setFormData({ ...formData, tipe_soal: e.target.value })}
                className="w-full px-4 py-2.5 border rounded-xl font-semibold text-sm bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
              >
                <option value="single">Single Choice (Pilihan Ganda 1 Jawaban)</option>
                <option value="multiple">Multiple Choice (Pilihan Ganda Kompleks / Lebih dari 1 Jawaban)</option>
                <option value="true_false">Tabel Benar / Salah (True / False)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                Isi Soal / Pertanyaan Utama
              </label>
              <textarea
                rows={3}
                value={formData.teks_sebelum_gambar}
                onChange={(e) => setFormData({ ...formData, teks_sebelum_gambar: e.target.value })}
                className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm"
              />
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-gray-300">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Gambar Soal / Diagram (Opsional)
              </label>
              <p className="text-[11px] text-gray-400 mb-2">Kosongkan jika soal tidak menggunakan gambar.</p>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload('gambar_soal', e)}
                className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {formData.gambar_soal && (
                <img src={formData.gambar_soal} alt="Preview Soal" className="h-24 mt-2 rounded border object-contain" />
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Teks Pertanyaan Lanjutan (Opsional - Setelah Gambar)
              </label>
              <p className="text-[11px] text-gray-400 mb-2">Isi jika ada pertanyaan tambahan di bawah gambar.</p>
              <textarea
                rows={2}
                value={formData.teks_sesudah_gambar}
                onChange={(e) => setFormData({ ...formData, teks_sesudah_gambar: e.target.value })}
                className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm"
              />
            </div>

            {formData.tipe_soal === 'true_false' ? (
              <div>
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4">
                  Pernyataan Tabel (Benar / Salah)
                </h2>
                {['a', 'b', 'c', 'd'].map((opt) => {
                  const keyText = `opsi_${opt}_text` as keyof typeof formData;
                  return (
                    <div key={opt} className="mb-3 flex items-center space-x-3">
                      <span className="w-8 text-xs font-black uppercase text-blue-700">
                        {opt.toUpperCase()}.
                      </span>
                      <input
                        type="text"
                        placeholder={`Pernyataan ${opt.toUpperCase()}...`}
                        value={formData[keyText]}
                        onChange={(e) => setFormData({ ...formData, [keyText]: e.target.value })}
                        className="flex-1 px-3 py-2 border rounded-lg text-sm bg-white"
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div>
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4">
                  Pernyataan / Opsi Jawaban (Teks / Gambar Screenshot)
                </h2>
                {['a', 'b', 'c', 'd'].map((opt) => {
                  const keyText = `opsi_${opt}_text` as keyof typeof formData;
                  const keyImg = `opsi_${opt}_img` as keyof typeof formData;

                  return (
                    <div key={opt} className="p-4 mb-3 bg-slate-50 rounded-xl border border-gray-200 space-y-3">
                      <span className="text-xs font-black uppercase text-blue-700">
                        Opsi {opt.toUpperCase()}
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                          type="text"
                          placeholder={`Jawaban teks ${opt.toUpperCase()}...`}
                          value={formData[keyText]}
                          onChange={(e) => setFormData({ ...formData, [keyText]: e.target.value })}
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
                            <img src={formData[keyImg]} alt="Preview Opsi" className="h-12 mt-2 rounded border object-contain" />
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
                  onChange={(e) => setFormData({ ...formData, kunci_jawaban: e.target.value })}
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
                  {['A', 'B', 'C', 'D'].map((opt) => {
                    const selectedList = formData.kunci_jawaban.split(',').map((item) => item.trim());
                    const isChecked = selectedList.includes(opt);

                    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                      let updatedList = [...selectedList].filter((item) => item !== '');
                      if (e.target.checked) {
                        updatedList.push(opt);
                      } else {
                        updatedList = updatedList.filter((item) => item !== opt);
                      }
                      updatedList.sort();
                      setFormData({ ...formData, kunci_jawaban: updatedList.join(',') });
                    };

                    return (
                      <label key={opt} className="flex items-center space-x-2 cursor-pointer font-bold text-sm text-slate-700">
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
                  {['A', 'B', 'C', 'D'].map((opt, idx) => {
                    const currentAnswers = formData.kunci_jawaban.split(',');
                    const val = currentAnswers[idx] || 'B';

                    const handleTFChange = (newVal: string) => {
                      const arr = currentAnswers.length === 4 ? [...currentAnswers] : ['B', 'B', 'B', 'B'];
                      arr[idx] = newVal;
                      setFormData({ ...formData, kunci_jawaban: arr.join(',') });
                    };

                    return (
                      <div key={opt} className="flex flex-col space-y-1">
                        <span className="text-xs font-bold text-slate-600">Pernyataan {opt}:</span>
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
                Format kunci tersimpan di database: <strong className="text-blue-600">{formData.kunci_jawaban || '-'}</strong>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg transition duration-200 text-sm disabled:opacity-50"
            >
              {loading ? 'Menyimpan & Mengunggah Gambar...' : 'Simpan Soal Ujian'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// Komponen Pembungkus Suspense agar lolos build prerendering Vercel
export default function AddEditQuestionPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-600">Memuat halaman...</div>}>
      <AddEditQuestionContent />
    </Suspense>
  );
}