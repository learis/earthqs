// Gerekli paketlerin kurulumu:
// npm install axios cheerio pg

const axios = require('axios');
const cheerio = require('cheerio');
const { Pool } = require('pg');

// PostgreSQL bağlantısı
const DB_CONFIG = {
  host: 'your_host',
  port: 5432,
  user: 'your_user',
  password: 'your_password',
  database: 'earthqdb'
};

const pool = new Pool(DB_CONFIG);

// Veritabanında tabloyu oluştur (eğer yoksa)
async function initializeDatabase() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS earthquakes (
      uid TEXT PRIMARY KEY,
      tarih DATE,
      saat TIME,
      enlem REAL,
      boylam REAL,
      derinlik REAL,
      buyukluk REAL,
      yer TEXT,
      sehir TEXT
    );
  `;
  await pool.query(createTableQuery);
}

// Deprem verilerini çek ve veritabanına ekle
async function fetchAndSaveEarthquakes() {
  try {
    const response = await axios.get('http://www.koeri.boun.edu.tr/scripts/lst6.asp');
    const html = response.data;
    const $ = cheerio.load(html);

    const rows = $('pre').text().split('\n').slice(7); // İlk 7 satır başlık ve boşluk, atlıyoruz

    for (const row of rows) {
      const parts = row.trim().split(/\s+/);
      if (parts.length < 7) continue;

      const tarih = parts[0].replace(/\./g, '-'); // 2024.06.17 -> 2024-06-17
      const saat = parts[1];
      const enlem = parseFloat(parts[2]);
      const boylam = parseFloat(parts[3]);
      const derinlik = parseFloat(parts[4].replace(',', '.'));
      const buyukluk = parseFloat(parts[6].replace(',', '.'));

      // Yer ve şehir bilgisi
      const yerHam = parts.slice(7).join(' ').trim();
      let yer = yerHam;
      let sehir = null;

      const parantezMatch = yerHam.match(/^(.*)\s+\(([^)]+)\)$/);
      if (parantezMatch) {
        yer = parantezMatch[1].trim();
        sehir = parantezMatch[2].trim();
      }

      const uid = `${tarih}_${saat}_${enlem}_${boylam}`;

      const insertQuery = `
        INSERT INTO earthquakes(uid, tarih, saat, enlem, boylam, derinlik, buyukluk, yer, sehir)
        VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (uid) DO NOTHING;
      `;
      const values = [uid, tarih, saat, enlem, boylam, derinlik, buyukluk, yer, sehir];

      await pool.query(insertQuery, values);
    }

    console.log(`[${new Date().toISOString()}] Veri kontrolü tamamlandı.`);
  } catch (error) {
    console.error('Veri çekme veya kaydetme hatası:', error.message);
  }
}

// Ana başlangıç
(async () => {
  try {
    await initializeDatabase();         // Tabloyu oluştur
    await fetchAndSaveEarthquakes();    // İlk veri çekme
    setInterval(fetchAndSaveEarthquakes, 30000); // 30 saniyede bir çalıştır
  } catch (err) {
    console.error('Başlatma hatası:', err.message);
  }
})();
