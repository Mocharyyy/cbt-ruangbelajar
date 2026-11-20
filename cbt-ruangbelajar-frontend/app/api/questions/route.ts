import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.BACKEND_URL ||
  'http://139.190.107.150:5000'
).replace(/\/+$/, '');

async function forwardRequest(request: NextRequest, method: 'GET' | 'DELETE') {
  try {
    const searchParams = request.nextUrl.searchParams.toString();
    const targetUrl = `${BACKEND_URL}/api/questions${
      searchParams ? `?${searchParams}` : ''
    }`;

    const response = await fetch(targetUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const rawText = await response.text();
    let parsedData: unknown;

    try {
      parsedData = rawText ? JSON.parse(rawText) : {};
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Respons backend bukan JSON valid',
          detail: rawText.slice(0, 300),
        },
        { status: response.ok ? 502 : response.status }
      );
    }

    return NextResponse.json(parsedData, { status: response.status });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Gagal menghubungi backend soal';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return forwardRequest(request, 'GET');
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json(
      { success: false, error: 'ID soal wajib diisi' },
      { status: 400 }
    );
  }

  return forwardRequest(request, 'DELETE');
}