/**
 * CLI entry point for the authorized friend-site importer
 * (palmbeachandbrowardmugshots.com — used with the owner's permission).
 *
 *   npm run import:friend-site:dry-run   # no writes, prints records
 *   npm run import:friend-site           # live import into Supabase
 *
 * Requires FRIEND_SITE_ALLOWED=true (authorization gate). Exit codes:
 * 0 success/dry-run/no-data, 2 blocked/unauthorized, 1 error.
 */
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

import type { FriendRecord } from "../src/lib/importers/friend-site";

function printSample(label: string, records: FriendRecord[]) {
  console.log(`  ${label} (${records.length}):`);
  if (records.length === 0) {
    console.log("      (none available)");
    return;
  }
  for (const r of records) {
    const date = r.booking_date || r.arrest_date || "unknown date";
    const charges = r.charges_text || "no charges parsed";
    console.log(`      • ${r.full_name} | ${r.county} | ${date}`);
    console.log(`        charges: ${charges}`);
    console.log(`        mugshot_url: ${r.mugshot_url ? `${r.mugshot_url} (stored only, not downloaded/displayed)` : "none detected"}`);
    console.log(`        official_detail_url: ${r.official_detail_url}`);
  }
}

async function main() {
  const { runFriendSiteImport } = await import("../src/lib/importers/friend-site");

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  console.log("Friend-site importer (authorized) — palmbeachandbrowardmugshots");
  console.log(`  mode:       ${dryRun ? "DRY RUN (no database writes)" : "LIVE"}`);
  console.log(`  base URL:   ${process.env.FRIEND_SITE_BASE_URL || "https://palmbeachandbrowardmugshots.com"}`);
  console.log(`  authorized: ${process.env.FRIEND_SITE_ALLOWED === "true" ? "yes (FRIEND_SITE_ALLOWED=true)" : "NO — set FRIEND_SITE_ALLOWED=true"}`);
  console.log("");

  const summary = await runFriendSiteImport({ dryRun });

  console.log("");
  console.log("=== Import summary ===");
  console.log(`  status:                 ${summary.status}`);
  console.log("");
  console.log(`  source pages checked:   ${summary.indexPagesChecked.length}`);
  summary.indexPagesChecked.forEach((p) => console.log(`      - [${p.status}] ${p.url}`));

  if (summary.skippedPages.length > 0) {
    console.log("");
    console.log(`  skipped source pages (non-fatal): ${summary.skippedPages.length}`);
    summary.skippedPages.forEach((p) => console.log(`      - [${p.reason}] ${p.url}`));
  }

  console.log("");
  console.log(`  detail URLs discovered: ${summary.detailUrlsDiscovered}`);
  console.log(`  detail pages fetched:   ${summary.detailPagesFetched}`);
  console.log(`  records parsed (named): ${summary.recordsParsed}`);
  console.log(`  valid records (name+date): ${summary.validRecords}`);
  console.log("");
  console.log("  County breakdown (valid records):");
  console.log(`      Broward:      ${summary.countyBreakdown.Broward}`);
  console.log(`      Palm Beach:   ${summary.countyBreakdown["Palm Beach"]}`);
  console.log(`      Unknown:      ${summary.countyBreakdown.Unknown}`);
  console.log("");
  console.log("  Skip reasons:");
  for (const [reason, count] of Object.entries(summary.skipReasons)) {
    console.log(`      ${reason}: ${count}`);
  }
  console.log("");
  console.log(`  mugshot URLs detected:  ${summary.mugshotUrlsDetected} (stored only; never downloaded, uploaded, or displayed)`);
  console.log("");
  console.log("  Live-import outcome:");
  console.log(`      eligible for live import (Broward): ${summary.eligibleForLiveImport}`);
  console.log(`      records inserted:   ${summary.recordsInserted}`);
  console.log(`      records updated:    ${summary.recordsUpdated}`);
  console.log(`      records suppressed: ${summary.recordsSuppressed}`);
  console.log(`      records skipped:    ${summary.recordsSkipped}`);

  console.log("");
  console.log("  Sample records:");
  printSample("Broward samples", summary.sampleBroward);
  printSample("Palm Beach samples", summary.samplePalmBeach);

  if (summary.notes.length) {
    console.log("");
    console.log("  notes:");
    summary.notes.forEach((n) => console.log(`      - ${n}`));
  }
  if (summary.errors.length) {
    console.log("");
    console.log("  errors:");
    summary.errors.forEach((e) => console.log(`      - ${e}`));
  }

  if (summary.status === "blocked") process.exit(2);
  if (summary.status === "error") process.exit(1);
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal importer error:", e);
  process.exit(1);
});
