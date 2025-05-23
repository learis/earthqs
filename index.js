// index.js
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
  const query = `
    CREATE TABLE IF NOT EXISTS earthquakes (
      id SERIAL PRIMARY KEY,
      uuid TEXT UNIQUE,
      date DATE,
      time TEXT,
      lat TEXT,
      lon TEXT,
      depth FLOAT,
      magnitude FLOAT,
      place TEXT,
      area TEXT,
      type TEXT
    );
  `;
  await pool.query(query);
}

function generateUUID(date, time, lat, lon) {
  const d = date.replace(/\./g, '');
  const t = time.replace(/:/g, '');
  const latFixed = lat.replace(/\./g, '');
  const lonFixed = lon.replace(/\./g, '');
  return `${d}${t}${latFixed}${lonFixed}`;
}

async function fetchAndSave() {
  try {
    const response = await axios.get('http://www.koeri.boun.edu.tr/scripts/lst0.asp');
    const $ = cheerio.load(response.data);
    const raw = $('pre').text();
    const rowRegex = /\d{4}\.\d{2}\.\d{2}.*?(?=\n\d{4}\.\d{2}\.\d{2}|$)/gs;
    const rows = [...raw.matchAll(rowRegex)].map(m => m[0].trim());

    for (const row of rows) {
      const parts = row.trim().split(/\s+/);
      if (parts.length < 10) continue;

      const date = parts[0].replace(/\./g, '-');
      const time = parts[1];
      const lat = parts[2];
      const lon = parts[3];
      const depth = parseFloat(parts[4].replace(',', '.'));
      const magnitude = parseFloat(parts[6].replace(',', '.'));
      const yerHam = parts.slice(9).join(' ');

      let place = yerHam;
      let area = null;

      const match = yerHam.match(/^(.*)\s+\(([^)]+)\)$/);
      if (match) {
        area = match[1].trim();
        place = match[2].trim();
      }

      const type = parts[parts.length - 1].toLowerCase();
      const uuid = generateUUID(date, time, lat, lon);

      const insertQuery = `
        INSERT INTO earthquakes(uuid, date, time, lat, lon, depth, magnitude, place, area, type)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (uuid) DO NOTHING;
      `;

      const values = [uuid, date, time, lat, lon, depth, magnitude, place, area, type];

      try {
        await pool.query(insertQuery, values);
      } catch (err) {
        console.error('DB Insert Error:', err.message);
      }
    }

    console.log(`[${new Date().toISOString()}] Veri kontrolü tamamlandı.`);
  } catch (error) {
    console.error('Fetch Error:', error.message);
  }
}

(async () => {
  await initializeDatabase();
  await fetchAndSave();
  setInterval(fetchAndSave, 30000);
})();
