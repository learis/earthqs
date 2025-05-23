const axios = require('axios');
const cheerio = require('cheerio');
const { Pool } = require('pg');

const DB_CONFIG = {
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
};

const pool = new Pool(DB_CONFIG);

async function initializeDatabase() {
  const query = `
    CREATE TABLE IF NOT EXISTS earthquakes (
      id SERIAL PRIMARY KEY,
      uuid TEXT UNIQUE,
      date DATE,
      latitude FLOAT,
      longitude FLOAT,
      depth FLOAT,
      type TEXT,
      magnitude FLOAT,
      location TEXT
    );
  `;
  await pool.query(query);
}

function generateUUID(datetime, latitude, longitude) {
  const dt = datetime.replace(/[-:\s]/g, ''); // YYYYMMDDHHmmss
  const lat = latitude.toString().replace('.', '');
  const lon = longitude.toString().replace('.', '');
  return `${dt}${lat}${lon}`;
}

function parseDateTime(datetimeStr) {
  // TS: "2024-05-23 15:42:17"
  const [date, time] = datetimeStr.split(' ');
  return {
    dateOnly: date,
    dateTimeCompact: date.replace(/-/g, '') + time.replace(/:/g, '')
  };
}

async function fetchAndSaveEarthquakes() {
  try {
    const response = await axios.get('https://deprem.afad.gov.tr/last-earthquakes.html');
    const $ = cheerio.load(response.data);
    const rows = $('table tbody tr');

    for (let i = 0; i < rows.length; i++) {
      const columns = $(rows[i]).find('td');
      if (columns.length < 7) continue;

      const ts = $(columns[0]).text().trim();
      const latitude = parseFloat($(columns[1]).text().trim().replace(',', '.'));
      const longitude = parseFloat($(columns[2]).text().trim().replace(',', '.'));
      const depth = parseFloat($(columns[3]).text().trim().replace(',', '.'));
      const type = $(columns[4]).text().trim();
      const magnitude = parseFloat($(columns[5]).text().trim().replace(',', '.'));
      const location = $(columns[6]).text().trim();

      const { dateOnly, dateTimeCompact } = parseDateTime(ts);
      const uuid = generateUUID(dateTimeCompact, latitude, longitude);

      const insertQuery = `
        INSERT INTO earthquakes(uuid, date, latitude, longitude, depth, type, magnitude, location)
        VALUES($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (uuid) DO NOTHING;
      `;

      const values = [
        uuid,
        dateOnly,
        latitude,
        longitude,
        depth,
        type,
        magnitude,
        location
      ];

      try {
        await pool.query(insertQuery, values);
      } catch (err) {
        console.error('Insert error:', err.message, values);
      }
    }

    console.log(`[${new Date().toISOString()}] Earthquake check completed.`);
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

(async () => {
  await initializeDatabase();
  await fetchAndSaveEarthquakes();
  setInterval(fetchAndSaveEarthquakes, 30000);
})();
