import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.BACKEND_URL ||
  'http://139.190.107.150:5000'
).replace(/\/+$/, '');

// 1. Ambil Soal (GET) -> bisa semua soal per exam_id atau 1 soal by id
export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    const searchParams = request.nextUrl.searchParams.toString();

    const targetUrl = id
      ? `${BACKEND_URL}/api/admin/questions/${encodeURIComponent(id)}`
      : `${BACKEND_URL}/api/questions${searchParams ? `?${searchParams}` : ''}`;

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    const rawText = await response.text();
    const data = rawText ? JSON.parse(rawText) : {};
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Gagal mengambil data soal',
      },
      { status: 500 }
    );
  }
}

// 2. Simpan Soal Baru (POST)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const response = await fetch(`${BACKEND_URL}/api/admin/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const rawText = await response.text();
    const data = rawText ? JSON.parse(rawText) : {};
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Gagal menyimpan soal',
      },
      { status: 500 }
    );
  }
}

// 3. Edit Soal (PUT)
export async function PUT(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ID soal wajib diisi untuk edit' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const response = await fetch(
      `${BACKEND_URL}/api/admin/questions/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
      }
    );

    const rawText = await response.text();
    const data = rawText ? JSON.parse(rawText) : {};
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Gagal memperbarui soal',
      },
      { status: 500 }
    );
  }
}

// 4. Hapus Soal (DELETE)
export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID soal wajib diisi' },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${BACKEND_URL}/api/admin/questions/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      }
    );

    const rawText = await response.text();
    const data = rawText ? JSON.parse(rawText) : {};
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Gagal menghapus soal',
      },
      { status: 500 }
    );
  }
}