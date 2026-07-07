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
  console.log("Import summary");
  console.log(`  status:              ${summary.status}`);
  console.log(`  pages checked:       ${summary.pagesChecked.length}`);
  summary.pagesChecked.forEach((p) => console.log(`      - ${p}`));
  console.log(`  detail URLs found:   ${summary.detailUrlsDiscovered}`);
  console.log(`  records parsed:      ${summary.recordsParsed}`);
  console.log(`  records inserted:    ${summary.recordsInserted}`);
  console.log(`  records updated:     ${summary.recordsUpdated}`);
  console.log(`  records skipped:     ${summary.recordsSkipped}`);
  console.log(`  records suppressed:  ${summary.recordsSuppressed}`);
  console.log(`  mugshot URLs found:  ${summary.mugshotUrlsDetected} (stored only; never downloaded or displayed)`);
  if (summary.notes.length) {
    console.log("  notes:");
    summary.notes.forEach((n) => console.log(`      - ${n}`));
  }
  if (summary.errors.length) {
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
