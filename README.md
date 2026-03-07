# F1 Private Fantasy League (Supabase + Vercel)

Drivers-only fantasy web app for a private league, with room to expand.

## Features implemented

- Email signup/login (Supabase Auth)
- Private league-ready data model
- Per-weekend picks with independent lock windows:
  - Qualifying: pick 1,2,3
  - Sprint: pick top 5
  - Race: pick top 10
- No budget system
- Scoring rules:
  - Exact position match = highest points
  - Position difference 1/2/3 = decreasing points
  - Difference > 3 = 0 points
  - DNF penalty included for sprint/race picks
- Scoring updates can be run after each session and re-run after penalties
- Dashboard leaderboard + weekly breakdown
- Mobile-friendly UI

## Source of F1 results

- `api.jolpi.ca` (Ergast-compatible API) is used as the single source.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Add env vars (`.env.local` and Vercel):

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

3. Run `supabase/schema.sql` in Supabase SQL editor.

4. Create at least one weekend row in `race_weekends` with correct lock timestamps.

5. Make one account admin:

```sql
update profiles set is_admin = true where id = '<your-user-uuid>';
```

6. Run locally:

```bash
npm run dev
```

## Admin workflow per round

1. Go to `/admin`
2. Sync results (`season`, `round`) from API source
3. Run scoring with `weekendId`
4. Re-run scoring after steward penalties/final classifications

## Deploy

Deploy to Vercel and add the same environment variables.
