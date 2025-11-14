# Tennis Bot

Automation tool that books tennis courts via CourtReserve exactly 48 hours in advance. The bot runs locally, drives the booking UI with Playwright, and supports scheduled runs plus notifications.

## Proposed Tech Stack
- **Runtime:** Node.js 20+ with TypeScript for typed automation logic.
- **Automation:** Playwright (Chromium) for resilient selectors, screenshots, retries.
- **Scheduler:** `node-cron` for cron-like jobs plus a lightweight SQLite queue if persistence is needed.
- **Config/Secrets:** `dotenv` + `zod` validation, `.env` for credentials, YAML for job definitions.
- **Tooling:** pnpm, ESLint, Prettier, vitest for unit coverage around helpers.

## Target Folder Structure
```
.
├── README.md              # project overview
├── package.json           # npm metadata (to be generated)
├── tsconfig.json          # TypeScript compiler options
├── .env.example           # documented secrets
├── config/
│   ├── jobs.example.yaml  # sample booking definitions
│   └── playwright.config.ts
├── src/
│   ├── index.ts           # CLI entry point
│   ├── automation/        # browser flows (login, booking)
│   ├── scheduler/         # job registration + queueing
│   ├── config/            # config loader + validation
│   └── notifications/     # local notification/email adapters
├── scripts/
│   └── install-playwright.sh # helper for playwright deps
├── tests/
│   ├── automation.spec.ts
│   └── scheduler.spec.ts
└── docs/
    └── architecture.md    # extended design notes
```

## Next Steps
1. Scaffold directories/files above.
2. Initialize Node.js project with pnpm and add Playwright + tooling deps.
3. Implement config loader + CLI stub.
4. Encode automation steps (login, date pick, slot booking) using Playwright.
5. Layer in scheduler logic (48h offset, retries, logging).
6. Add notifications + runbook instructions.

## Local Development
1. Install Node.js 20 and `pnpm`.
2. Copy `.env.example` to `.env`, add CourtReserve credentials and secrets.
3. Define booking jobs in `config/jobs.yaml`.
4. Run `pnpm install` followed by `pnpm start -- --config config/jobs.yaml` when implemented.
