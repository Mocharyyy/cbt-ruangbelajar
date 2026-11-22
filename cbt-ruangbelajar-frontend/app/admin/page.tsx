'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://139.190.107.150:5000';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'siswa' | 'admin'>('all');
  const router = useRouter();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/admin/users`);
      const data = await res.json();

      if (res.ok && data.success) {
        setUsers(data.users || []);
        setErrorMessage('');
      } else {
        setErrorMessage(data.message || 'Gagal mengambil data dari server.');
      }
    } catch (err: any) {
      console.error('Gagal memuat data user:', err);
      setErrorMessage('Terjadi kesalahan koneksi ke server backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');

    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        if (user.role !== 'admin') {
          alert('Akses khusus Admin!');
          router.push('/dashboard');
          return;
        }
      } catch (e) {
        router.push('/');
        return;
      }
    } else {
      router.push('/');
      return;
    }

    fetchUsers();
  }, [router]);

  const studentUsers = useMemo(
    () => users.filter((u) => (u.role || 'siswa') !== 'admin'),
    [users]
  );

  const adminUsers = useMemo(
    () => users.filter((u) => u.role === 'admin'),
    [users]
  );

  const displayedUsers = useMemo(() => {
    if (filterRole === 'siswa') return studentUsers;
    if (filterRole === 'admin') return adminUsers;
    return users;
  }, [users, studentUsers, adminUsers, filterRole]);

  const handleDelete = async (id: number, nama: string) => {
    if (!confirm(`Apakah kamu yakin ingin menghapus user "${nama}"?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (res.ok && data.success) {
        alert('User berhasil dihapus!');
        setUsers((prev) => prev.filter((user) => user.id !== id));
      } else {
        alert('Gagal menghapus user: ' + (data.message || 'Terjadi kesalahan'));
      }
    } catch (err) {
      console.error('Error saat hapus:', err);
      alert('Terjadi kesalahan saat menghapus user.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6 md:p-10 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Manajemen Pengguna (Users)</h1>
            <p className="text-sm text-slate-500 mt-1">
              Pendataan siswa yang masuk/terdaftar &amp; kelola akun aplikasi CBT
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchUsers}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold transition shadow-sm"
            >
              ↻ Refresh Data
            </button>
            <Link
              href="/dashboard"
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition shadow-sm"
            >
              ← Kembali ke Dashboard
            </Link>
          </div>
        </div>

        {/* Ringkasan Pendataan Siswa */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Siswa Tercatat
            </p>
            <p className="text-3xl font-black text-emerald-600 mt-1">
              {studentUsers.length}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Siswa yang sudah mendaftar / login ke aplikasi
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Semua Akun
            </p>
            <p className="text-3xl font-black text-slate-900 mt-1">
              {users.length}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Termasuk {adminUsers.length} akun admin
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Filter Tampilan Tabel
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterRole('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  filterRole === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Semua ({users.length})
              </button>
              <button
                onClick={() => setFilterRole('siswa')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  filterRole === 'siswa'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Siswa ({studentUsers.length})
              </button>
              <button
                onClick={() => setFilterRole('admin')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  filterRole === 'admin'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Admin ({adminUsers.length})
              </button>
            </div>
          </div>
        </div>

        {/* Notifikasi Error jika backend bermasalah */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 text-red-700 rounded-xl text-sm font-medium">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Konten Utama */}
        {loading ? (
          <div className="text-center py-20 text-slate-500 font-medium">
            <span className="animate-pulse">Memuat data pengguna...</span>
          </div>
        ) : displayedUsers.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-slate-200">
            <p className="text-slate-500 font-medium">
              Belum ada data pengguna yang tercatat pada kategori ini.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wider border-b border-slate-200">
                    <th className="py-3.5 px-4">No</th>
                    <th className="py-3.5 px-4">ID</th>
                    <th className="py-3.5 px-4">Nama</th>
                    <th className="py-3.5 px-4">Email</th>
                    <th className="py-3.5 px-4">Asal Sekolah</th>
                    <th className="py-3.5 px-4">Kelas</th>
                    <th className="py-3.5 px-4">Passcode</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {displayedUsers.map((user, index) => (
                    <tr key={user.id} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 px-4 font-semibold text-slate-500">{index + 1}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-400">#{user.id}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{user.nama}</td>
                      <td className="py-3.5 px-4 text-slate-600">{user.email}</td>
                      <td className="py-3.5 px-4 text-slate-600">{user.asal_sekolah || '-'}</td>
                      <td className="py-3.5 px-4 text-slate-600">{user.tingkat_kelas || '-'}</td>
                      <td className="py-3.5 px-4">
                        <span className="bg-slate-100 text-slate-700 font-mono text-xs px-2 py-1 rounded border border-slate-200">
                          {user.exam_passcode || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            user.role === 'admin'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {user.role !== 'admin' ? (
                          <button
                            onClick={() => handleDelete(user.id, user.nama)}
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm"
                          >
                            🗑️ Hapus
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Protected</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}