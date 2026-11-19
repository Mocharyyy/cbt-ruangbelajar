import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.BACKEND_URL ||
  'http://139.190.107.150:5000';

// 1. Ambil Soal (GET)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams.toString();
    const targetUrl = `${BACKEND_URL.replace(/\/+$/, '')}/api/questions${
      searchParams ? `?${searchParams}` : ''
    }`;

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Gagal mengambil data soal dari backend' },
      { status: 500 }
    );
  }
}

// 2. Hapus Soal (DELETE)
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams.toString();
    const id = request.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID soal wajib diisi' },
        { status: 400 }
      );
    }

    const targetUrl = `${BACKEND_URL.replace(/\/+$/, '')}/api/questions${
      searchParams ? `?${searchParams}` : ''
    }`;

    const response = await fetch(targetUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Gagal menghapus soal dari backend' },
      { status: 500 }
    );
  }
}