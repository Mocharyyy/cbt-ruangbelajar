const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// ==========================================
// MIDDLEWARE CONFIGURATION
// ==========================================
const app = express();
app.use(express.json());
app.use(cors());

// ==========================================
// KONFIGURASI CLOUDINARY
// ==========================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dspyqszbi',
  api_key: process.env.CLOUDINARY_API_KEY || '857471171332955',
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ==========================================
// KONFIGURASI MULTER (MEMORY STORAGE)
// ==========================================
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ==========================================
// KONEKSI DATABASE MYSQL (CONNECTION POOL)
// ==========================================
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_ruangbelajar',
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

if (process.env.DB_SSL === 'true') {
  dbConfig.ssl = { rejectUnauthorized: false };
}

const db = mysql.createPool(dbConfig);

// ==========================================
// INISIALISASI TABEL & DATA AWAL (IDEMPOTENT)
// ==========================================
async function initializeDatabase() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        asal_sekolah VARCHAR(255),
        tingkat_kelas VARCHAR(50),
        kelas_id VARCHAR(50),
        exam_passcode VARCHAR(50),
        role VARCHAR(50) DEFAULT 'siswa',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS mapel (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama_mapel VARCHAR(100) NOT NULL,
        jenjang VARCHAR(20) NOT NULL
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS exams (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mapel_id INT NOT NULL,
        kode VARCHAR(30) DEFAULT NULL,
        judul_ujian VARCHAR(200) NOT NULL,
        jenjang VARCHAR(20) NOT NULL,
        durasi INT DEFAULT 90,
        deskripsi TEXT DEFAULT NULL,
        INDEX idx_exams_mapel (mapel_id),
        CONSTRAINT fk_exams_mapel FOREIGN KEY (mapel_id) REFERENCES mapel(id) ON DELETE CASCADE
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        exam_id INT NOT NULL,
        tipe_soal VARCHAR(50) DEFAULT 'single',
        soal TEXT,
        image_url TEXT,
        opsi_a TEXT,
        opsi_b TEXT,
        opsi_c TEXT,
        opsi_d TEXT,
        opsi_e TEXT,
        kunci_jawaban VARCHAR(100),
        INDEX idx_questions_exam (exam_id)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS student_exams (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        exam_id INT NOT NULL,
        status VARCHAR(30) DEFAULT 'ongoing',
        score INT DEFAULT 0,
        skor_akhir INT DEFAULT 0,
        status_bayes VARCHAR(100) DEFAULT NULL,
        duration INT DEFAULT 0,
        detail_jawaban LONGTEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_student_exams_user (user_id),
        INDEX idx_student_exams_exam (exam_id)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS student_answers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_exam_id INT NOT NULL,
        question_id INT NOT NULL,
        jawaban_terpilih LONGTEXT,
        UNIQUE KEY uniq_student_question (student_exam_id, question_id)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS dataset_naive_bayes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nilai_rata_rata DECIMAL(6,2) NOT NULL,
        kategori_kemampuan VARCHAR(50) NOT NULL
      )
    `);

    await db.query(`
      INSERT INTO mapel (id, nama_mapel, jenjang) VALUES
        (1, 'Matematika', 'SD'),
        (2, 'Bahasa Indonesia', 'SD'),
        (3, 'IPAS', 'SD'),
        (4, 'Matematika', 'SMP'),
        (5, 'Bahasa Indonesia', 'SMP'),
        (6, 'IPA', 'SMP'),
        (7, 'Bahasa Inggris', 'SMP'),
        (8, 'Matematika', 'SMA/SMK'),
        (9, 'Bahasa Indonesia', 'SMA/SMK'),
        (10, 'Bahasa Inggris', 'SMA/SMK')
      ON DUPLICATE KEY UPDATE
        nama_mapel = VALUES(nama_mapel),
        jenjang = VALUES(jenjang)
    `);

    await db.query(`
      INSERT INTO exams (id, mapel_id, kode, judul_ujian, jenjang, durasi, deskripsi) VALUES
        (1, 1, 'SD-01', 'Paket 1 Latihan Matematika Utama (SD)', 'SD', 90, 'Tes Kemampuan Akademik & Pemahaman Konsep SD'),
        (2, 2, 'SD-02', 'Paket 1 Latihan Bahasa Indonesia (SD)', 'SD', 90, 'Literasi Bahasa & Pemahaman Bacaan SD'),
        (3, 3, 'SD-03', 'Paket 1 Latihan IPAS (SD)', 'SD', 90, 'Pemahaman Konsep IPA & IPS SD'),
        (4, 4, 'SMP-01', 'Paket 1 Latihan Matematika Utama (SMP)', 'SMP', 90, 'Tes Kemampuan Akademik & Penalaran Matematika SMP'),
        (5, 5, 'SMP-02', 'Paket 1 Latihan Bahasa Indonesia (SMP)', 'SMP', 90, 'Literasi Bahasa & Analisis Teks SMP'),
        (6, 6, 'SMP-03', 'Paket 1 Latihan IPA (SMP)', 'SMP', 90, 'Sains & Konsep Alam Tingkat SMP'),
        (7, 7, 'SMP-04', 'Paket 1 Latihan Bahasa Inggris (SMP)', 'SMP', 90, 'Reading Comprehension & Grammar SMP'),
        (8, 8, 'SMA-01', 'Paket 1 Latihan Matematika Utama (SMA/SMK)', 'SMA/SMK', 90, 'Tes Kemampuan Akademik & Penalaran Matematika SMA/SMK'),
        (9, 9, 'SMA-02', 'Paket 1 Latihan Bahasa Indonesia (SMA/SMK)', 'SMA/SMK', 90, 'Literasi Bahasa & Pemahaman Bacaan SMA/SMK'),
        (10, 10, 'SMA-03', 'Paket 1 Latihan Bahasa Inggris (SMA/SMK)', 'SMA/SMK', 90, 'Reading & Bahasa Inggris Tingkat SMA/SMK')
      ON DUPLICATE KEY UPDATE
        mapel_id = VALUES(mapel_id),
        kode = VALUES(kode),
        judul_ujian = VALUES(judul_ujian),
        jenjang = VALUES(jenjang),
        durasi = VALUES(durasi),
        deskripsi = VALUES(deskripsi)
    `);

    const [nbRows] = await db.query('SELECT COUNT(*) AS total FROM dataset_naive_bayes');
    if ((nbRows[0]?.total || 0) === 0) {
      await db.query(`
        INSERT INTO dataset_naive_bayes (nilai_rata_rata, kategori_kemampuan) VALUES
          (88, 'Tinggi'),
          (92, 'Tinggi'),
          (82, 'Tinggi'),
          (70, 'Sedang'),
          (65, 'Sedang'),
          (60, 'Sedang'),
          (45, 'Rendah'),
          (35, 'Rendah'),
          (25, 'Rendah')
      `);
    }

    console.log('Database & Tables checked/created successfully.');
  } catch (e) {
    console.error('Database init error:', e);
  }
}

initializeDatabase();

// ==========================================
// HELPER & ALGORITMA NAIVE BAYES
// ==========================================

function getMean(array) {
  return array.reduce((a, b) => a + b, 0) / array.length;
}

function getStdDev(array, mean) {
  if (array.length <= 1) return 1;
  const variance = array.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / (array.length - 1);
  return Math.sqrt(variance) || 1;
}

function calculateGaussianPDF(x, mean, stdDev) {
  const exponent = Math.exp(-Math.pow(x - mean, 2) / (2 * Math.pow(stdDev, 2)));
  return (1 / (Math.sqrt(2 * Math.PI) * stdDev)) * exponent;
}

async function predictNaiveBayes(nilaiSiswa, dbConn) {
  const [trainingData] = await dbConn.query(
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
    Tinggi: 'Sangat Siap TKA',
    Sedang: 'Sedang TKA',
    Rendah: 'Belum Siap TKA'
  };

  return mapStatusTKA[predictedClass] || 'Sedang TKA';
}

function resolveJenjangLabel(rawKelas, rawJenjang) {
  const jenjangUpper = String(rawJenjang || '').trim().toUpperCase();
  if (jenjangUpper.includes('SD') || jenjangUpper.includes('MI')) return 'SD';
  if (jenjangUpper.includes('SMP') || jenjangUpper.includes('MTS')) return 'SMP';
  if (jenjangUpper.includes('SMA') || jenjangUpper.includes('SMK') || jenjangUpper.includes('MA')) {
    return 'SMA/SMK';
  }

  const kelasNum = Number(rawKelas);
  if (!Number.isNaN(kelasNum) && kelasNum > 0) {
    if (kelasNum <= 6) return 'SD';
    if (kelasNum <= 9) return 'SMP';
    return 'SMA/SMK';
  }

  return 'SD';
}

// ==========================================
// ENDPOINT AUTH & PENDAFTARAN SISWA
// ==========================================

app.post('/api/student/register', async (req, res) => {
  try {
    const { nama, email, sekolah, kelas_id, tingkat_kelas } = req.body;
    if (!nama || !email) {
      return res.status(400).json({ success: false, message: 'Nama & email wajib diisi' });
    }

    const kelasValue = tingkat_kelas ?? kelas_id ?? '';
    const generatedPasscode = 'TK' + Math.random().toString(36).substring(2, 6).toUpperCase();

    const query = `
      INSERT INTO users (nama, email, asal_sekolah, tingkat_kelas, kelas_id, exam_passcode, role)
      VALUES (?, ?, ?, ?, ?, ?, 'siswa')
      ON DUPLICATE KEY UPDATE
        nama = VALUES(nama),
        asal_sekolah = VALUES(asal_sekolah),
        tingkat_kelas = VALUES(tingkat_kelas),
        kelas_id = VALUES(kelas_id),
        exam_passcode = VALUES(exam_passcode)
    `;

    const [result] = await db.query(query, [
      nama,
      email,
      sekolah || '',
      String(kelasValue),
      String(kelasValue),
      generatedPasscode
    ]);

    return res.json({
      success: true,
      message: 'Registrasi berhasil',
      data: {
        id: result.insertId || null,
        nama,
        email,
        sekolah: sekolah || '',
        kelas_id: kelasValue,
        tingkat_kelas: kelasValue,
        passcode: generatedPasscode
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Gagal: ' + err.message });
  }
});

app.post('/api/student/verify-passcode', async (req, res) => {
  try {
    const { email, passcode } = req.body;

    const query = 'SELECT * FROM users WHERE email = ? AND exam_passcode = ? AND role = ?';
    const [results] = await db.query(query, [email, passcode, 'siswa']);

    if (results.length === 0) {
      return res.status(401).json({ success: false, message: 'Passcode / Password acak salah atau tidak ditemukan!' });
    }

    const user = results[0];
    const kelasVal = user.tingkat_kelas || user.kelas_id || '';
    return res.json({
      success: true,
      message: 'Login berhasil',
      data: {
        id: user.id,
        nama: user.nama,
        email: user.email,
        sekolah: user.asal_sekolah,
        kelas_id: kelasVal,
        tingkat_kelas: kelasVal
      }
    });
  } catch (err) {
    console.error('Error Verify Passcode:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem' });
  }
});

// ==========================================
// ENDPOINT ADMIN (BANK SOAL & CLOUDINARY UPLOAD)
// ==========================================

app.post('/api/admin/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Tidak ada file diunggah' });
    }

    const uploadToCloudinary = (fileBuffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'cbt_ruangbelajar' },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(fileBuffer);
      });
    };

    const result = await uploadToCloudinary(req.file.buffer);

    return res.json({
      success: true,
      imageUrl: result.secure_url
    });
  } catch (error) {
    console.error('Cloudinary Upload Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengunggah ke Cloudinary: ' + error.message });
  }
});

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

    return res.json({ success: true, message: 'Soal berhasil disimpan ke bank soal!' });
  } catch (error) {
    console.error('Error insert question:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

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

    return res.json({ success: true, message: 'Soal berhasil diperbarui!' });
  } catch (error) {
    console.error('Error update question:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/admin/questions/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM questions WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Soal tidak ditemukan' });
    }

    await db.query('DELETE FROM questions WHERE id = ?', [id]);

    return res.json({ success: true, message: 'Soal berhasil dihapus!' });
  } catch (error) {
    console.error('Error deleting question:', error);
    return res.status(500).json({ success: false, message: 'Gagal menghapus soal' });
  }
});

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
    return res.json({ success: true, total: rows.length, questions: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// EVALUASI & SUBMIT UJIAN SISWA
// ==========================================

function evaluateAnswer(studentAnswer, correctAnswer, questionType) {
  try {
    let cArr = [];
    if (typeof correctAnswer === 'string') {
      cArr = correctAnswer.split(',').map((v) => v.trim().toUpperCase()).filter(Boolean);
    } else if (Array.isArray(correctAnswer)) {
      cArr = correctAnswer.map((v) => String(v).trim().toUpperCase()).filter(Boolean);
    }

    if (cArr.length > 1 || questionType === 'true_false_multi') {
      let sArr = [];
      const keys = ['A', 'B', 'C', 'D', 'E'].slice(0, cArr.length);

      if (typeof studentAnswer === 'object' && studentAnswer !== null && !Array.isArray(studentAnswer)) {
        sArr = keys.map((k) => {
          const val = studentAnswer[k];
          return (val === true || val === 'true' || val === 'B' || val === 1) ? 'B' : 'S';
        });
      } else if (Array.isArray(studentAnswer)) {
        sArr = studentAnswer.slice(0, cArr.length).map((v) => (v === true || v === 'B' || v === 'benar') ? 'B' : 'S');
      } else if (typeof studentAnswer === 'string') {
        sArr = studentAnswer.split(',').map((v) => v.trim().toUpperCase()).slice(0, cArr.length);
      }

      if (sArr.length > 0) {
        if (sArr.length !== cArr.length) return false;
        return sArr.every((val, idx) => val === cArr[idx]);
      }
    }
  } catch (e) {
    console.log('Error evaluating true/false sequence:', e.message);
  }

  return String(studentAnswer ?? '').trim().toLowerCase() === String(correctAnswer ?? '').trim().toLowerCase();
}

app.post('/api/exam/submit', async (req, res) => {
  try {
    const { answers } = req.body;
    let totalScore = 0;
    let correctCount = 0;
    let wrongCount = 0;

    if (!Array.isArray(answers)) {
      return res.status(400).json({ success: false, message: 'Format jawaban tidak valid' });
    }

    for (const ans of answers) {
      const [rows] = await db.query('SELECT kunci_jawaban, tipe_soal FROM questions WHERE id = ?', [ans.question_id]);

      if (rows.length > 0) {
        const question = rows[0];
        const isCorrect = evaluateAnswer(
          ans.user_answer,
          question.kunci_jawaban,
          question.tipe_soal
        );

        if (isCorrect) {
          correctCount++;
          totalScore += 2;
        } else {
          wrongCount++;
        }
      }
    }

    return res.json({
      success: true,
      score: totalScore,
      correct: correctCount,
      wrong: wrongCount
    });
  } catch (error) {
    console.error('Error submitting exam:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// ENDPOINT SISWA (AMBIL SOAL & UJIAN)
// ==========================================

app.get('/api/exams', async (req, res) => {
  try {
    const userId = req.query.user_id;

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

    const [userRows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    }

    const user = userRows[0];
    const rawKelas = user.tingkat_kelas || user.kelas_id || req.query.kelas_id || req.query.tingkat_kelas || 6;
    const tingkatKelas = Number(rawKelas) || 6;
    const jenjangLabel = resolveJenjangLabel(tingkatKelas, req.query.jenjang);

    const queryStudent = `
      SELECT exams.*, mapel.nama_mapel AS mapel
      FROM exams
      JOIN mapel ON exams.mapel_id = mapel.id
      WHERE exams.jenjang = ?
      ORDER BY exams.id ASC
    `;

    const [exams] = await db.query(queryStudent, [jenjangLabel]);

    return res.json({
      success: true,
      user: {
        id: user.id,
        nama: user.nama,
        email: user.email,
        sekolah: user.asal_sekolah || 'Sekolah',
        tingkat_kelas: tingkatKelas,
        kelas_id: tingkatKelas,
        jenjang: jenjangLabel
      },
      exams
    });
  } catch (error) {
    console.error('Error API exams:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/student/start-exam', async (req, res) => {
  try {
    const { user_id, exam_id } = req.body;

    const [completedExam] = await db.query(
      `SELECT id, status FROM student_exams WHERE user_id = ? AND exam_id = ? AND status = 'completed'`,
      [user_id, exam_id]
    );

    if (completedExam.length > 0) {
      return res.json({
        success: false,
        is_completed: true,
        message: 'Ujian ini sudah diselesaikan. Anda tidak dapat mengulanginya kecuali direset oleh Admin.',
        student_exam_id: completedExam[0].id
      });
    }

    const [existingExam] = await db.query(
      `SELECT id FROM student_exams WHERE user_id = ? AND exam_id = ? AND status = 'ongoing'`,
      [user_id, exam_id]
    );

    let student_exam_id;
    if (existingExam.length > 0) {
      student_exam_id = existingExam[0].id;
    } else {
      const [insertResult] = await db.query(
        `INSERT INTO student_exams (user_id, exam_id, status) VALUES (?, ?, 'ongoing')`,
        [user_id, exam_id]
      );
      student_exam_id = insertResult.insertId;
    }

    return res.json({
      success: true,
      is_completed: false,
      student_exam_id
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

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
    const { student_exam_id, final_score, skor_akhir, duration, answers } = req.body;
    const rawScore = final_score !== undefined ? final_score : skor_akhir;
    const scoreVal = rawScore !== undefined ? Number(rawScore) || 0 : 0;
    const durationVal = duration !== undefined ? Number(duration) || 0 : 0;
    const answersString = answers ? JSON.stringify(answers) : null;

    const [examRow] = await db.query('SELECT user_id FROM student_exams WHERE id = ?', [student_exam_id]);
    const userId = examRow.length > 0 ? examRow[0].user_id : null;

    await db.query(
      `UPDATE student_exams
       SET score = ?, skor_akhir = ?, status = 'completed', duration = ?, detail_jawaban = ?
       WHERE id = ?`,
      [scoreVal, scoreVal, durationVal, answersString, student_exam_id]
    );

    let bayesStatus = 'Sedang TKA';
    if (userId) {
      const [allCompleted] = await db.query(
        `SELECT score FROM student_exams WHERE user_id = ? AND status = 'completed'`,
        [userId]
      );

      if (allCompleted.length > 0) {
        const totalScoreAll = allCompleted.reduce((acc, curr) => acc + Number(curr.score || 0), 0);
        const averageScore = totalScoreAll / allCompleted.length;

        bayesStatus = await predictNaiveBayes(averageScore, db);

        await db.query(
          `UPDATE student_exams SET status_bayes = ? WHERE user_id = ? AND status = 'completed'`,
          [bayesStatus, userId]
        );
      }
    }

    return res.json({
      success: true,
      message: 'Ujian berhasil diselesaikan!',
      final_score: scoreVal,
      status_bayes: bayesStatus
    });
  } catch (error) {
    console.error('Error finish exam:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/exams/:examId/questions', async (req, res) => {
  try {
    const examId = req.params.examId;

    const [questions] = await db.query('SELECT * FROM questions WHERE exam_id = ?', [examId]);
    const [examInfo] = await db.query('SELECT * FROM exams WHERE id = ?', [examId]);

    return res.json({
      success: true,
      data: questions,
      exam: examInfo.length > 0 ? examInfo[0] : null
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// LEADERBOARD & ADMIN USERS
// ==========================================

app.get('/api/leaderboard', async (req, res) => {
  try {
    const currentUserId = req.query.user_id;

    const topQuery = `
      SELECT
        u.id AS user_id,
        u.nama AS nama_siswa,
        SUM(COALESCE(se.score, se.skor_akhir, 0)) AS score,
        0 AS duration,
        MAX(COALESCE(se.status_bayes, 'Selesai')) AS status_bayes,
        COUNT(se.id) AS total_ujian_dikerjakan
      FROM student_exams se
      JOIN users u ON se.user_id = u.id
      WHERE se.status = 'completed'
      GROUP BY u.id, u.nama
      ORDER BY score DESC
    `;
    const [allRankings] = await db.query(topQuery);
    const leaderboardTop10 = allRankings.slice(0, 10);

    const [totalUsersRows] = await db.query(`SELECT COUNT(DISTINCT user_id) AS total FROM student_exams WHERE status = 'completed'`);
    const totalSiswaSelesai = totalUsersRows[0]?.total || allRankings.length;

    let userRankInfo = null;
    if (currentUserId && currentUserId !== 'undefined' && currentUserId !== 'null') {
      const userIndex = allRankings.findIndex((r) => String(r.user_id) === String(currentUserId));
      if (userIndex !== -1) {
        userRankInfo = {
          rank: userIndex + 1,
          ...allRankings[userIndex]
        };
      }
    }

    return res.json({
      success: true,
      leaderboard: leaderboardTop10,
      userRank: userRankInfo,
      totalSiswa: totalSiswaSelesai
    });
  } catch (error) {
    console.error('Error leaderboard API:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
      leaderboard: [],
      userRank: null,
      totalSiswa: 0
    });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const query = `
      SELECT id, kelas_id, nama, email, exam_passcode, asal_sekolah, tingkat_kelas, role, created_at
      FROM users
      ORDER BY created_at DESC
    `;
    const [rows] = await db.query(query);
    return res.json({ success: true, users: rows });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM users WHERE id = ?', [id]);
    return res.json({ success: true, message: 'User berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// RUN SERVER
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server Backend berjalan di http://localhost:${PORT}`);
});