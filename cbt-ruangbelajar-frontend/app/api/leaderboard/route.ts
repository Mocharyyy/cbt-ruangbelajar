import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.BACKEND_URL ||
  'http://139.190.107.150:5000';

type JenjangType = 'SD' | 'SMP' | 'SMA/SMK';

function normalizeJenjang(raw?: any): JenjangType | null {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const upper = String(raw).trim().toUpperCase();
  if (upper.includes('SMA') || upper.includes('SMK') || upper.includes('MA')) {
    return 'SMA/SMK';
  }
  if (upper.includes('SMP') || upper.includes('MTS')) {
    return 'SMP';
  }
  if (upper.includes('SD') || upper.includes('MI')) {
    return 'SD';
  }
  return null;
}

function extractDurationSeconds(row: any): number {
  if (!row || typeof row !== 'object') return 0;

  const directCandidates = [
    row.duration,
    row.total_duration,
    row.durasi,
    row.waktu_pengerjaan,
    row.duration_seconds,
    row.elapsed_time,
    row.time_spent,
  ];

  for (const val of directCandidates) {
    if (val !== undefined && val !== null && val !== '') {
      const num = Number(val);
      if (!Number.isNaN(num) && num > 0) {
        return Math.round(num);
      }
    }
  }

  const minuteCandidates = [
    row.duration_minutes,
    row.total_menit,
    row.menit,
  ];
  for (const val of minuteCandidates) {
    if (val !== undefined && val !== null && val !== '') {
      const num = Number(val);
      if (!Number.isNaN(num) && num > 0) {
        return Math.round(num * 60);
      }
    }
  }

  return 0;
}

function extractScore(row: any): number {
  if (!row || typeof row !== 'object') return 0;
  const candidates = [row.score, row.total_score, row.final_score, row.nilai];
  for (const val of candidates) {
    if (val !== undefined && val !== null && val !== '') {
      const num = Number(val);
      if (!Number.isNaN(num)) return num;
    }
  }
  return 0;
}

function classifyFromScore(score: number, existingLabel?: any): string {
  if (existingLabel && String(existingLabel).trim() !== '') {
    return String(existingLabel).trim();
  }
  if (score >= 80) return 'Tinggi';
  if (score >= 60) return 'Sedang';
  return 'Rendah';
}

function formatLeaderboardRows(rows: any[], targetJenjang: JenjangType, hasJenjang: boolean) {
  const byUser = new Map<string, any>();

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;

    const detectedJenjang = normalizeJenjang(
      row.jenjang || row.jenjang_pendidikan || row.level || row.tingkat_jenjang
    );

    // Jika parameter jenjang diminta, hanya lewati jika item punya jenjang eksplisit yang berbeda
    if (hasJenjang && detectedJenjang && detectedJenjang !== targetJenjang) {
      continue;
    }

    const uid = String(row.user_id ?? row.id ?? row.student_id ?? '');
    if (!uid) continue;

    const score = extractScore(row);
    const duration = extractDurationSeconds(row);
    const examCount = Number(row.total_ujian_dikerjakan ?? 1) || 1;
    const label = classifyFromScore(score, row.klasifikasi || row.status_bayes);
    const finalJenjang: JenjangType = detectedJenjang || targetJenjang;

    if (!byUser.has(uid)) {
      byUser.set(uid, {
        ...row,
        user_id: row.user_id ?? uid,
        nama_siswa: String(row.nama_siswa || row.nama || row.name || `Siswa #${uid}`).trim(),
        jenjang: finalJenjang,
        total_ujian_dikerjakan: examCount,
        status_bayes: label,
        klasifikasi: label,
        duration,
        score,
      });
    } else {
      const prev = byUser.get(uid);
      const nextScore = Math.round((Number(prev.score || 0) + score) * 100) / 100;
      const nextDuration = Math.max(0, Math.round((Number(prev.duration || 0) + duration)));
      const nextCount = Number(prev.total_ujian_dikerjakan || 0) + examCount;
      const nextLabel = classifyFromScore(
        nextCount > 0 ? nextScore / nextCount : nextScore,
        row.klasifikasi || row.status_bayes || prev.klasifikasi
      );

      byUser.set(uid, {
        ...prev,
        ...row,
        user_id: prev.user_id,
        nama_siswa: prev.nama_siswa,
        jenjang: finalJenjang,
        total_ujian_dikerjakan: nextCount,
        status_bayes: nextLabel,
        klasifikasi: nextLabel,
        duration: nextDuration,
        score: nextScore,
      });
    }
  }

  return Array.from(byUser.values()).sort((a, b) => {
    const scoreDiff = Number(b.score || 0) - Number(a.score || 0);
    if (scoreDiff !== 0) return scoreDiff;
    return Number(a.duration || 0) - Number(b.duration || 0);
  });
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const hasJenjang = Boolean(sp.get('jenjang'));
    const targetJenjang: JenjangType = normalizeJenjang(sp.get('jenjang')) || 'SD';
    const userId = sp.get('user_id') || '';

    const searchParams = sp.toString();
    const targetUrl = `${BACKEND_URL.replace(/\/+$/, '')}/api/leaderboard${
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

    if (!response.ok || !data || typeof data !== 'object') {
      return NextResponse.json(data, { status: response.status });
    }

    const rawList = Array.isArray(data.leaderboard)
      ? data.leaderboard
      : Array.isArray(data.data)
      ? data.data
      : null;

    if (!rawList) {
      return NextResponse.json(data, { status: response.status });
    }

    const processed = formatLeaderboardRows(rawList, targetJenjang, hasJenjang);

    let computedUserRank = data.userRank || null;
    if (userId) {
      const idx = processed.findIndex((item: any) => String(item.user_id) === String(userId));
      if (idx !== -1) {
        computedUserRank = {
          ...processed[idx],
          rank: idx + 1,
        };
      }
    }

    return NextResponse.json(
      {
        ...data,
        success: data.success !== undefined ? data.success : true,
        jenjang: hasJenjang ? targetJenjang : data.jenjang,
        leaderboard: processed.slice(0, 10),
        userRank: computedUserRank,
        totalSiswa: processed.length || Number(data.totalSiswa) || 0,
      },
      { status: response.status }
    );
  } catch (error: any) {
    console.error('Error Leaderboard API:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}