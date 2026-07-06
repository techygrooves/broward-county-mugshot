# Broward Arrest Records

A production-ready MVP website for Broward County, Florida public arrest and
booking information, sourced exclusively from **official Broward Sheriff's
Office (BSO) public records**:

- Primary: [BSO Booking Blotter](https://bookingblotter.sheriff.org/app/)
- Secondary reference: [BSO Arrest Search](https://apps.sheriff.org/arrestsearch?d=y)

Built with **Next.js (App Router) + TypeScript + Tailwind CSS + Supabase
PostgreSQL**, deployable to Vercel.

Professional legal/news presentation — clean light theme, clear disclaimers,
soft attorney information blocks, and a **free** removal request workflow
(Florida law prohibits charging for mugshot removal, and this project has no
paid removal system by design).

---

## 1. Project overview

| Area | What it does |
|---|---|
| `/` | Homepage: strong arrest search + recent Broward arrest records |
| `/recent-arrests` | Daily/recent arrest listing with pagination |
| `/search` | Search by first name, last name, arrest number, charge, booking date range |
| `/arrest/[id]` | Arrest detail page with required disclaimer + official source link |
| `/charges` and `/charges/[slug]` | Charge category pages (DUI, battery, domestic violence, theft, drug charges, probation violation, traffic offenses, weapons charges, fraud, burglary) |
| `/remove-mugshot` | Free removal request form |
| `/guides/*` | SEO/informational pages (finding arrests, post-arrest steps, mugshot removal rights, FL removal law, sealing vs. expungement, defense help, why records go stale) |
| `/privacy`, `/terms`, `/disclaimer` | Legal pages |
| `/admin` | Password-gated dashboard: totals, hidden records, pending removals, last scraper run |
| `/admin/records` | Record management: publish, hide/unhide record, hide/unhide photo, delete |
| `/admin/removal-requests` | Approve (hide record or photo only) / reject removal requests |
| `/admin/scraper-runs` | Scraper run history with statuses and errors |
| `/admin/import` | Manual fallback: CSV upload + manual record entry (records held as *pending* until published) |
| `scripts/scrape-broward.ts` | Polite scraper for the official BSO Booking Blotter with dry-run mode |
| `/api/cron/scrape` | HTTP entry point for daily scheduled scraping (Vercel Cron) |

**Data source policy (important):**

1. Only official BSO sources are scraped. Third-party mugshot sites are never
   used as a data source.
2. The scraper identifies itself honestly (`SCRAPER_USER_AGENT`), waits
   between requests (`SCRAPER_DELAY_MS`, default 2.5 s), caps records per run,
   and runs on a daily schedule only.
3. If the official source responds with 401/403/429/503 or a CAPTCHA /
   anti-bot challenge page, the run stops with status **blocked**. No
   bypassing, header spoofing, or CAPTCHA solving is attempted. Use the
   manual import fallback at `/admin/import`.
4. Every record stores its official source URL. Mugshot URLs are stored only
   when openly provided by the official source, and images are **not
   displayed** unless you explicitly set `NEXT_PUBLIC_DISPLAY_MUGSHOTS=true`
   (no hotlinking by default).
5. Records are deduplicated by `(source, arrest_number)` with idempotent
   upserts, so the daily run never creates duplicates.
6. Records approved for removal go on the `suppression_list` and are never
   re-inserted or re-published; hidden records are never resurrected by the
   scraper.

**Access status from this build environment:** both official BSO URLs
returned HTTP 403 to automated requests during development. The scraper is
therefore fully implemented but expected to report `blocked` in many hosting
environments — the manual import workflow is the guaranteed data path. If
your production host's IP is not blocked by BSO, the scraper will discover
and use the app's public JSON endpoints (or public HTML) automatically.

## 2. Setup steps

```bash
git clone <this repo>
cd broward-county-mugshot
npm install
cp .env.example .env.local   # then fill in values
npm run dev                  # http://localhost:3000
```

The site runs without Supabase configured — public pages show clearly-marked
fictional sample data so you can review the UI. Connect Supabase to work with
real data.

## 3. Environment variables

Copy `.env.example` to `.env.local`. **Never commit real secrets.**

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (RLS-protected reads) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server/scraper writes — keep secret |
| `ADMIN_PASSWORD` | Password for the `/admin` gate |
| `BROWARD_SOURCE_URL` | Official source (default: BSO Booking Blotter) |
| `SCRAPER_USER_AGENT` | Honest UA string with a real contact address |
| `NEXT_PUBLIC_SITE_URL` | Public URL for metadata/sitemap |
| `NEXT_PUBLIC_DISPLAY_MUGSHOTS` | `true` to render booking photos (default off) |
| `CRON_SECRET` | Protects `/api/cron/scrape` |
| `SCRAPER_DELAY_MS` | Politeness delay between requests (default 2500) |
| `SCRAPER_MAX_RECORDS` | Per-run record cap (default 500) |

## 4. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run `supabase/migrations/0001_init.sql`
   (creates `arrests`, `scraper_runs`, `removal_requests`,
   `suppression_list`, indexes, the updated-at trigger, and RLS policies).
3. Copy the project URL, anon key, and service role key into `.env.local`.
4. Restart `npm run dev`.

RLS is enabled: the anon key can only read published, non-hidden arrests and
insert pending removal requests. All app writes happen server-side with the
service role key.

## 5. How to run locally

```bash
npm install
npm run build   # production build check
npm run dev     # dev server on 0.0.0.0:3000
```

## 6. Scraper — dry run

```bash
npm run scrape:broward:dry-run
```

Fetches the official source, discovers endpoints, normalizes records, and
prints what *would* be written. No database writes. Also supports a date
filter:

```bash
npm run scrape:broward:dry-run -- --date 2026-07-01
```

## 7. Scraper — live run

```bash
npm run scrape:broward
npm run scrape:broward -- --date 2026-07-01
```

Live runs write to Supabase (idempotent upserts, suppression-list checks) and
log a row in `scraper_runs`. Exit codes: `0` success/no-data, `2` blocked by
source, `1` error.

If the run reports **blocked**: the official source is refusing automated
access. Do not attempt to bypass it. Use `/admin/import` (CSV or manual
entry) instead — that is the supported fallback.

## 8. How to open the local web preview

`npm run dev` starts Next.js on `0.0.0.0:3000`.

- Local machine: open <http://localhost:3000>
- Cloud IDE / container: use the forwarded-port preview for port **3000**
  (e.g. the "Open in browser" / Ports panel of your environment)

## 9. How to deploy to Vercel

1. Push this repo to GitHub and import it in Vercel (framework preset:
   Next.js — zero config).
2. Add all environment variables from section 3 in Vercel → Project →
   Settings → Environment Variables (including `CRON_SECRET`).
3. Deploy. `vercel.json` already schedules the daily cron (see next section).

## 10. Daily cron setup

**Vercel (built in):** `vercel.json` schedules `GET /api/cron/scrape` daily at
09:00 UTC. Set `CRON_SECRET` in project env vars; Vercel automatically sends
it as `Authorization: Bearer <CRON_SECRET>`. Test manually:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://your-site.vercel.app/api/cron/scrape?dry_run=true"
```

**Self-hosted (system cron):**

```cron
# Daily at 04:10 America/New_York
10 4 * * * cd /path/to/broward-county-mugshot && npm run scrape:broward >> /var/log/broward-scraper.log 2>&1
```

Keep it to **one run per day** — that is part of the politeness policy.

## 11. Legal & compliance notes

- **Public records**: arrest/booking data comes from official BSO public
  records; every record links back to its official source.
- **Presumption of innocence**: every arrest page carries the required
  disclaimer: *"This information comes from public arrest records. An arrest
  does not mean the person was convicted. Information may change or contain
  errors. Check the official Broward Sheriff source for the latest record."*
- **No pay-for-removal**: Florida Statute 943.0593 prohibits charging to
  remove booking photos. This project contains **no paid removal system**;
  the removal workflow is free by design.
- **Not FCRA**: the site is not a consumer reporting agency; terms prohibit
  employment/tenant/credit screening uses.
- **Polite automation**: honest UA, delays, daily-only schedule, hard caps,
  and an automatic stop when the source blocks access — no circumvention.
- **Mugshot images**: not displayed by default; enable only after confirming
  the source's policy allows it. Approved photo removals are suppressed
  permanently.
- Consider registering a DMCA agent and consulting a Florida attorney before
  operating this site commercially. Nothing in this repo is legal advice.

## 12. Removal request workflow

1. Visitor submits the **free** form at `/remove-mugshot` (optionally
   pre-linked to a record from its detail page).
2. The request is stored (`removal_requests`, status `pending`) and the
   record is flagged `removal_requested`.
3. Admin reviews at `/admin/removal-requests` and either:
   - **Approve — hide record**: record hidden site-wide, identifiers added to
     `suppression_list`;
   - **Approve — hide photo only**: booking photo suppressed, record text
     remains;
   - **Reject**: request closed.
4. The scraper checks `suppression_list` and hidden flags on every run, so
   approved removals are never re-added or re-published.

---

### Package scripts

| Script | Command |
|---|---|
| `npm run dev` | `next dev -H 0.0.0.0 -p 3000` |
| `npm run build` | `next build` |
| `npm run start` | `next start -H 0.0.0.0 -p 3000` |
| `npm run lint` | `next lint` |
| `npm run scrape:broward` | live scrape |
| `npm run scrape:broward:dry-run` | dry-run scrape (no writes) |
