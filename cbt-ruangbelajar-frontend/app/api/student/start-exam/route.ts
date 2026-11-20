import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.BACKEND_URL ||
  'http://139.190.107.150:5000'
).replace(/\/+$/, '');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${BACKEND_URL}/api/student/start-exam`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const rawText = await res.text();
    const data = rawText ? JSON.parse(rawText) : {};
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : 'Gagal memulai ujian',
      },
      { status: 500 }
    );
  }
}