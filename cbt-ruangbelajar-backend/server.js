const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ==========================================
// MIDDLEWARE CONFIGURATION
// ==========================================
const app = express();
app.use(express.json());
app.use(cors());

// Akses folder uploads untuk gambar (http://localhost:5000/uploads/...)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// KONFIGURASI MULTER (DINAMIS DENGAN MAPEL & NOMOR SOAL)
// ==========================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const mapel = req.body.mapel 
      ? req.body.mapel.toLowerCase().trim().replace(/\s+/g, '_') 
      : 'umum';
    
    const uploadPath = path.join(__dirname, 'uploads', mapel);

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const noSoal = req.body.no_soal ? `soal_${req.body.no_soal}` : 'soal';
    const uniqueSuffix = Date.now();
    const ext = path.extname(file.originalname);
    const cleanFileName = path.basename(file.originalname, ext).toLowerCase().replace(/\s+/g, '_');

    cb(null, `${noSoal}-${uniqueSuffix}-${cleanFileName}${ext}`);
  }
});

const upload = multer({ storage });

// Koneksi Database MySQL (Connection Pool - Promise)
const db = mysql.createPool({
  host: process.env.DB_HOST || 'mysql-a275b87-cbt-ruangbelajar.h.aivencloud.com',
  user: process.env.DB_USER || 'avnadmin',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'defaultdb',
  port: process.env.DB_PORT || 23298,
  ssl: { rejectUnauthorized: false }
});

