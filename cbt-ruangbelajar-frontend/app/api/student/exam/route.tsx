import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.BACKEND_URL ||
  'http://139.190.107.150:5000'
).replace(/\/+$/, '');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...restPayload } = body || {};

    let targetPath = '/api/student/start-exam';
    if (action === 'answer') {
      targetPath = '/api/student/answer';
    } else if (action === 'finish') {
      targetPath = '/api/exam/finish';
    }

    const res = await fetch(`${BACKEND_URL}${targetPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(restPayload),
      cache: 'no-store',
    });

    const rawText = await res.text();
    let parsed: unknown = {};
    try {
      parsed = rawText ? JSON.parse(rawText) : {};
    } catch {
      return NextResponse.json(
        { success: false, message: 'Respons backend bukan JSON valid' },
        { status: res.ok ? 502 : res.status }
      );
    }

    return NextResponse.json(parsed, { status: res.status });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : 'Gagal memproses sesi ujian',
      },
      { status: 500 }
    );
  }
}