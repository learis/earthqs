const axios = require('axios');
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
      date DATE,
      latitude FLOAT,
      longitude FLOAT,
      depth FLOAT,
      type TEXT,
      magnitude FLOAT,
      location TEXT,
      eventID INTEGER UNIQUE
    );
  `;
  await pool.query(query);
}

function parseAfadDate(dateStr) {
  // AFAD format: 23-05-2025 21:55:34 → needs to become YYYY-MM-DD
  const [day, month, year] = dateStr.split(' ')[0].split('-');
  return `${year}-${month}-${day}`;
}

async function fetchAndSaveEarthquakes() {
  try {
    const response = await axios.get('https://deprem.afad.gov.tr/last-earthquakes');
    const earthquakes = response.data.result || [];

    console.log(`Fetched ${earthquakes.length} earthquakes from AFAD.`);

    for (const quake of earthquakes) {
      const {
        date,
        latitude,
        longitude,
        depth,
        type,
        magnitude,
        location,
        eventID
      } = quake;

      const parsedDate = parseAfadDate(date);
      const values = [
        parsedDate,
        parseFloat(latitude),
        parseFloat(longitude),
        parseFloat(depth),
        type,
        parseFloat(magnitude),
        location,
        parseInt(eventID)
      ];

      console.log('Inserting values:', values);

      const insertQuery = `
        INSERT INTO earthquakes(date, latitude, longitude, depth, type, magnitude, location, eventID)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (eventID) DO NOTHING;
      `;

      try {
        await pool.query(insertQuery, values);
      } catch (err) {
        console.error('Insert error:', err.message, 'Data:', values);
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
