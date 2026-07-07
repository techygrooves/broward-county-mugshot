/**
 * CLI entry point for the authorized friend-site importer
 * (palmbeachandbrowardmugshots.com — used with the owner's permission).
 *
 *   npm run import:friend-site:dry-run             # no writes, prints records
 *   npm run import:friend-site:dry-run -- --debug  # + per-page diagnostics
 *   npm run import:friend-site                     # live import into Supabase
 *
 * Requires FRIEND_SITE_ALLOWED=true (authorization gate). Exit codes:
 * 0 success/dry-run/no-data, 2 blocked/unauthorized, 1 error.
 */
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

import type { FriendRecord, PageDebug } from "../src/lib/importers/friend-site";

function printSample(label: string, records: FriendRecord[]) {
  console.log(`  ${label} (${records.length}):`);
  if (records.length === 0) {
    console.log("      (none available)");
    return;
  }
  for (const r of records) {
    const date = r.booking_date || r.arrest_date || "unknown date";
    console.log(`      • ${r.full_name} | ${r.county} (${r.county_source}) | ${date} (${r.date_source ?? "no date source"})`);
    console.log(`        charges: ${r.charges_text || `(none — ${r.charges_note ?? "charges_not_parsed"})`}`);
    console.log(`        mugshot_url: ${r.mugshot_url ? `${r.mugshot_url} (stored only)` : "none detected"}`);
    console.log(`        official_detail_url: ${r.official_detail_url}`);
  }
}

function printDebug(pages: PageDebug[]) {
  console.log("");
  console.log(`=== DEBUG: ${pages.length} page(s) with a name but missing date ===`);
  pages.forEach((p, i) => {
    console.log("");
    console.log(`  [${i + 1}] ${p.url}`);
    console.log(`      title:  ${p.title ?? "(none)"}`);
    console.log(`      h1:     ${p.h1 ?? "(none)"}`);
    console.log(`      name:   ${p.name ?? "(none)"}`);
    console.log(`      county: ${p.county}`);
    console.log(`      date-like matches: ${p.dateMatches.length ? p.dateMatches.join(" | ") : "(none found)"}`);
    console.log(`      image candidates:  ${p.imageCandidates.length ? p.imageCandidates.join(" | ") : "(none found)"}`);
    console.log(`      rejected because:  ${p.reason}`);
    console.log(`      content preview (500 chars):`);
    console.log(`        ${p.contentPreview.replace(/\n/g, " ")}`);
  });
}

async function main() {
  const { runFriendSiteImport } = await import("../src/lib/importers/friend-site");

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const debug = args.includes("--debug");

  console.log("Friend-site importer (authorized) — palmbeachandbrowardmugshots");
  console.log(`  mode:       ${dryRun ? "DRY RUN (no database writes)" : "LIVE"}${debug ? " + DEBUG" : ""}`);
  console.log(`  base URL:   ${process.env.FRIEND_SITE_BASE_URL || "https://palmbeachandbrowardmugshots.com"}`);
  console.log(`  authorized: ${process.env.FRIEND_SITE_ALLOWED === "true" ? "yes (FRIEND_SITE_ALLOWED=true)" : "NO — set FRIEND_SITE_ALLOWED=true"}`);
  console.log("");

  const summary = await runFriendSiteImport({ dryRun, debug });

  if (debug && summary.debugPages.length > 0) printDebug(summary.debugPages);

  console.log("");
  console.log("=== Import summary ===");
  console.log(`  status:                 ${summary.status}`);
  console.log(`  detail URLs discovered: ${summary.detailUrlsDiscovered}`);
  console.log(`  detail pages fetched:   ${summary.detailPagesFetched}`);
  console.log(`  names found:            ${summary.namesFound}`);
  console.log(`  dates found:            ${summary.datesFound}`);
  console.log(`  valid records:          ${summary.validRecords}`);
  console.log("");
  console.log("  Records by county (valid):");
  console.log(`      Broward:      ${summary.countyBreakdown.Broward}`);
  console.log(`      Palm Beach:   ${summary.countyBreakdown["Palm Beach"]}`);
  console.log(`      Unknown:      ${summary.countyBreakdown.Unknown}`);
  console.log("");
  console.log("  Broward charge parsing:");
  console.log(`      with parsed charges:    ${summary.browardWithCharges}`);
  console.log(`      without parsed charges: ${summary.browardWithoutCharges} (kept valid, charges_not_parsed)`);
  console.log("");
  console.log(`  clean mugshot URLs (after filtering): ${summary.mugshotUrlsDetected}`);
  console.log(`  generic images skipped:               ${summary.genericImagesSkipped}`);
  console.log("");
  console.log("  Skip reasons:");
  for (const [reason, count] of Object.entries(summary.skipReasons)) {
    console.log(`      ${reason}: ${count}`);
  }
  console.log("");
  console.log("  Live-import preview (both Broward and Palm Beach eligible):");
  console.log(`      eligible records:   ${summary.eligibleForLiveImport}`);
  console.log(`      would insert:       ${summary.wouldInsert}`);
  console.log(`      would update:       ${summary.wouldUpdate}`);
  console.log(`      records inserted:   ${summary.recordsInserted}`);
  console.log(`      records updated:    ${summary.recordsUpdated}`);
  console.log(`      records suppressed: ${summary.recordsSuppressed}`);
  console.log(`      records skipped:    ${summary.recordsSkipped}`);
  console.log("");
  console.log("  Sample records:");
  printSample("Broward samples", summary.sampleBroward);
  printSample("Palm Beach samples", summary.samplePalmBeach);

  if (summary.skippedPages.length > 0) {
    console.log("");
    console.log(`  skipped source pages (non-fatal): ${summary.skippedPages.length}`);
    summary.skippedPages.forEach((p) => console.log(`      - [${p.reason}] ${p.url}`));
  }
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