// Buat tabel otomatis
(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        asal_sekolah VARCHAR(255),
        tingkat_kelas VARCHAR(255),
        exam_passcode VARCHAR(50),
        role VARCHAR(50) DEFAULT 'siswa'
      )
    `);
  } catch (e) { console.error(e); }
})();

// ==========================================
// HELPER & ALGORITMA NAIVE BAYES
// ==========================================

function getMean(array) {
  return array.reduce((a, b) => a + b, 0) / array.length;
}

function getStdDev(array, mean) {
  const variance = array.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / (array.length - 1);
  return Math.sqrt(variance) || 1;
}

function calculateGaussianPDF(x, mean, stdDev) {
  const exponent = Math.exp(-Math.pow(x - mean, 2) / (2 * Math.pow(stdDev, 2)));
  return (1 / (Math.sqrt(2 * Math.PI) * stdDev)) * exponent;
}

async function predictNaiveBayes(nilaiSiswa, db) {
  const [trainingData] = await db.query(
    'SELECT nilai_rata_rata, kategori_kemampuan FROM dataset_naive_bayes'
  );
  
  if (trainingData.length === 0) return 'Sedang TKA';

  const categories = ['Tinggi', 'Sedang', 'Rendah'];
  const results = {};

  categories.forEach((category) => {
    const scores = trainingData
      .filter((d) => d.kategori_kemampuan === category)
      .map((d) => Number(d.nilai_rata_rata));

    if (scores.length === 0) {
      results[category] = 0;
      return;
    }

    const priorProb = scores.length / trainingData.length;
    const mean = getMean(scores);
    const stdDev = getStdDev(scores, mean);
    const likelihood = calculateGaussianPDF(nilaiSiswa, mean, stdDev);

    results[category] = priorProb * likelihood;
  });

  let predictedClass = 'Sedang';
  let maxProb = -1;

  for (const [category, prob] of Object.entries(results)) {
    if (prob > maxProb) {
      maxProb = prob;
      predictedClass = category;
    }
  }

  const mapStatusTKA = {
    'Tinggi': 'Sangat Siap TKA',
    'Sedang': 'Sedang TKA',
    'Rendah': 'Belum Siap TKA'
  };

  return mapStatusTKA[predictedClass] || 'Sedang TKA';
}

// ==========================================
// ENDPOINT AUTH & PENDAFTARAN SISWA (FIXED WITH ASYNC/AWAIT)
// ==========================================

// Endpoint Pendaftaran Siswa
app.post('/api/student/register', async (req, res) => {
  try {
    const { nama, email, sekolah, kelas_id } = req.body;
    if (!nama || !email) return res.status(400).json({ success: false, message: 'Nama & email wajib diisi' });

    const generatedPasscode = 'TK' + Math.random().toString(36).substring(2, 6).toUpperCase();

    const query = `
      INSERT INTO users (nama, email, asal_sekolah, tingkat_kelas, exam_passcode, role)
      VALUES (?, ?, ?, ?, ?, 'siswa')
      ON DUPLICATE KEY UPDATE nama=VALUES(nama), asal_sekolah=VALUES(asal_sekolah), tingkat_kelas=VALUES(tingkat_kelas), exam_passcode=VALUES(exam_passcode)
    `;

    const [result] = await db.query(query, [nama, email, sekolah || '', kelas_id || '', generatedPasscode]);

    return res.json({
      success: true,
      message: 'Registrasi berhasil',
      data: { id: result.insertId || null, nama, email, sekolah, passcode: generatedPasscode }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Gagal: ' + err.message });
  }
});

module.exports = app;

// Endpoint Verifikasi Passcode saat Login (FIXED WITH ASYNC/AWAIT)
app.post('/api/student/verify-passcode', async (req, res) => {
  try {
    const { email, passcode } = req.body;

    const query = `SELECT * FROM users WHERE email = ? AND exam_passcode = ? AND role = 'siswa'`;
    const [results] = await db.query(query, [email, passcode]);

    if (results.length === 0) {
      return res.status(401).json({ success: false, message: 'Passcode / Password acak salah atau tidak ditemukan!' });
    }

    const user = results[0];
    return res.json({
      success: true,
      message: 'Login berhasil',
      data: {
        id: user.id,
        nama: user.nama,
        email: user.email,
        sekolah: user.asal_sekolah,
        kelas_id: user.tingkat_kelas
      }
    });
  } catch (err) {
    console.error('Error Verify Passcode:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem' });
  }
});

// ==========================================
// ENDPOINT ADMIN (BANK SOAL & UPLOAD)
// ==========================================

// ==========================================
// KODE ADMIN: TAMBAH & UPDATE SOAL
// ==========================================

// 1. Upload Gambar Soal
app.post('/api/admin/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Tidak ada file diunggah' });
  }

  const mapel = req.body.mapel 
    ? req.body.mapel.toLowerCase().trim().replace(/\s+/g, '_') 
    : 'umum';

  const imageUrl = `/uploads/${mapel}/${req.file.filename}`;

  res.json({ success: true, imageUrl });
});

// 2. Tambah Soal Baru (POST) - DIPERBAIKI
app.post('/api/admin/questions', async (req, res) => {
  try {
    const { 
      exam_id, 
      tipe_soal, 
      teks_sebelum_gambar, 
      soal,
      gambar_soal, 
      image_url,
      opsi_a_text, opsi_a,
      opsi_b_text, opsi_b,
      opsi_c_text, opsi_c,
      opsi_d_text, opsi_d,
      opsi_e_text, opsi_e,
      kunci_jawaban 
    } = req.body;

    const questionText = teks_sebelum_gambar || soal || '';
    const questionImg = gambar_soal || image_url || null;
    const optA = opsi_a_text || opsi_a || '';
    const optB = opsi_b_text || opsi_b || '';
    const optC = opsi_c_text || opsi_c || '';
    const optD = opsi_d_text || opsi_d || '';
    const optE = opsi_e_text || opsi_e || '';

    // Perbaikan penanganan kunci jawaban agar rapi berbasis teks string koma bersih
    let formattedKunci = '';
    if (Array.isArray(kunci_jawaban)) {
      formattedKunci = kunci_jawaban.join(',').trim();
    } else if (typeof kunci_jawaban === 'object' && kunci_jawaban !== null) {
      formattedKunci = Object.values(kunci_jawaban).join(',').trim();
    } else {
      formattedKunci = String(kunci_jawaban || '').trim();
    }

    const query = `
      INSERT INTO questions 
      (exam_id, tipe_soal, soal, image_url, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci_jawaban) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.query(query, [
      exam_id || 1,
      tipe_soal || 'single',
      questionText,
      questionImg,
      optA, optB, optC, optD, optE,
      formattedKunci
    ]);

    res.json({ success: true, message: 'Soal berhasil disimpan ke bank soal!' });
  } catch (error) {
    console.error('Error insert question:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Update Soal (PUT) - DIPERBAIKI
app.put('/api/admin/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      tipe_soal, 
      teks_sebelum_gambar, 
      soal,
      gambar_soal, 
      image_url,
      opsi_a_text, opsi_a,
      opsi_b_text, opsi_b,
      opsi_c_text, opsi_c,
      opsi_d_text, opsi_d,
      opsi_e_text, opsi_e,
      kunci_jawaban 
    } = req.body;

    const questionText = teks_sebelum_gambar || soal || '';
    const questionImg = gambar_soal || image_url || null;
    const optA = opsi_a_text || opsi_a || '';
    const optB = opsi_b_text || opsi_b || '';
    const optC = opsi_c_text || opsi_c || '';
    const optD = opsi_d_text || opsi_d || '';
    const optE = opsi_e_text || opsi_e || '';

    // Perbaikan penanganan kunci jawaban saat update
    let formattedKunci = '';
    if (Array.isArray(kunci_jawaban)) {
      formattedKunci = kunci_jawaban.join(',').trim();
    } else if (typeof kunci_jawaban === 'object' && kunci_jawaban !== null) {
      formattedKunci = Object.values(kunci_jawaban).join(',').trim();
    } else {
      formattedKunci = String(kunci_jawaban || '').trim();
    }

    const query = `
      UPDATE questions SET 
        tipe_soal = ?, soal = ?, image_url = ?, 
        opsi_a = ?, opsi_b = ?, opsi_c = ?, opsi_d = ?, opsi_e = ?, 
        kunci_jawaban = ?
      WHERE id = ?
    `;

    await db.query(query, [
      tipe_soal || 'single',
      questionText,
      questionImg,
      optA, optB, optC, optD, optE,
      formattedKunci,
      id
    ]);

    res.json({ success: true, message: 'Soal berhasil diperbarui!' });
  } catch (error) {
    console.error('Error update question:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Endpoint Hapus Soal (Beserta Gambar Fisik)
app.delete('/api/admin/questions/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM questions WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Soal tidak ditemukan' });
    }

    const question = rows[0];

    const imageFields = [
      question.image_url,
      question.gambar_soal,
      question.opsi_a_img,
      question.opsi_b_img,
      question.opsi_c_img,
      question.opsi_d_img,
      question.opsi_e_img
    ];

    imageFields.forEach((imagePath) => {
      if (imagePath && typeof imagePath === 'string') {
        const cleanPath = imagePath.replace(/^\//, ''); 
        const fullPath = path.join(__dirname, cleanPath);

        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }
    });

    await db.query('DELETE FROM questions WHERE id = ?', [id]);

    return res.json({ success: true, message: 'Soal dan file gambar terkait berhasil dihapus!' });
  } catch (error) {
    console.error('Error deleting question:', error);
    return res.status(500).json({ success: false, message: 'Gagal menghapus soal' });
  }
});

