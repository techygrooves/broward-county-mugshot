/**
 * CLI entry point for the Broward Booking Blotter scraper.
 *
 *   npm run scrape:broward                       # live run (writes to DB)
 *   npm run scrape:broward:dry-run               # no writes, prints records
 *   npm run scrape:broward -- --date 2026-07-01  # filter by booking date
 *
 * Exit codes: 0 success/dry-run/no-data, 2 blocked by source, 1 error.
 */
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  // Import after dotenv so env vars are available to the scraper/Supabase.
  const { runScraper } = await import("../src/lib/scraper/index");

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const dateIndex = args.indexOf("--date");
  let date: string | undefined;
  if (dateIndex !== -1) {
    date = args[dateIndex + 1];
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      console.error("Invalid --date value. Use --date YYYY-MM-DD");
      process.exit(1);
    }
  }

  console.log("Broward Booking Blotter scraper");
  console.log(`  mode:   ${dryRun ? "DRY RUN (no database writes)" : "LIVE"}`);
  console.log(`  source: ${process.env.BROWARD_SOURCE_URL || "https://bookingblotter.sheriff.org/app/"}`);
  if (date) console.log(`  date:   ${date}`);
  console.log("");

  const summary = await runScraper({ dryRun, date });

  console.log("");
  console.log("Run summary");
  console.log(`  status:     ${summary.status}`);
  console.log(`  found:      ${summary.recordsFound}`);
  console.log(`  inserted:   ${summary.recordsInserted}`);
  console.log(`  updated:    ${summary.recordsUpdated}`);
  console.log(`  suppressed: ${summary.recordsSuppressed}`);
  if (summary.notes.length) {
    console.log("  notes:");
    for (const note of summary.notes) console.log(`    - ${note}`);
  }
  if (summary.errors.length) {
    console.log("  errors:");
    for (const err of summary.errors) console.log(`    - ${err}`);
  }

  if (summary.status === "blocked") process.exit(2);
  if (summary.status === "error") process.exit(1);
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal scraper error:", e);
  process.exit(1);
});
