# 🎮 Wargaopoly 62: Game Monopoli Edukasi Multiplayer Real-Time

Aplikasi web game monopoli edukasi modern berbasis multipemain *real-time* yang mendukung hingga **10 pemain** dalam satu room. Terinspirasi dari dinamika ekonomi kerakyatan ala *Simulator Warga 62*.

---

## ✨ Fitur Utama

1. **Multiplayer 10 Pemain & Room Management**:
   - Kode kamar unik (5 huruf) & tautan undangan instan (`?room=KODE`).
   - 10 Pilihan Avatar Bidak Khas Nusantara dengan kontras tinggi (Ojol, Becak Listrik, Gerobak Bakso, Kucing Oren Bar-Bar, Sepeda Onthel, Bajaj Turbo, Kancil, Traktor Sawah, Drone Ronda RW, Angkot Legendaris).
   - Fitur **Reconnect Otomatis**: Jika pemain terputus koneksi atau merefresh peramban, pemain langsung kembali ke kursinya tanpa me-reset status permainan.
   - **Bot Warga (AI)**: Host dapat menambahkan bot virtual untuk mengisi kuota hingga 10 pemain secara instan untuk pengujian atau bermain sendiri.

2. **Kuis Edukasi Fleksibel (Host-Controlled)**:
   - Manajemen bank soal di lobby: Tambah soal baru, sunting, hapus, impor/ekspor JSON, dan reset ke preset default.
   - Pemicu kuis:
     - **Saat Beli Aset/UMKM**: Menjawab benar memberikan izin beli properti + diskon/cashback hingga 20%. Jawaban salah berakibat gagal beli & denda administrasi.
     - **Petak Pajak PBB / Surat RW**: Menjawab kuis untuk bebas dari razia pajak atau memperoleh insentif kas warga.
   - Penjelasan edukasi langsung ditampilkan seusai fase jawab agar nilai edukasi terserap maksimal.

3. **UX/UI Modern & Responsif Lintas Perangkat**:
   - Papan dinamis 24 petak dengan sistem **Multi-Pawn Slot** (hingga 10 bidak di 1 petak ditata rapi dalam kisi tanpa saling tumpang tindih).
   - Efek audio instan berbasis **Web Audio API Synthesizer** (dadu, koin, kuis benar/salah, fanfare) tanpa unduhan file audio besar.
   - Tampilan adaptif untuk smartphone, tablet, maupun desktop/laptop.

---

## 🚀 Cara Menjalankan Server Lokal

### Opsi 1: Menggunakan Skrip Windows
Cukup klik ganda berkas `run.bat` di folder `app_build/`.

### Opsi 2: Menggunakan Terminal
Buka terminal di direktori `app_build/`:
```bash
node server.js
```
Atau jika menggunakan runtime bawaan Antigravity IDE:
```cmd
set ELECTRON_RUN_AS_NODE=1
"%LOCALAPPDATA%\Programs\Antigravity IDE\Antigravity IDE.exe" server.js
```

Server akan aktif di:
👉 **http://localhost:3000**

---

## 🧪 Panduan Menguji Fitur 10 Pemain & Kuis

1. Buka peramban dan akses `http://localhost:3000`.
2. Masukkan nama Anda (misal: "Pak RT"), pilih avatar bidak, lalu klik **"Buat Room Baru (Host)"**.
3. Di panel kanan, klik tombol **"🤖 + Tambah Bot Warga"** berulang kali hingga kuota mencapai 10 pemain.
4. (Opsional) Klik tombol **"📚 Bank Soal"** di bagian atas untuk menambah atau melihat bank soal kustom.
5. Klik **"▶️ Mulai Permainan Warga"**.
6. Amati pergerakan 10 bidak di petak, alur giliran cepat, pemicu kuis edukasi, serta podium kemenangan di akhir ronde!