// Endpoint untuk mengambil soal admin berdasarkan exam_id
app.get('/api/admin/questions', async (req, res) => {
  try {
    const examId = req.query.exam_id;
    let query = 'SELECT * FROM questions';
    let params = [];

    if (examId) {
      query = 'SELECT * FROM questions WHERE exam_id = ?';
      params = [examId];
    }

    const [rows] = await db.query(query, params);
    res.json({ success: true, total: rows.length, questions: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Fungsi Evaluasi Multi-Tipe Soal yang Disempurnakan
function evaluateAnswer(studentAnswer, correctAnswer, questionType) {
  try {
    // Parse JSON jika data masih berbentuk string
    let correctObj = typeof correctAnswer === 'string' ? JSON.parse(correctAnswer) : correctAnswer;
    let studentObj = typeof studentAnswer === 'string' ? JSON.parse(studentAnswer) : studentAnswer;

    // Helper untuk mengubah nilai boolean / string menjadi standar 'BENAR' atau 'SALAH'
    const normalizeVal = (val) => {
      const v = String(val ?? '').trim().toLowerCase();
      if (v === 'true' || v === 'benar' || v === 'b' || v === '1') return 'BENAR';
      if (v === 'false' || v === 'salah' || v === 's' || v === '0') return 'SALAH';
      return v.toUpperCase();
    };

    // Jika jawaban berupa objek multi-pernyataan (seperti {A: false, B: true, C: false})
    if (studentObj && correctObj && typeof studentObj === 'object' && typeof correctObj === 'object') {
      const studentVals = Object.keys(studentObj).sort().map(k => normalizeVal(studentObj[k]));
      const correctVals = Object.keys(correctObj).sort().map(k => normalizeVal(correctObj[k]));

      if (studentVals.length !== correctVals.length) return false;

      // Bandingkan isi jawaban siswa dengan kunci jawaban per baris
      for (let i = 0; i < studentVals.length; i++) {
        if (studentVals[i] !== correctVals[i]) {
          return false;
        }
      }
      return true;
    }
  } catch (err) {
    // Jika gagal parse, lanjut ke pencocokan teks biasa
  }

  // Pencocokan biasa untuk soal pilihan ganda 1 jawaban (A/B/C/D)
  return String(studentAnswer ?? '').trim().toLowerCase() === String(correctAnswer ?? '').trim().toLowerCase();
}

// Endpoint Submit & Koreksi Otomatis Ujian Siswa
app.post('/api/exam/submit', async (req, res) => {
  try {
    const { answers } = req.body; // Array jawaban siswa: [{ question_id, user_answer }]
    let totalScore = 0;
    let correctCount = 0;
    let wrongCount = 0;

    if (!Array.isArray(answers)) {
      return res.status(400).json({ success: false, message: 'Format jawaban tidak valid' });
    }

    for (let ans of answers) {
      const [rows] = await db.query('SELECT kunci_jawaban, tipe_soal FROM questions WHERE id = ?', [ans.question_id]);
      
      if (rows.length > 0) {
        const question = rows[0];
        
        // Koreksi jawaban menggunakan fungsi evaluasi multi-tipe
        const isCorrect = evaluateAnswer(
          ans.user_answer,
          question.kunci_jawaban,
          question.tipe_soal
        );

        if (isCorrect) {
          correctCount++;
          totalScore += 2; // Sesuaikan bobot nilai
        } else {
          wrongCount++;
        }
      }
    }

    res.json({ 
      success: true, 
      score: totalScore, 
      correct: correctCount, 
      wrong: wrongCount 
    });
  } catch (error) {
    console.error('Error submitting exam:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// ENDPOINT SISWA (AMBIL SOAL, JAWABAN & SELESAI UJIAN)
// ==========================================

// Endpoint /api/exams berdasarkan jenjang siswa
app.get('/api/exams', async (req, res) => {
  try {
    const userId = req.query.user_id;

    // Jika Admin (tanpa user_id)
    if (!userId) {
      const queryAll = `
        SELECT exams.*, mapel.nama_mapel AS mapel 
        FROM exams 
        JOIN mapel ON exams.mapel_id = mapel.id 
        ORDER BY exams.id ASC
      `;
      const [rows] = await db.query(queryAll);
      return res.json({ success: true, exams: rows });
    }

    // Jika Siswa
    const [userRows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      return res.json({ success: false, message: 'User tidak ditemukan' });
    }

    const user = userRows[0];
    const tingkatKelas = Number(user.tingkat_kelas) || Number(user.kelas) || 6;

    let jenjangLabel = 'SD';
    if (tingkatKelas <= 6) {
      jenjangLabel = 'SD';
    } else if (tingkatKelas <= 9) {
      jenjangLabel = 'SMP';
    } else {
      jenjangLabel = 'SMA/SMK';
    }

    // Ambil ujian murni berdasarkan kolom jenjang
    const queryStudent = `
      SELECT exams.*, mapel.nama_mapel AS mapel 
      FROM exams 
      JOIN mapel ON exams.mapel_id = mapel.id 
      WHERE exams.jenjang = ?
      ORDER BY exams.id ASC
    `;
    
    const [exams] = await db.query(queryStudent, [jenjangLabel]);

    res.json({
      success: true,
      user: {
        id: user.id,
        nama: user.nama,
        email: user.email,
        sekolah: user.asal_sekolah || user.sekolah || 'Sekolah',
        tingkat_kelas: tingkatKelas,
        jenjang: jenjangLabel
      },
      exams: exams
    });

  } catch (error) {
    console.error('Error API exams:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/student/start-exam', async (req, res) => {
  try {
    const { user_id, exam_id } = req.body;

    // Cek apakah sudah ada sesi ujian yang sedang berlangsung ('ongoing')
    let [existingExam] = await db.query(
      `SELECT id FROM student_exams WHERE user_id = ? AND exam_id = ? AND status = 'ongoing'`,
      [user_id, exam_id]
    );

    let student_exam_id;

    if (existingExam.length > 0) {
      // Gunakan sesi ujian yang sudah ada
      student_exam_id = existingExam[0].id;
    } else {
      // Jika belum ada, buat 1 sesi ujian baru
      const [insertResult] = await db.query(
        `INSERT INTO student_exams (user_id, exam_id, status) VALUES (?, ?, 'ongoing')`,
        [user_id, exam_id]
      );
      student_exam_id = insertResult.insertId;
    }

    return res.json({
      success: true,
      student_exam_id: student_exam_id
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Simpan Jawaban Siswa (FIXED WITH AUTO-CREATE EXAM SESSION)
app.post('/api/student/answer', async (req, res) => {
  try {
    const { student_exam_id, question_id, jawaban } = req.body;

    if (!student_exam_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'student_exam_id tidak boleh kosong!' 
      });
    }

    const formattedJawaban = typeof jawaban === 'object' 
      ? JSON.stringify(jawaban) 
      : jawaban;

    const query = `
      INSERT INTO student_answers (student_exam_id, question_id, jawaban_terpilih)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE jawaban_terpilih = VALUES(jawaban_terpilih)
    `;

    await db.query(query, [student_exam_id, question_id, formattedJawaban]);
    
    return res.json({ 
      success: true, 
      message: 'Jawaban berhasil disimpan' 
    });

  } catch (error) {
    console.error('Error Simpan Jawaban:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Gagal menyimpan jawaban: ' + error.message 
    });
  }
});

app.post('/api/exam/finish', async (req, res) => {
  try {
    const { student_exam_id } = req.body;

    // 1. Ambil semua jawaban siswa untuk ujian ini dari database
    const [studentAnswers] = await db.query(
      'SELECT * FROM student_answers WHERE student_exam_id = ?',
      [student_exam_id]
    );

    // 2. Ambil semua data soal beserta kunci jawabannya
    const [questions] = await db.query(
      'SELECT id, correct_answer, question_type FROM questions'
    );

    let correctCount = 0;
    let totalQuestions = questions.length;

    // 3. Evaluasi setiap jawaban siswa secara otomatis di backend
    for (let ans of studentAnswers) {
      const question = questions.find(q => q.id == ans.question_id);
      if (question) {
        // Panggil fungsi evaluateAnswer yang sudah kita buat
        const isTrue = evaluateAnswer(ans.jawaban, question.correct_answer, question.question_type);
        const statusBenarSalah = isTrue ? 1 : 0;

        if (isTrue) {
          correctCount++;
        }

        // Update status benar/salah per soal di database
        await db.query(
          'UPDATE student_answers SET is_correct = ? WHERE student_exam_id = ? AND question_id = ?',
          [statusBenarSalah, student_exam_id, ans.question_id]
        );
      }
    }

    // 4. Hitung skor akhir (Skala 0 - 100)
    const final_score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
    const status_kesiapan = final_score >= 75 ? 'SIAP' : 'BELUM SIAP';

    // 5. Simpan skor akhir ke tabel student_exams
    await db.query(
      `UPDATE student_exams SET status = 'completed', skor_akhir = ? WHERE id = ?`,
      [final_score, student_exam_id]
    );

    return res.status(200).json({
      success: true,
      message: 'Ujian berhasil diselesaikan dan dinilai otomatis',
      final_score: final_score,
      status_kesiapan: status_kesiapan
    });
  } catch (error) {
    console.error('Error finish exam:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memproses data: ' + error.message
    });
  }
});

// Tambahkan endpoint ini ke server.js
app.get('/api/exams/:examId/questions', async (req, res) => {
  try {
    const examId = req.params.examId;

    // Ambil data soal dari database berdasarkan exam_id
    const [questions] = await db.query('SELECT * FROM questions WHERE exam_id = ?', [examId]);
    
    // Ambil juga informasi ujian
    const [examInfo] = await db.query('SELECT * FROM exams WHERE id = ?', [examId]);

    res.json({
      success: true,
      data: questions, 
      exam: examInfo.length > 0 ? examInfo[0] : null
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoint Papan Peringkat (Leaderboard) dengan Akumulasi Nilai Total
app.get('/api/leaderboard', async (req, res) => {
  try {
    const query = `
      SELECT 
        users.nama AS nama_siswa, 
        SUM(student_exams.score) AS score, 
        SUM(student_exams.duration) AS duration,
        MAX(student_exams.status_bayes) AS status_bayes,
        COUNT(student_exams.id) AS total_ujian_dikerjakan
      FROM student_exams 
      JOIN users ON student_exams.user_id = users.id 
      WHERE student_exams.status = 'completed'
      GROUP BY users.id, users.nama 
      ORDER BY score DESC, duration ASC 
      LIMIT 10
    `;
    const [rows] = await db.query(query);
    res.json({ success: true, leaderboard: rows });
  } catch (error) {
    console.error('Error leaderboard:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoint Menyelesaikan Ujian (Menyimpan Skor, Status Bayes, dan Durasi Waktu)
app.post('/api/exams/finish', async (req, res) => {
  try {
    const { student_exam_id, skor_akhir, status_bayes, duration } = req.body;

    const query = `
      UPDATE student_exams 
      SET score = ?, status_bayes = ?, status = 'completed', duration = ? 
      WHERE id = ?
    `;
    await db.query(query, [skor_akhir, status_bayes, duration || 0, student_exam_id]);

    res.json({ success: true, message: 'Ujian berhasil diselesaikan!' });
  } catch (error) {
    console.error('Error finish exam:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoint untuk melihat daftar user yang mendaftar/login (Sesuai struktur tabel phpMyAdmin)
app.get('/api/admin/users', async (req, res) => {
  try {
    const query = `
      SELECT id, kelas_id, nama, email, exam_passcode, asal_sekolah, tingkat_kelas, role, created_at 
      FROM users 
      ORDER BY created_at DESC
    `;
    const [rows] = await db.query(query);
    res.json({ success: true, users: rows });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoint untuk menghapus user berdasarkan ID
app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'DELETE FROM users WHERE id = ?';
    await db.query(query, [id]);
    res.json({ success: true, message: 'User berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// RUN SERVER
// ==========================================
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server Backend berjalan di http://localhost:${PORT}`);
});