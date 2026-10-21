import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

// 1. Ambil Soal (GET)
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

    if (examId) {
      query += ' WHERE exam_id = ?';
      params.push(examId);
    }

    const [rows] = await connection.query(query, params);
    await connection.end();

    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 2. Hapus Soal (DELETE)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID soal wajib diisi' }, { status: 400 });
    }

    const connection = await mysql.createConnection(
      process.env.DATABASE_URL || 
      `mysql://${process.env.DB_USER || 'avnadmin'}:${process.env.DB_PASSWORD || 'AVNS_mTGopbq0kqJh5NO8OPg'}@${process.env.DB_HOST || 'mysql-a275b87-cbt-ruangbelajar.h.aivencloud.com'}:${process.env.DB_PORT || 23298}/${process.env.DB_NAME || 'defaultdb'}?ssl-mode=REQUIRED`
    );

    await connection.query('DELETE FROM questions WHERE id = ?', [id]);
    await connection.end();

    return NextResponse.json({ success: true, message: 'Soal berhasil dihapus' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}