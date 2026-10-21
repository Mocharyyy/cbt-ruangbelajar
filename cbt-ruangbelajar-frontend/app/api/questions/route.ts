import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('exam_id');

    const connection = await mysql.createConnection(
      process.env.DATABASE_URL || 
      `mysql://${process.env.DB_USER || 'avnadmin'}:${process.env.DB_PASSWORD || 'AVNS_mTGopbq0kqJh5NO8OPg'}@${process.env.DB_HOST || 'mysql-a275b87-cbt-ruangbelajar.h.aivencloud.com'}:${process.env.DB_PORT || 23298}/${process.env.DB_NAME || 'defaultdb'}?ssl-mode=REQUIRED`
    );

    let query = 'SELECT * FROM questions';
    let params: any[] = [];

    // Jika ada parameter exam_id, filter berdasarkan exam_id
    if (examId) {
      query += ' WHERE exam_id = ?';
      params.push(examId);
    }

    const [rows] = await connection.query(query, params);
    await connection.end();

    // Kembalikan data dalam format array langsung agar terbaca oleh frontend
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}