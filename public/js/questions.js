// questions.js - Bank Soal Edukasi Pengetahuan Umum (General Knowledge) Wargaopoly 62
// Topik: Geografi Nusantara & Dunia, Sejarah, Sains Populer, Kebudayaan, dan Fakta Unik

const DEFAULT_QUESTIONS = [
  {
    id: "gen_01",
    category: "Geografi Nusantara",
    difficulty: "Mudah",
    type: "multiple_choice",
    question: "Danau vulkanik terbesar di dunia yang terletak di Provinsi Sumatera Utara adalah...",
    options: [
      "Danau Singkarak",
      "Danau Toba",
      "Danau Matano",
      "Danau Sentani"
    ],
    correct_index: 1,
    explanation: "Danau Toba adalah danau vulkanik terbesar di dunia dengan panjang 100 km dan lebar 30 km, terbentuk dari letusan supervolcano sekitar 74.000 tahun yang lalu.",
    reward: { cash: 100000, discount_pct: 15 },
    penalty: { cash: 40000 }
  },
  {
    id: "gen_02",
    category: "Sejarah Indonesia",
    difficulty: "Mudah",
    type: "multiple_choice",
    question: "Siapakah tokoh yang mengetik naskah Proklamasi Kemerdekaan Indonesia pada 17 Agustus 1945?",
    options: [
      "Sayuti Melik",
      "Sukarni",
      "B.M. Diah",
      "Mohammad Hatta"
    ],
    correct_index: 0,
    explanation: "Sayuti Melik mengetik naskah Proklamasi Kemerdekaan Indonesia di rumah Laksamana Maeda setelah konsep naskah ditulis tangan oleh Ir. Soekarno.",
    reward: { cash: 120000, discount_pct: 20 },
    penalty: { cash: 50000 }
  },
  {
    id: "gen_03",
    category: "Sains & Alam",
    difficulty: "Mudah",
    type: "multiple_choice",
    question: "Planet apakah yang memiliki ukuran paling besar di dalam sistem Tata Surya kita?",
    options: [
      "Saturnus",
      "Jupiter",
      "Neptunus",
      "Bumi"
    ],
    correct_index: 1,
    explanation: "Jupiter adalah planet terbesar di Tata Surya dengan diameter sekitar 11 kali diameter Bumi dan memiliki lebih dari 90 satelit alami.",
    reward: { cash: 100000, discount_pct: 15 },
    penalty: { cash: 40000 }
  },
  {
    id: "gen_04",
    category: "Budaya Nusantara",
    difficulty: "Sedang",
    type: "multiple_choice",
    question: "Alat musik petik tradisional khas Pulau Rote, Nusa Tenggara Timur yang terbuat dari daun lontar adalah...",
    options: [
      "Kolintang",
      "Sasando",
      "Gamelan",
      "Angklung"
    ],
    correct_index: 1,
    explanation: "Sasando adalah alat musik dawai petik tradisional dari Pulau Rote, NTT. Wadah resonansinya dibuat dari anyaman daun lontar berbentuk setengah bola.",
    reward: { cash: 150000, discount_pct: 20 },
    penalty: { cash: 50000 }
  },
  {
    id: "gen_05",
    category: "Geografi Dunia",
    difficulty: "Mudah",
    type: "boolean",
    question: "Benua terluas di dunia berdasarkan luas daratan dan populasi penduduk adalah Benua Asia. Benar atau Salah?",
    options: ["Benar", "Salah"],
    correct_index: 0,
    explanation: "Benar! Benua Asia mencakup sekitar 30% dari total luas daratan bumi dan dihuni oleh sekitar 60% populasi manusia di dunia.",
    reward: { cash: 100000, discount_pct: 15 },
    penalty: { cash: 30000 }
  },
  {
    id: "gen_06",
    category: "Sains Populer",
    difficulty: "Sedang",
    type: "multiple_choice",
    question: "Gas apakah yang memiliki konsentrasi persentase paling banyak di atmosfer bumi kita?",
    options: [
      "Oksigen (O2)",
      "Nitrogen (N2)",
      "Karbon Dioksida (CO2)",
      "Argon (Ar)"
    ],
    correct_index: 1,
    explanation: "Atmosfer bumi terdiri dari sekitar 78% Nitrogen (N2), 21% Oksigen (O2), 0,9% Argon, dan sisanya gas-gas lain termasuk Karbon Dioksida.",
    reward: { cash: 130000, discount_pct: 20 },
    penalty: { cash: 50000 }
  },
  {
    id: "gen_07",
    category: "Sejarah & Warisan Dunia",
    difficulty: "Sedang",
    type: "multiple_choice",
    question: "Candi Borobudur di Magelang, Jawa Tengah didirikan pada masa pemerintahan dinasti/wangsa apa?",
    options: [
      "Wangsa Sanjaya",
      "Wangsa Syailendra",
      "Wangsa Isyana",
      "Wangsa Rajasa"
    ],
    correct_index: 1,
    explanation: "Candi Borobudur dibangun pada abad ke-8 hingga ke-9 Masehi oleh penganut agama Buddha Mahayana di bawah pemerintahan Wangsa Syailendra.",
    reward: { cash: 150000, discount_pct: 25 },
    penalty: { cash: 60000 }
  },
  {
    id: "gen_08",
    category: "Geografi Nusantara",
    difficulty: "Mudah",
    type: "multiple_choice",
    question: "Titik tertinggi di Indonesia yang diselimuti salju abadi berada di Puncak Jaya (Carstensz Pyramid), di pegunungan...",
    options: [
      "Pegunungan Barisan",
      "Pegunungan Jayawijaya",
      "Pegunungan Meratus",
      "Pegunungan Schwaner"
    ],
    correct_index: 1,
    explanation: "Puncak Jaya memiliki ketinggian 4.884 meter di atas permukaan laut dan terletak di Pegunungan Sudirman/Jayawijaya di Provinsi Papua Tengah.",
    reward: { cash: 120000, discount_pct: 20 },
    penalty: { cash: 40000 }
  },
  {
    id: "gen_09",
    category: "Biologi & Lingkungan",
    difficulty: "Mudah",
    type: "multiple_choice",
    question: "Hewan terbesar yang pernah hidup di bumi, yang termasuk golongan mamalia laut adalah...",
    options: [
      "Hiu Paus",
      "Paus Biru (Blue Whale)",
      "Cumi-cumi Raksasa",
      "Paus Pembunuh (Orca)"
    ],
    correct_index: 1,
    explanation: "Paus Biru dapat mencapai panjang lebih dari 30 meter dan berat mencapai 190 ton, menjadikannya hewan terbesar sepanjang sejarah kehidupan bumi.",
    reward: { cash: 100000, discount_pct: 15 },
    penalty: { cash: 40000 }
  },
  {
    id: "gen_10",
    category: "Pengetahuan Umum Dunia",
    difficulty: "Mudah",
    type: "multiple_choice",
    question: "Mata uang resmi yang digunakan di negara Jepang adalah...",
    options: [
      "Won",
      "Yen",
      "Yuan",
      "Ringgit"
    ],
    correct_index: 1,
    explanation: "Yen (¥) adalah mata uang resmi negara Jepang dan merupakan salah satu mata uang yang paling banyak diperdagangkan di pasar devisa internasional.",
    reward: { cash: 100000, discount_pct: 15 },
    penalty: { cash: 30000 }
  },
  {
    id: "gen_11",
    category: "Sejarah Indonesia",
    difficulty: "Mudah",
    type: "boolean",
    question: "Kongres Pemuda II yang melahirkan ikrar Sumpah Pemuda diselenggarakan pada tanggal 28 Oktober 1928. Benar atau Salah?",
    options: ["Benar", "Salah"],
    correct_index: 0,
    explanation: "Benar! Ikrar Sumpah Pemuda pada 28 Oktober 1928 menegaskan cita-cita persatuan: satu tanah air, satu bangsa, dan satu bahasa persatuan yaitu Indonesia.",
    reward: { cash: 100000, discount_pct: 15 },
    penalty: { cash: 30000 }
  },
  {
    id: "gen_12",
    category: "Fisika & Teknologi",
    difficulty: "Sedang",
    type: "multiple_choice",
    question: "Berapakah perkiraan kecepatan rambat cahaya di ruang hampa udara?",
    options: [
      "100.000 km/detik",
      "300.000 km/detik",
      "500.000 km/detik",
      "1.000.000 km/detik"
    ],
    correct_index: 1,
    explanation: "Kecepatan cahaya dalam ruang hampa adalah konstanta fisika universal sebesar sekitar 299.792 kilometer per detik (dibulatkan menjadi 300.000 km/detik).",
    reward: { cash: 150000, discount_pct: 20 },
    penalty: { cash: 50000 }
  },
  {
    id: "gen_13",
    category: "Budaya Nusantara",
    difficulty: "Mudah",
    type: "multiple_choice",
    question: "Tari Saman yang terkenal dengan tepukan ritmis harmonis dan diakui UNESCO berasal dari daerah...",
    options: [
      "Sumatera Barat (Minangkabau)",
      "Aceh (Suku Gayo)",
      "Bali",
      "Sulawesi Selatan (Toraja)"
    ],
    correct_index: 1,
    explanation: "Tari Saman dikembangkan oleh Syekh Saman dari suku Gayo, Aceh Tenggara. Tarian ini menonjolkan kekompakan, kecepatan gerak tangan, dan syair petuah agama.",
    reward: { cash: 120000, discount_pct: 20 },
    penalty: { cash: 40000 }
  },
  {
    id: "gen_14",
    category: "Geografi Dunia",
    difficulty: "Sedang",
    type: "multiple_choice",
    question: "Samudra terdalam dan terluas di permukaan planet bumi adalah...",
    options: [
      "Samudra Atlantik",
      "Samudra Pasifik",
      "Samudra Hindia",
      "Samudra Arktik"
    ],
    correct_index: 1,
    explanation: "Samudra Pasifik menutupi lebih dari 30% permukaan bumi dan memiliki palung terdalam di dunia yaitu Palung Mariana dengan kedalaman hampir 11.000 meter.",
    reward: { cash: 140000, discount_pct: 20 },
    penalty: { cash: 50000 }
  },
  {
    id: "gen_15",
    category: "Tokoh & Sains",
    difficulty: "Mudah",
    type: "multiple_choice",
    question: "Siapakah ilmuwan yang mengemukakan Hukum Gravitasi Universal setelah konon mengamati buah apel jatuh dari pohon?",
    options: [
      "Albert Einstein",
      "Sir Isaac Newton",
      "Galileo Galilei",
      "Nikola Tesla"
    ],
    correct_index: 1,
    explanation: "Sir Isaac Newton merumuskan hukum gerak dan gravitasi universal dalam karyanya Philosophiæ Naturalis Principia Mathematica pada tahun 1687.",
    reward: { cash: 110000, discount_pct: 15 },
    penalty: { cash: 40000 }
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEFAULT_QUESTIONS };
}
