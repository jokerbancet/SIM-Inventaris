# Dokumentasi Skema Database - SIM Inventaris

Aplikasi ini menggunakan **PostgreSQL (Supabase)** sebagai sistem manajemen basis data. Di bawah ini adalah rincian setiap tabel, kolom, tipe data, dan relasinya.

## Tabel: `users`
Menyimpan informasi pengguna aplikasi.
| Kolom | Tipe Data | Deskripsi |
| :--- | :--- | :--- |
| `id` | BIGSERIAL (PK) | Auto-increment ID. |
| `username` | TEXT (UNIQUE) | Username untuk login. |
| `password` | TEXT | Password yang sudah di-hash (Bcrypt). |
| `role` | TEXT | Peran pengguna: `'admin'` atau `'user'`. |
| `name` | TEXT | Nama lengkap pengguna. |
| `created_at` | TIMESTAMPTZ | Waktu data dibuat. |

## Tabel: `categories`
Menyimpan kategori barang.
| Kolom | Tipe Data | Deskripsi |
| :--- | :--- | :--- |
| `id` | BIGSERIAL (PK) | Auto-increment ID. |
| `name` | TEXT (UNIQUE) | Nama kategori (misal: Elektronik). |
| `code` | TEXT (UNIQUE) | Kode kategori (misal: ELK). |

## Tabel: `locations`
Menyimpan master data lokasi penyimpanan/penempatan.
| Kolom | Tipe Data | Deskripsi |
| :--- | :--- | :--- |
| `id` | BIGSERIAL (PK) | Auto-increment ID. |
| `name` | TEXT (UNIQUE) | Nama lokasi (misal: Gudang A). |

## Tabel: `items`
Menyimpan data utama inventaris barang.
| Kolom | Tipe Data | Deskripsi |
| :--- | :--- | :--- |
| `id` | BIGSERIAL (PK) | Auto-increment ID. |
| `code` | TEXT (UNIQUE) | Kode unik barang (misal: ELK-001). |
| `name` | TEXT | Nama barang. |
| `category_id` | BIGINT (FK) | Relasi ke `categories.id`. |
| `unit` | TEXT | Satuan barang (misal: Pcs, Unit). |
| `description` | TEXT | Deskripsi atau catatan barang. |
| `image` | TEXT | Foto barang (URL atau Base64). |
| `status` | TEXT | Status: `'Tersedia'`, `'Dipinjam'`, `'Rusak'`, `'Maintenance'`. |
| `created_at` | TIMESTAMPTZ | Waktu data dibuat. |
| `updated_at` | TIMESTAMPTZ | Waktu data terakhir diupdate. |

## Tabel: `item_stock`
Menyimpan kuantitas barang berdasarkan lokasi (Multi-location stock).
| Kolom | Tipe Data | Deskripsi |
| :--- | :--- | :--- |
| `id` | BIGSERIAL (PK) | Auto-increment ID. |
| `item_id` | BIGINT (FK) | Relasi ke `items.id`. |
| `location_id` | BIGINT (FK) | Relasi ke `locations.id`. |
| `quantity` | INTEGER | Jumlah stok di lokasi tersebut. |

## Tabel: `borrowings`
Menyimpan header data peminjaman.
| Kolom | Tipe Data | Deskripsi |
| :--- | :--- | :--- |
| `id` | BIGSERIAL (PK) | Auto-increment ID. |
| `user_id` | BIGINT (FK) | ID staff yang mencatat (FK ke `users.id`). |
| `borrower_name` | TEXT | Nama orang yang meminjam. |
| `borrower_phone` | TEXT | Nomor WhatsApp peminjam. |
| `start_date` | TIMESTAMPTZ | Tanggal mulai pinjam. |
| `due_date` | TIMESTAMPTZ | Batas waktu pengembalian. |
| `status` | TEXT | Status: `'borrowed'` atau `'returned'`. |
| `created_at` | TIMESTAMPTZ | Waktu transaksi dibuat. |

## Tabel: `borrowing_items`
Menyimpan rincian barang yang dipinjam dalam satu transaksi peminjaman.
| Kolom | Tipe Data | Deskripsi |
| :--- | :--- | :--- |
| `id` | BIGSERIAL (PK) | Auto-increment ID. |
| `borrowing_id` | BIGINT (FK) | Relasi ke `borrowings.id`. |
| `item_id` | BIGINT (FK) | Relasi ke `items.id`. |
| `location_id` | BIGINT (FK) | Lokasi pengambilan barang. |
| `quantity` | INTEGER | Jumlah barang yang dipinjam. |
| `initial_condition` | TEXT | Kondisi barang saat keluar. |
| `initial_image` | TEXT | Foto bukti kondisi awal. |
| `final_condition` | TEXT | Kondisi barang saat kembali. |
| `return_image` | TEXT | Foto bukti kondisi kembali. |
| `return_date` | TIMESTAMPTZ | Tanggal barang dikembalikan. |
| `status` | TEXT | Status per barang: `'borrowed'` atau `'returned'`. |

## Tabel: `damages`
Menyimpan data laporan kerusakan barang.
| Kolom | Tipe Data | Deskripsi |
| :--- | :--- | :--- |
| `id` | BIGSERIAL (PK) | Auto-increment ID. |
| `item_id` | BIGINT (FK) | Relasi ke `items.id`. |
| `location_id` | BIGINT (FK) | Lokasi barang saat ditemukan rusak. |
| `quantity` | INTEGER | Jumlah barang yang rusak. |
| `cause` | TEXT | Penyebab kerusakan. |
| `damage_date` | DATE | Tanggal kejadian kerusakan. |
| `status` | TEXT | Status: `'damaged'`, `'under_repair'`, `'repaired'`, `'discarded'`. |
| `image` | TEXT | Foto dokumentasi kerusakan. |

## Tabel: `activity_logs`
Menyimpan riwayat aktivitas sistem (Audit Trail).
| Kolom | Tipe Data | Deskripsi |
| :--- | :--- | :--- |
| `id` | BIGSERIAL (PK) | Auto-increment ID. |
| `user_id` | BIGINT (FK) | ID pengguna yang melakukan aksi. |
| `action` | TEXT | Jenis aksi (misal: `LOGIN`, `CREATE_ITEM`). |
| `details` | TEXT | Rincian keterangan aksi. |
| `created_at` | TIMESTAMPTZ | Waktu aktivitas tercatat. |
