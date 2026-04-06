# SIM Inventaris - Sistem Informasi Manajemen Inventaris

Sistem Informasi Manajemen (SIM) Inventaris adalah aplikasi berbasis web yang dirancang untuk mengelola stok barang, peminjaman, dan pelaporan kerusakan barang secara efisien dan terorganisir. Aplikasi ini mendukung pengelolaan stok di berbagai lokasi dan menyediakan fitur pelaporan yang lengkap.

## Fitur Utama

Aplikasi ini memiliki berbagai fitur yang memudahkan pengelolaan aset dan inventaris:

### 1. Dashboard & Statistik
- Ringkasan total barang, peminjaman aktif, dan barang rusak.
- Grafik tren peminjaman dan statistik kategori.
- Analisis durasi rata-rata peminjaman.

### 2. Manajemen Data Master (Data Master)
- **Data Inventaris**: Pengelolaan data barang lengkap dengan kode unik, kategori, dan foto.
- **Data Peminjaman**: Pencatatan peminjaman barang, batas waktu kembali, dan status pengembalian.
- **Data Kerusakan**: Pelaporan barang rusak disertai penyebab dan dokumentasi foto.
- **Master Kategori**: Pengaturan kategori barang untuk pengelompokan yang lebih baik.
- **Master Lokasi**: Pengelolaan lokasi penyimpanan barang (multi-lokasi).

### 3. Fitur Peminjaman Lanjutan
- **Edit Peminjaman**: Menambah barang atau mengubah kuantitas pada peminjaman yang sedang aktif.
- **WhatsApp Reminder**: Mengirim pesan pengingat otomatis ke peminjam melalui WhatsApp.
- **Manajemen Stok Multi-Lokasi**: Melacak ketersediaan barang di berbagai ruangan atau gudang.

### 4. Pelaporan & Log
- **Export Laporan**: Mengunduh laporan peminjaman dan kerusakan dalam format PDF atau Excel.
- **Activity Logs**: Mencatat setiap aktivitas penting yang dilakukan oleh pengguna (Audit Trail).

### 5. Keamanan & Akses
- Sistem login dengan peran (Role-based Access Control): **Admin** dan **User**.
- Admin memiliki akses penuh, sementara User memiliki akses terbatas sesuai kebijakan.

---

## Akun Demo (Dummy Login)

Anda dapat mencoba aplikasi ini menggunakan akun berikut:

### Akun Administrator
- **Username**: `admin`
- **Password**: `admin123`
- **Role**: Akses penuh ke semua fitur dan pengaturan.

### Akun Staff/User
- **Username**: `user`
- **Password**: `user123`
- **Role**: Akses untuk operasional harian (peminjaman, inventaris, dll).

---

## Teknologi yang Digunakan
- **Frontend**: React.js, Tailwind CSS, Lucide React, Framer Motion.
- **Backend**: Node.js, Express.js.
- **Database**: SQLite (Better-SQLite3).
- **Authentication**: JWT (JSON Web Token) & Bcrypt.
