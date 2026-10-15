import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

export async function GET() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: Number(process.env.DB_PORT) || 3306,
      ssl: {
        rejectUnauthorized: false
      }
    });

    const query = `
      SELECT 
        users.id AS user_id,
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

    const [rows] = await connection.execute(query);
    return NextResponse.json({ success: true, leaderboard: rows });
  } catch (error: any) {
    console.error('Error Leaderboard API:', error);
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}