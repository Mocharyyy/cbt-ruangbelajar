'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('https://cbt-ruangbelajar-backend.vercel.app/api/admin/users');
      const data = await res.json();

      if (data.success) {
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
    // 1. Cek sesi login di localStorage
    const storedUser = localStorage.getItem('user'); 
    
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        // Jika role bukan admin, balikkan ke dashboard
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
      // Jika belum login, kembalikan ke halaman utama (root /)
      router.push('/');
      return;
    }

    fetchUsers();
  }, [router]);

  // Fungsi Hapus User
  const handleDelete = async (id: number, nama: string) => {
    if (!confirm(`Apakah kamu yakin ingin menghapus user "${nama}"?`)) {
      return;
    }

    try {
      const res = await fetch(`https://cbt-ruangbelajar-backend.vercel.app/api/admin/users/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (data.success) {
        alert('User berhasil dihapus!');
        setUsers(users.filter((user) => user.id !== id));
      } else {
        alert('Gagal menghapus user: ' + data.message);
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Manajemen Pengguna (Users)</h1>
            <p className="text-sm text-slate-500 mt-1">Halaman Khusus Admin - Kelola & Bersihkan Akun Terdaftar</p>
          </div>
          <Link href="/dashboard" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition shadow-sm">
            ← Kembali ke Dashboard
          </Link>
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
        ) : users.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-slate-200">
            <p className="text-slate-500 font-medium">Belum ada pengguna yang terdaftar di database.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wider border-b border-slate-200">
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
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 transition">
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
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
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