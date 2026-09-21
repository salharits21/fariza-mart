# Spesifikasi Aplikasi POS Desktop (Offline)

## 1. Ringkasan Proyek

| Item | Detail |
|---|---|
| Nama Aplikasi | POS Toko (dapat diganti sesuai kebutuhan) |
| Jenis | Aplikasi desktop, **100% offline** |
| Framework | [Wails v3](https://v3alpha.wails.io/) |
| Frontend | React |
| Backend/Core | Go (native Wails v3) |
| Database | SQLite (lokal, embedded, tanpa server eksternal) |
| Target Pengguna | Toko kecil dengan 1 pemilik/admin dan 2 karyawan |
| Tema Warna | Putih & Biru |

### Tujuan
Aplikasi ini digunakan untuk mendokumentasikan transaksi penjualan di sebuah toko secara sederhana, mencatat produk, transaksi, riwayat transaksi, serta menghasilkan laporan harian dalam format PDF — semuanya berjalan tanpa koneksi internet.

---

## 2. Tech Stack

- **Wails v3** — bridge antara backend Go dan frontend React, membangun binary desktop native (Windows/Mac/Linux).
- **React** — UI frontend, dengan styling sederhana (disarankan Tailwind CSS atau CSS Modules agar ringan).
- **SQLite** — database lokal (menggunakan driver seperti `modernc.org/sqlite` atau `mattn/go-sqlite3`), disimpan sebagai file di direktori data aplikasi (contoh: `%APPDATA%/pos-app/data.db` di Windows, atau folder setara di macOS/Linux).
- **PDF Generation** — dilakukan di sisi Go (contoh: library `gofpdf` atau `maroto`) agar tidak bergantung pada koneksi internet/printer service eksternal.
- **Autentikasi** — sederhana, disimpan lokal (hash password menggunakan bcrypt), tanpa OAuth/cloud.

---

## 3. Struktur Halaman & Fitur

### 3.1 Halaman Login

- Aplikasi hanya memiliki **1 akun** (akun admin/pemilik toko).
- Form: Username + Password.
- Password disimpan dalam bentuk hash (bcrypt) di database lokal.
- Tidak ada fitur "lupa password" berbasis email (karena offline) — sediakan mekanisme reset manual (misal lewat command/file konfigurasi) jika diperlukan sebagai fallback.
- Setelah login berhasil, sesi disimpan secara lokal (in-memory/local session) selama aplikasi berjalan.

### 3.2 Dashboard

Menampilkan ringkasan performa toko:

- **Penjualan Hari Ini**
  - Total omzet (Rp) hari ini
  - Jumlah transaksi hari ini
  - Jumlah item terjual hari ini
- **Metrik Penjualan Bulanan**
  - Grafik penjualan per hari dalam bulan berjalan (line/bar chart)
  - Total omzet bulan ini
  - Perbandingan dengan bulan sebelumnya (opsional, jika data tersedia)
  - Produk terlaris bulan ini (top 5, berdasarkan qty terjual)
- Tampilan berupa kombinasi kartu statistik (cards) + grafik sederhana (bisa menggunakan `recharts` di React).

### 3.3 Halaman Produk (Manajemen Produk — CRUD)

Field data produk:

| Field | Tipe | Keterangan |
|---|---|---|
| ID | Auto increment | Primary key |
| Nama Produk | String | Wajib |
| Kategori | String | Opsional |
| Harga Jual | Number (Rp) | Wajib |
| Harga Modal | Number (Rp) | Opsional, untuk perhitungan margin |
| Stok | Number | Wajib |
| Satuan | String | Contoh: pcs, kg, box |
| Status | Aktif/Nonaktif | Untuk menonaktifkan produk tanpa menghapus |

Fitur:
- **Create**: tambah produk baru
- **Read**: daftar produk (tabel dengan pencarian & filter kategori/status)
- **Update**: edit data produk & stok
- **Delete**: hapus produk (dengan konfirmasi; sebaiknya soft-delete agar riwayat transaksi lama tidak rusak)
- Indikator stok menipis (misal warna merah jika stok < ambang batas tertentu)

### 3.4 Halaman Transaksi (Input Transaksi Baru)

Alur pencatatan transaksi baru:

1. Pilih produk (search/select) → tambahkan ke keranjang transaksi
2. Atur jumlah (qty) per produk
3. Sistem otomatis menghitung subtotal & total
4. **Pilih karyawan yang bertanggung jawab** atas transaksi ini:
   - Dropdown/radio pilihan: **Nurdian** atau **Yoga**
5. Opsional: metode pembayaran (Tunai/Transfer/QRIS — untuk pencatatan saja, tanpa integrasi payment gateway)
6. Simpan transaksi → otomatis mengurangi stok produk terkait
7. Setelah transaksi disimpan, tampilkan opsi cetak/lihat struk sederhana (opsional)

Field transaksi:

| Field | Tipe | Keterangan |
|---|---|---|
| ID Transaksi | Auto increment / kode unik | Primary key |
| Tanggal & Waktu | Timestamp | Otomatis saat disimpan |
| Karyawan | Enum (Nurdian / Yoga) | Wajib dipilih |
| Daftar Item | List (produk, qty, harga satuan, subtotal) | Wajib min. 1 item |
| Total | Number (Rp) | Otomatis dihitung |
| Metode Pembayaran | String | Opsional |
| Catatan | String | Opsional |

### 3.5 Halaman Riwayat Transaksi

- Tabel daftar seluruh transaksi yang pernah dibuat.
- Filter:
  - Berdasarkan tanggal (rentang tanggal / hari ini / bulan ini)
  - Berdasarkan karyawan (Nurdian / Yoga / Semua)
- Kolom tabel: No. Transaksi, Tanggal & Waktu, Karyawan, Jumlah Item, Total, Metode Pembayaran
- Klik salah satu transaksi → tampilkan detail (rincian item yang dibeli)
- Opsional: fitur void/batal transaksi (dengan pencatatan alasan, agar stok bisa dikembalikan)

### 3.6 Laporan Harian (Export PDF)

Fitur untuk menghasilkan laporan harian dalam format **PDF**, dengan jangka waktu **harian** (per tanggal yang dipilih, default hari ini). Isi laporan:

**A. Laporan Stok**
- Daftar seluruh produk beserta:
  - Stok awal hari (opsional, jika data historis stok disimpan per hari)
  - Jumlah terjual hari itu
  - Stok akhir/stok saat ini

**B. Riwayat Transaksi per Karyawan**
- Laporan dipisah menjadi dua bagian/section:
  - **Transaksi oleh Nurdian**: daftar transaksi, rincian item, total penjualan
  - **Transaksi oleh Yoga**: daftar transaksi, rincian item, total penjualan
- Setiap section menampilkan subtotal omzet per karyawan
- Ringkasan total keseluruhan hari itu (gabungan kedua karyawan) di bagian akhir laporan

**Struktur PDF (usulan halaman):**
1. Header: Nama Toko, Tanggal Laporan, Waktu Cetak
2. Ringkasan Umum: Total Omzet Hari Ini, Jumlah Transaksi, Jumlah Item Terjual
3. Tabel Laporan Stok
4. Section Transaksi — Nurdian
5. Section Transaksi — Yoga
6. Ringkasan Akhir / Footer

Tombol "Cetak Laporan Harian" dapat diletakkan di Dashboard maupun Halaman Riwayat Transaksi, dengan date picker untuk memilih tanggal laporan (default: hari ini). File PDF disimpan secara lokal melalui dialog "Save As" bawaan sistem operasi (Wails native dialog).

---

## 4. Skema Database (Usulan)

```
users
- id (PK)
- username
- password_hash
- created_at

employees
- id (PK)
- name          -- "Nurdian", "Yoga"

products
- id (PK)
- name
- category
- sell_price
- cost_price
- stock
- unit
- is_active
- created_at
- updated_at

transactions
- id (PK)
- transaction_code
- employee_id (FK -> employees.id)
- total_amount
- payment_method
- note
- created_at

transaction_items
- id (PK)
- transaction_id (FK -> transactions.id)
- product_id (FK -> products.id)
- qty
- unit_price
- subtotal
```

> Catatan: tabel `employees` sebaiknya di-seed langsung dengan 2 data awal (Nurdian, Yoga) saat aplikasi pertama kali dijalankan, tanpa perlu halaman manajemen karyawan tambahan (kecuali diperlukan di masa depan).

---

## 5. Desain UI/UX

### 5.1 Palet Warna

| Elemen | Warna | Contoh Hex (usulan) |
|---|---|---|
| Warna Primer | Biru | `#2563EB` (Blue-600) |
| Warna Aksen/Hover | Biru Muda | `#3B82F6` (Blue-500) |
| Latar Belakang | Putih | `#FFFFFF` |
| Latar Sekunder | Abu-abu sangat muda | `#F8FAFC` (Slate-50) |
| Teks Utama | Abu gelap/hitam | `#1E293B` (Slate-800) |
| Border | Abu muda | `#E2E8F0` (Slate-200) |
| Sukses | Hijau | `#16A34A` |
| Peringatan/Stok Rendah | Merah | `#DC2626` |

### 5.2 Prinsip Desain
- Layout sederhana: **Sidebar navigasi** (kiri, warna biru/putih) + konten utama di kanan.
- Menu sidebar: Dashboard, Produk, Transaksi, Riwayat Transaksi, Laporan, Logout.
- Komponen UI minimalis: card, tabel, form input dengan border tipis dan rounded corner ringan.
- Tidak perlu animasi kompleks — prioritaskan kecepatan & kejelasan karena digunakan di toko fisik (mungkin oleh karyawan yang kurang familiar dengan software).
- Font sederhana dan mudah dibaca (contoh: Inter atau sistem font default).

---

## 6. Alur Aplikasi (High-Level Flow)

```
Login
  └─> Dashboard
        ├─> Halaman Produk (CRUD produk)
        ├─> Halaman Transaksi (input transaksi baru, pilih karyawan)
        ├─> Halaman Riwayat Transaksi (lihat & filter transaksi)
        └─> Cetak Laporan Harian (PDF: stok + transaksi per karyawan)
```

---

## 7. Batasan & Asumsi

- Aplikasi berjalan **sepenuhnya offline**, tidak ada sinkronisasi cloud/multi-device.
- Hanya 1 akun login — tidak ada role/permission berjenjang.
- Karyawan (Nurdian, Yoga) hanya digunakan sebagai penanda penanggung jawab transaksi, bukan akun login terpisah.
- Backup data menjadi tanggung jawab pengguna (misal: menyalin file database SQLite secara manual/berkala) — dapat ditambahkan fitur "Export Backup" di iterasi berikutnya.
- Tidak ada integrasi payment gateway atau printer struk fisik pada versi awal (dapat menjadi pengembangan lanjutan).

---

## 8. Pengembangan Lanjutan (Opsional, di Luar Scope Awal)

- Cetak struk ke printer thermal
- Export laporan ke Excel selain PDF
- Grafik perbandingan performa antar karyawan
- Fitur backup/restore database otomatis
- Manajemen kategori produk terpisah
- Multi-user login dengan role berbeda
