# Architecture Notes

This document expands on the README high-level plan:

- **Automation Layer:** Playwright handles login, date selection, and court booking. Helper modules provide selectors and retries.
- **Scheduler Layer:** Calculates release timestamps (date/time minus 48h) and registers cron jobs. Jobs persist in JSON/SQLite for durability.
- **Config Layer:** YAML job definitions plus `.env` secrets. Zod validates inputs before scheduling.
- **Notifications:** Local email or webhook to confirm bookings.
- **CLI:** `pnpm start -- --config config/jobs.yaml` loads config, primes scheduler, and logs progress.
