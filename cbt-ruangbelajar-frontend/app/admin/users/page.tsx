'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchUsers = () => {
    fetch('https://cbt-ruangbelajar-backend.vercel.app/api/admin/users')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setUsers(data.users || []);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Gagal memuat data user:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    // 1. Cek data user yang sedang login
    const storedUser = localStorage.getItem('user'); 
    
    if (storedUser) {
      const user = JSON.parse(storedUser);
      // 2. Jika role-nya BUKAN admin, usir ke dashboard
      if (user.role !== 'admin') {
        alert('Akses ditolak! Anda bukan admin.');
        router.push('/dashboard');
        return;
      }
    } else {
      router.push('/login');
      return;
    }

    fetchUsers();
  }, [router]);

  // Fungsi untuk menghapus user
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
        // Refresh data setelah dihapus
        setUsers(users.filter((user) => user.id !== id));
      } else {
        alert('Gagal menghapus user: ' + data.message);
      }
    } catch (err) {
      console.error('Error:', err);
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
            <p className="text-sm text-slate-500 mt-1">Halaman Khusus Admin - Kelola akun terdaftar untuk persiapan ujian</p>
          </div>
          <Link href="/dashboard" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition">
            ← Kembali ke Dashboard
          </Link>
        </div>

        {/* Tabel Data */}
        {loading ? (
          <div className="text-center py-20 text-slate-500">Memverifikasi akses admin...</div>
        ) : users.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
            <p className="text-gray-500">Belum ada pengguna yang terdaftar.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wider border-b border-slate-200">
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">Nama</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Asal Sekolah</th>
                    <th className="py-3 px-4">Kelas</th>
                    <th className="py-3 px-4">Passcode Ujian</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Waktu Daftar</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-semibold text-slate-500">#{user.id}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{user.nama}</td>
                      <td className="py-3 px-4 text-slate-600">{user.email}</td>
                      <td className="py-3 px-4 text-slate-600">{user.asal_sekolah || '-'}</td>
                      <td className="py-3 px-4 text-slate-600">{user.tingkat_kelas || '-'}</td>
                      <td className="py-3 px-4">
                        <span className="bg-slate-100 text-slate-700 font-mono text-xs px-2 py-1 rounded">
                          {user.exam_passcode || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {user.created_at ? new Date(user.created_at).toLocaleString() : '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
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