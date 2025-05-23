const axios = require('axios');
const cheerio = require('cheerio');
const { Pool } = require('pg');

const DB_CONFIG = {
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE
};

const pool = new Pool(DB_CONFIG);

async function initializeDatabase() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS earthquakes (
      id SERIAL PRIMARY KEY,
      uuid TEXT UNIQUE,
      tarih DATE,
      saat TEXT,
      enlem REAL,
      boylam REAL,
      derinlik REAL,
      buyukluk REAL,
      yer TEXT,
      sehir TEXT,
      bolge TEXT
    );
  `;
  await pool.query(createTableQuery);
}

function generateUUID(tarih, saat, enlem, boylam) {
  const datePart = tarih.replace(/-/g, '');
  const timePart = saat.replace(/:/g, '');
  const latPart = enlem.toString().replace('.', '');
  const lonPart = boylam.toString().replace('.', '');
  return `${datePart}${timePart}${latPart}${lonPart}`;
}

async function fetchAndSaveEarthquakes() {
  try {
    const response = await axios.get('http://www.koeri.boun.edu.tr/scripts/lst6.asp');
    const html = response.data;
    const $ = cheerio.load(html);
    const rows = $('pre').text().split('\n').slice(7);

    for (const row of rows) {
      const parts = row.trim().split(/\s+/);
      if (parts.length < 7) continue;

      const tarih = parts[0].replace(/\./g, '-');
      const saat = parts[1];
      const enlem = parseFloat(parts[2]);
      const boylam = parseFloat(parts[3]);
      const derinlik = parseFloat(parts[4].replace(',', '.'));

      // Büyüklük tipi ML olanı bul
      let buyukluk = null;
      for (let i = 6; i < parts.length; i++) {
        if (parts[i].startsWith('ML')) {
          buyukluk = parseFloat(parts[i + 1]?.replace(',', '.') || 'NaN');
          break;
        }
      }
      if (buyukluk === null || isNaN(buyukluk)) continue; // ML yoksa geç

      // ML sonrası kalanlar yer bilgisi (Mw veya MD varsa atlanmış olur)
      const yerIndex = parts.findIndex(p => p.startsWith('ML'));
      const yerHam = parts.slice(yerIndex + 2).join(' ').trim();
      let yer = yerHam;
      let sehir = null;
      let bolge = null;

      const parantezMatch = yerHam.match(/^(.*)\s+\(([^)]+)\)$/);
      if (parantezMatch) {
        yer = parantezMatch[1].trim();
        bolge = parantezMatch[2].trim();
      }

      const uuid = generateUUID(tarih, saat, enlem, boylam);

      const insertQuery = `
        INSERT INTO earthquakes(uuid, tarih, saat, enlem, boylam, derinlik, buyukluk, yer, sehir, bolge)
        VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (uuid) DO NOTHING;
      `;
      const values = [uuid, tarih, saat, enlem, boylam, derinlik, buyukluk, yer, sehir, bolge];
      await pool.query(insertQuery, values);
    }

    console.log(`[${new Date().toISOString()}] Veri kontrolü tamamlandı.`);
  } catch (err) {
    console.error('Hata:', err.message);
  }
}

(async () => {
  try {
    await initializeDatabase();
    await fetchAndSaveEarthquakes();
    setInterval(fetchAndSaveEarthquakes, 30000);
  } catch (err) {
    console.error('Başlatma hatası:', err.message);
  }
})();
