# EarthQs Fetcher

This service fetches data from Kandilli Observatory every 30 seconds and stores it in the Railway PostgreSQL instance.

## Env Vars (.env)
- `PGHOST` → DB host
- `PGPORT` → DB port
- `PGUSER` → DB user
- `PGPASSWORD` → DB password
- `PGDATABASE` → DB name

## Installation
```
npm install
```

## Start
```
npm start
```

This script should be configured as a continuously running worker on Railway.
