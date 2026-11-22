import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.BACKEND_URL ||
  'http://139.190.107.150:5000'
).replace(/\/+$/, '');

function safeParseJson(rawText: string) {
  if (!rawText || !rawText.trim()) return {};
  try {
    return JSON.parse(rawText);
  } catch {
    return {
      success: false,
      message: rawText.slice(0, 500),
      raw: rawText.slice(0, 500),
    };
  }
}

function normalizeQuestionPayload(rawBody: Record<string, any>) {
  const normalized: Record<string, any> = { ...rawBody };

  const rawExamId = normalized.exam_id ?? normalized.examId;
  if (rawExamId !== undefined && rawExamId !== null && String(rawExamId).trim() !== '') {
    const numExamId = Number(rawExamId);
    normalized.exam_id = Number.isNaN(numExamId) ? rawExamId : numExamId;
  }

  if (normalized.tipe_soal === undefined && normalized.tipe !== undefined) {
    normalized.tipe_soal = normalized.tipe;
  }

  if (normalized.soal === undefined && normalized.pertanyaan !== undefined) {
    normalized.soal = normalized.pertanyaan;
  }

  if (normalized.kunci_jawaban !== undefined && typeof normalized.kunci_jawaban === 'string') {
    normalized.kunci_jawaban = normalized.kunci_jawaban.trim();
  }

  return normalized;
}

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
    const data = safeParseJson(rawText);
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Gagal mengambil data soal',
        error: error instanceof Error ? error.message : 'Gagal mengambil data soal',
      },
      { status: 500 }
    );
  }
}

// 2. Simpan Soal Baru (POST)
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let response: Response;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const rawExamId = formData.get('exam_id') ?? formData.get('examId');
      if (rawExamId !== null) {
        const numExamId = Number(rawExamId);
        formData.set('exam_id', String(Number.isNaN(numExamId) ? rawExamId : numExamId));
      }

      response = await fetch(`${BACKEND_URL}/api/admin/questions`, {
        method: 'POST',
        body: formData,
        cache: 'no-store',
      });
    } else {
      const rawBody = await request.json();
      const payload = normalizeQuestionPayload(rawBody || {});

      response = await fetch(`${BACKEND_URL}/api/admin/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
      });
    }

    const rawText = await response.text();
    const data = safeParseJson(rawText);
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    console.error('Error POST /api/questions:', error);
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

    const contentType = request.headers.get('content-type') || '';
    let response: Response;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      response = await fetch(
        `${BACKEND_URL}/api/admin/questions/${encodeURIComponent(id)}`,
        {
          method: 'PUT',
          body: formData,
          cache: 'no-store',
        }
      );
    } else {
      const rawBody = await request.json();
      const payload = normalizeQuestionPayload(rawBody || {});
      response = await fetch(
        `${BACKEND_URL}/api/admin/questions/${encodeURIComponent(id)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          cache: 'no-store',
        }
      );
    }

    const rawText = await response.text();
    const data = safeParseJson(rawText);
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
    const data = safeParseJson(rawText);
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