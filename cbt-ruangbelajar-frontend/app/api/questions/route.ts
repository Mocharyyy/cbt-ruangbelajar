import { NextResponse } from 'next/server';
// Impor koneksi database Anda di sini (misalnya mysql2 pool)
// import db from '@/lib/db'; 

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('exam_id');

    // Contoh query database langsung di Next.js API Route
    // const [rows] = await db.query('SELECT * FROM questions WHERE exam_id = ?', [examId]);

    return NextResponse.json({
      success: true,
      questions: [] // masukkan hasil rows database di sini
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}