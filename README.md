# AFAD Earthquake Fetcher

This Node.js service fetches the latest earthquake data from [AFAD](https://deprem.afad.gov.tr/last-earthquakes.html) every 30 seconds and stores new entries into a PostgreSQL database.

## Environment Variables
Copy `.env.example` to `.env` and fill in your database connection details:

```
PGHOST=your_postgres_host
PGPORT=5432
PGUSER=your_postgres_user
PGPASSWORD=your_postgres_password
PGDATABASE=your_postgres_database
```

## Installation
```bash
npm install
```

## Running the App
```bash
npm start
```

## Table Schema
```
id         SERIAL PRIMARY KEY
uuid       TEXT
date       DATE
TIME       TEXT
latitude   FLOAT
longitude  FLOAT
depth      FLOAT
type       TEXT
magnitude  FLOAT
location   TEXT
```

## Deployment
This app is designed to run continuously (e.g., on Railway) as a cron-like worker service.
