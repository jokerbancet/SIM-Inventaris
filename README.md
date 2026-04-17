# SIM Inventaris - Sistem Informasi Manajemen Inventaris

Sistem Informasi Manajemen (SIM) Inventaris adalah aplikasi berbasis web modern yang dirancang untuk mengelola stok barang, peminjaman, dan pelaporan kerusakan barang secara efisien. Proyek ini dibangun dengan fokus pada performa, keamanan, dan pengalaman pengguna yang responsif di berbagai perangkat.

## Fitur Utama

Aplikasi ini memiliki berbagai fitur canggih untuk pengelolaan aset:

### 1. Dashboard & Analitik Real-time
- Ringkasan total aset, peminjaman aktif, dan status barang rusak.
- Visualisasi data menggunakan grafik tren dan statistik kategori.
- Pelacakan durasi peminjaman dan ketersediaan stok global.

### 2. Manajemen Data Master
- **Data Inventaris**: Pengelolaan katalog barang dengan QR/Barcode coding, kategori, dan dokumentasi foto.
- **Data Peminjaman**: Sistem pencatatan peminjaman dengan validasi stok otomatis dan batas waktu kembali.
- **Data Kerusakan**: Pelaporan kerusakan barang terintegrasi dengan modul peminjaman dan penyesuaian stok.
- **Master Referensi**: Pengelolaan dinamis untuk Kategori dan Lokasi penyimpanan (Multi-warehouse).

### 3. Keamanan & Autentikasi Modern
- **Integrasi Supabase Auth**: Mendukung Login via Email/Password dan Google OAuth.
- **Role-based Access Control (RBAC)**: Pemisahan akses antara **Admin** (Kelola User, Log, Data Master) dan **User** (Operasional).
- **Admin Auto-Promotion**: Sistem otomatis untuk menetapkan peran admin pada email yang telah ditentukan.

### 4. Responsivitas Mobile (New!)
- Layout yang sepenuhnya adaptif untuk Smartphone, Tablet, dan Desktop.
- Sidebar navigasi cerdas dengan mode mobile toggle.
- UI/UX yang dioptimalkan untuk sentuhan (touch-friendly controls).

### 5. Pelaporan & Audit Trail
- **Export Laporan**: Unduh data laporan ke format PDF atau Excel.
- **Activity Logs**: Pencatatan riwayat aktivitas pengguna untuk audit dan keamanan sistem.

---

## Dokumentasi Teknis
- [Skema Database](./DATABASE_SCHEMA.md) - Rincian tabel, relasi, dan struktur database PostgreSQL.

---

## Teknologi yang Digunakan

### Frontend
- **Framework**: React.js (Vite)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Animation**: Motion (framer-motion)
- **Charts**: Recharts

### Backend & Database
- **Provider**: Supabase (PostgreSQL)
- **Server**: Express.js (Node.js)
- **Auth**: Supabase Authentication (JWT & Google OAuth)

---

## Cara Penggunaan

1.  **Masuk (Login)**: Gunakan akun Google atau daftar dengan email perusahaan.
2.  **Kelola Inventaris**: Tambahkan data barang baru dan tentukan lokasinya.
3.  **Operasi Peminjaman**: Catat peminjaman barang dan pantau status pengembalian.
4.  **Pantau Log**: (Admin Only) Lihat riwayat perubahan data pada menu Log Aktivitas.
5.  **Ekspor Data**: Gunakan fitur unduh laporan untuk keperluan administrasi fisik.

---
&copy; 2026 Sistem Informasi Manajemen Inventaris
