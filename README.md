# StatLine

Multi-sport stats hub. Mobile-first. Built for sharing. 

## Quick Start

### 1. Set up the database
Go to your Supabase dashboard → SQL Editor → paste and run `setup_db.sql`

### 2. Sync NBA data
```bash
pip install requests
python sync_nba.py
```

### 3. Run the app
```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Deploy
Push to GitHub, connect to Vercel, auto-deploys.

## Sync Commands

```bash
python sync_nba.py              # Sync everything
python sync_nba.py teams        # Just teams
python sync_nba.py standings    # Just standings
python sync_nba.py players      # Just players + stats
python sync_nba.py scores       # Just recent scores
```

## Stack
- **Frontend:** Next.js 15 + Tailwind CSS v4
- **Database:** Supabase (PostgreSQL)
- **Data:** ESPN API → Python sync → Supabase → App
- **Hosting:** Vercel
