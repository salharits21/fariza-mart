# Fariza Mart POS — Sistem POS Offline

Aplikasi kasir desktop offline (Wails v3 + React + Go + SQLite).

## Download Aplikasi (Windows)

- **Halaman rilis:** https://github.com/salharits21/fariza-mart/releases/latest
- Download file installer **`farizamart-amd64-installer.exe`**, jalankan, ikuti wizard NSIS.
- Rilis baru dibuat otomatis setiap ada tag versi, contoh:
  `git tag v1.0.0 && git push origin v1.0.0` → installer muncul di halaman Releases.
- Shortcut Start Menu + Desktop dibuat otomatis oleh installer.

> Catatan: instalasi default bersifat per-mesin (butuh akses admin).
> Database tersimpan di `%AppData%\farizamart\data.db` dan tidak ikut
> terhapus saat update/reinstal.

## Production Deploy (PC Kasir, Installer NSIS)

### 1. Persiapan build
- Pastikan branding sudah benar:
  - `build/config.yml` → `Fariza Mart / Fariza Mart POS / com.farizamart.pos / 1.0.0`
  - `build/windows/info.json` → sama seperti di atas
- Setelah mengubah `build/config.yml`, jalankan (di PC yang ada `wails3`):
  `wails3 task common:update:build-assets`

### 2. Build installer Windows (NSIS)

**Cara utama (disarankan): via GitHub Actions.**
Push tag versi (`git tag v1.0.0 && git push origin v1.0.0`) atau jalankan
workflow `Release (Windows NSIS)` manual dari tab Actions. Workflow
(`.github/workflows/release.yml`) otomatis: build frontend production +
`go vet` + `task package`, lalu mempublish `farizamart-amd64-installer.exe`
ke halaman GitHub Releases.

**Cara manual** di PC build Windows (butuh Go, Node, Task, wails3 CLI
`v3.0.0-beta.19`, NSIS/makensis, WebView2 bootstrapper):

1. `task build` — build frontend production + `bin/farizamart.exe`
2. `task package` (default NSIS, scope machine) — hasil:
   `bin/farizamart-amd64-installer.exe`
3. Untuk instalasi per-user tanpa UAC: `task package INSTALL_SCOPE=user`

Installer otomatis mengurus WebView2 runtime (`wails.webview2runtime` di
`build/windows/nsis/project.nsi`).

### 3. Instalasi di PC kasir
1. Jalankan installer `.exe`, ikuti wizard NSIS.
2. Shortcut Start Menu + Desktop dibuat otomatis.
3. Jalankan "Fariza Mart POS", buat akun admin saat pertama kali dibuka.
4. Buat akun karyawan, input katalog produk + stok awal.
5. Uji 1 transaksi penuh sampai cetak struk.

### 4. Printer thermal (struk)
- Struk kasir dioptimalkan untuk kertas roll thermal.
- Di modal "Struk Penjualan (Thermal)" pilih lebar kertas:
  - **80mm** — printer thermal kasir standar (default)
  - **58mm** — printer thermal portable
- Saat Cetak, hanya struk yang dikirim ke printer (`@media print` +
  `@page`, tidak ada elemen aplikasi lain yang ikut tercetak).
- Setting driver printer: paper size 80mm (72mm area cetak) atau
  58mm (52mm area cetak), margin none.
- Laporan harian PDF tetap ukuran A4 (untuk arsip/kantor, bukan struk).

### 5. Backup data (wajib harian)
- Database: `%AppData%\farizamart\data.db` (plus `-wal`/`-shm` saat app berjalan).
- Tutup aplikasi, lalu copy `data.db` ke flashdisk / folder backup.
  Beri nama tanggal, misal `data-2026-09-21.db`.
- Restore: tutup aplikasi, kembalikan file ke `%AppData%\farizamart\data.db`.
- Reinstal/update aplikasi tidak menghapus database (di luar binary).

## Development
- `wails3 dev` — hot reload frontend + backend.
- Frontend: `frontend/` (React + TS), styling di `frontend/public/style.css`.
- Backend: `main.go`, `database.go`, `services/`, `models/`.
