# StatLine — Sports Stats Hub

NBA, NFL, and MLB stats made simple. Compare players, check scores, and share stats.

## Setup

```bash
npm install
npm run dev
```

## Deploy to Vercel

Push to GitHub, connect the repo in Vercel — it auto-detects Vite and deploys.

## Data

StatLine reads from Supabase. Run your Python sync scripts to populate the database with NBA data before the app will show anything.

## Stack

- **Vite + React** — same setup as Barracks
- **Tailwind CSS** — utility-first styling
- **Supabase** — PostgreSQL database (client-side reads)
- **Vercel** — hosting (free tier)
