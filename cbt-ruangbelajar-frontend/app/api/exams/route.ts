import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

export async function GET() {
  try {
    const connection = await mysql.createConnection(
      process.env.DATABASE_URL || 
      `mysql://${process.env.DB_USER || 'avnadmin'}:${process.env.DB_PASSWORD || 'AVNS_mTGopbq0kqJh5NO8OPg'}@${process.env.DB_HOST || 'mysql-a275b87-cbt-ruangbelajar.h.aivencloud.com'}:${process.env.DB_PORT || 23298}/${process.env.DB_NAME || 'defaultdb'}?ssl-mode=REQUIRED`
    );

    const [rows] = await connection.query('SELECT * FROM exams');
    await connection.end();

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}