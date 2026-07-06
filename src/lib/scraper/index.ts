import * as cheerio from "cheerio";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { Charge, ScraperRunStatus } from "@/lib/types";

/**
 * Polite scraper for the official Broward Sheriff's Office Booking Blotter
 * (https://bookingblotter.sheriff.org/app/).
 *
 * Design rules (see README "Legal & compliance notes"):
 *  - Official BSO sources only. No third-party mugshot sites.
 *  - Honest User-Agent with contact info, delays between requests,
 *    hard record cap, daily schedule only.
 *  - No CAPTCHA solving, no header spoofing, no blocking countermeasures.
 *    If the source responds with 401/403/429/challenge pages, the run stops
 *    with status "blocked" and the operator is pointed at the manual
 *    /admin/import fallback.
 *  - Records approved for removal are never re-published: the suppression
 *    list is checked before every insert, and hidden records are never
 *    overwritten back to visible.
 */

export interface ScrapeOptions {
  dryRun: boolean;
  date?: string; // YYYY-MM-DD filter on booking date
  log?: (line: string) => void;
}

export interface ScrapeSummary {
  status: ScraperRunStatus;
  recordsFound: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsSuppressed: number;
  errors: string[];
  notes: string[];
}

export interface NormalizedArrest {
  arrest_number: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  full_name: string;
  sex: string | null;
  age: number | null;
  booking_date: string | null;
  arrest_date: string | null;
  release_date: string | null;
  location: string | null;
  charges_json: Charge[];
  charges_text: string;
  bond_json: { total_bond?: string | null } | null;
  mugshot_url: string | null;
  official_detail_url: string;
}

const SOURCE = "bso-booking-blotter";

function env(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

function delayMs(): number {
  const n = Number(process.env.SCRAPER_DELAY_MS);
  return Number.isFinite(n) && n >= 500 ? n : 2500;
}

function maxRecords(): number {
  const n = Number(process.env.SCRAPER_MAX_RECORDS);
  return Number.isFinite(n) && n > 0 ? n : 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const BLOCK_BODY_PATTERNS =
  /captcha|recaptcha|hcaptcha|cf-challenge|challenge-platform|access denied|request unsuccessful|incapsula|imperva|akamai|are you a robot|unusual traffic/i;

type FetchOutcome =
  | { kind: "ok"; body: string; contentType: string }
  | { kind: "blocked"; detail: string }
  | { kind: "error"; detail: string };

async function politeFetch(url: string, accept: string): Promise<FetchOutcome> {
  const userAgent = env(
    "SCRAPER_USER_AGENT",
    "Broward Arrest Resource MVP - contact@example.com"
  );
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    const res = await fetch(url, {
      headers: { "User-Agent": userAgent, Accept: accept },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if ([401, 403, 405, 407, 429, 503].includes(res.status)) {
      return { kind: "blocked", detail: `HTTP ${res.status} from ${url}` };
    }
    if (!res.ok) {
      return { kind: "error", detail: `HTTP ${res.status} from ${url}` };
    }
    const body = await res.text();
    if (BLOCK_BODY_PATTERNS.test(body.slice(0, 20_000))) {
      return {
        kind: "blocked",
        detail: `Response from ${url} looks like a CAPTCHA/anti-bot challenge page`,
      };
    }
    return { kind: "ok", body, contentType: res.headers.get("content-type") ?? "" };
  } catch (e) {
    return {
      kind: "error",
      detail: `Fetch failed for ${url}: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ------------------------------------------------------- normalization

function pick(obj: Record<string, unknown>, names: string[]): unknown {
  const lookup = new Map(
    Object.keys(obj).map((k) => [k.toLowerCase().replace(/[^a-z0-9]/g, ""), k])
  );
  for (const name of names) {
    const key = lookup.get(name.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (key !== undefined) {
      const value = obj[key];
      if (value !== null && value !== undefined && value !== "") return value;
    }
  }
  return undefined;
}

function asString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function asDate(v: unknown): string | null {
  const s = asString(v);
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function extractCharges(raw: unknown): Charge[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item): Charge | null => {
        if (typeof item === "string") return { description: item };
        if (item && typeof item === "object") {
          const o = item as Record<string, unknown>;
          const description = asString(
            pick(o, ["description", "charge", "chargedescription", "offense", "offensedescription"])
          );
          if (!description) return null;
          return {
            description,
            statute: asString(pick(o, ["statute", "statutenumber", "florida statute", "code"])),
            bond_amount: asString(pick(o, ["bond", "bondamount", "bail", "bailamount"])),
            court_case: asString(pick(o, ["courtcase", "casenumber", "case"])),
          };
        }
        return null;
      })
      .filter((c): c is Charge => c !== null);
  }
  const s = asString(raw);
  if (!s) return [];
  return s
    .split(/;|\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((description) => ({ description }));
}

/** Map a raw object from a JSON endpoint into our schema, or null if it
 * doesn't look like a booking record. */
export function normalizeRawRecord(
  raw: Record<string, unknown>,
  sourceUrl: string
): NormalizedArrest | null {
  const arrestNumber = asString(
    pick(raw, [
      "arrestnumber", "arrestno", "bookingnumber", "bookingno", "jailnumber",
      "inmatenumber", "casenumber", "id", "objectid",
    ])
  );
  const lastName = asString(pick(raw, ["lastname", "lname", "namelast"]));
  const firstName = asString(pick(raw, ["firstname", "fname", "namefirst"]));
  let fullName = asString(pick(raw, ["fullname", "name", "inmatename", "defendantname"]));
  if (!fullName && (firstName || lastName)) {
    fullName = [firstName, lastName].filter(Boolean).join(" ");
  }
  if (!fullName && !arrestNumber) return null;

  const bookingDate = asDate(
    pick(raw, ["bookingdate", "bookeddate", "datebooked", "bookingdatetime", "intakedate"])
  );
  // A record needs at least a name and either an identifier or a date to be
  // useful; otherwise treat it as noise from an unrelated endpoint.
  if (!fullName || (!arrestNumber && !bookingDate)) return null;

  let first = firstName;
  let middle = asString(pick(raw, ["middlename", "mname", "namemiddle"]));
  let last = lastName;
  if (!first && !last && fullName) {
    // "LAST, FIRST MIDDLE" is the common official format
    const comma = fullName.split(",");
    if (comma.length === 2) {
      last = comma[0].trim();
      const rest = comma[1].trim().split(/\s+/);
      first = rest[0] ?? null;
      middle = rest.slice(1).join(" ") || null;
      fullName = [first, middle, last].filter(Boolean).join(" ");
    } else {
      const parts = fullName.trim().split(/\s+/);
      first = parts[0] ?? null;
      last = parts.length > 1 ? parts[parts.length - 1] : null;
      middle = parts.slice(1, -1).join(" ") || null;
    }
  }

  const charges = extractCharges(
    pick(raw, ["charges", "chargelist", "charge", "offenses", "chargedescription"])
  );
  const chargesText = charges
    .map((c) => [c.description, c.statute].filter(Boolean).join(" "))
    .join("; ");

  const ageRaw = pick(raw, ["age", "ageatbooking"]);
  const age = ageRaw !== undefined && !Number.isNaN(Number(ageRaw)) ? Number(ageRaw) : null;

  const detailUrl = asString(pick(raw, ["detailurl", "url", "link", "officialurl"]));

  return {
    arrest_number: arrestNumber ?? `${SOURCE}-${bookingDate}-${fullName}`.replace(/\s+/g, "-"),
    first_name: first,
    middle_name: middle,
    last_name: last,
    full_name: fullName,
    sex: asString(pick(raw, ["sex", "gender"])),
    age,
    booking_date: bookingDate,
    arrest_date: asDate(pick(raw, ["arrestdate", "datearrested", "arrestdatetime"])),
    release_date: asDate(pick(raw, ["releasedate", "datereleased"])),
    location: asString(pick(raw, ["location", "city", "arrestlocation", "address", "facility"])),
    charges_json: charges,
    charges_text: chargesText,
    bond_json: (() => {
      const bond = asString(pick(raw, ["bond", "totalbond", "bondamount", "bail"]));
      return bond ? { total_bond: bond } : null;
    })(),
    mugshot_url: asString(pick(raw, ["mugshot", "mugshoturl", "photo", "photourl", "image", "imageurl"])),
    official_detail_url: detailUrl ?? sourceUrl,
  };
}

// -------------------------------------------------- endpoint discovery

function findJsonArrayOfObjects(parsed: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(parsed)) {
    const objects = parsed.filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null && !Array.isArray(item)
    );
    return objects.length > 0 ? objects : null;
  }
  if (parsed && typeof parsed === "object") {
    for (const value of Object.values(parsed as Record<string, unknown>)) {
      const found = findJsonArrayOfObjects(value);
      if (found) return found;
    }
  }
  return null;
}

interface DiscoveryResult {
  records: NormalizedArrest[];
  notes: string[];
  blocked: string | null;
  errors: string[];
}

/**
 * Load the Booking Blotter app shell, look for JSON API endpoints referenced
 * by its scripts, and try them politely. Falls back to parsing any HTML
 * tables found in the page itself.
 */
async function discoverAndFetch(log: (s: string) => void): Promise<DiscoveryResult> {
  const sourceUrl = env("BROWARD_SOURCE_URL", "https://bookingblotter.sheriff.org/app/");
  const notes: string[] = [];
  const errors: string[] = [];

  log(`Fetching official source: ${sourceUrl}`);
  const page = await politeFetch(sourceUrl, "text/html,application/xhtml+xml");
  if (page.kind === "blocked") return { records: [], notes, blocked: page.detail, errors };
  if (page.kind === "error") {
    errors.push(page.detail);
    return { records: [], notes, blocked: null, errors };
  }

  const origin = new URL(sourceUrl).origin;
  const $ = cheerio.load(page.body);

  // 1. Collect candidate API endpoints from inline scripts and bundles.
  const candidates = new Set<string>();
  const urlPattern = /["'`]((?:https?:\/\/[^"'`\s]+|\/[a-zA-Z0-9_\-./]+)(?:api|API|json|Booking|booking|Arrest|arrest|blotter|Blotter)[a-zA-Z0-9_\-./?=&%]*)["'`]/g;

  const scanText = (text: string) => {
    for (const match of text.matchAll(urlPattern)) {
      try {
        const abs = new URL(match[1], origin);
        if (abs.origin.endsWith("sheriff.org")) candidates.add(abs.toString());
      } catch {
        /* ignore malformed URLs */
      }
    }
  };
  scanText(page.body);

  const scriptSrcs = $("script[src]")
    .map((_, el) => $(el).attr("src"))
    .get()
    .filter((src): src is string => Boolean(src))
    .slice(0, 4);
  for (const src of scriptSrcs) {
    await sleep(delayMs());
    try {
      const abs = new URL(src, sourceUrl).toString();
      if (!new URL(abs).origin.endsWith("sheriff.org")) continue;
      log(`Scanning app bundle for API endpoints: ${abs}`);
      const bundle = await politeFetch(abs, "*/*");
      if (bundle.kind === "blocked") {
        return { records: [], notes, blocked: bundle.detail, errors };
      }
      if (bundle.kind === "ok") scanText(bundle.body);
    } catch {
      /* skip malformed script src */
    }
  }

  notes.push(`Endpoint candidates discovered: ${candidates.size}`);

  // 2. Try candidate endpoints as JSON.
  for (const candidate of Array.from(candidates).slice(0, 6)) {
    await sleep(delayMs());
    log(`Trying candidate endpoint: ${candidate}`);
    const res = await politeFetch(candidate, "application/json");
    if (res.kind === "blocked") {
      return { records: [], notes, blocked: res.detail, errors };
    }
    if (res.kind !== "ok") {
      errors.push(res.detail);
      continue;
    }
    try {
      const parsed = JSON.parse(res.body);
      const rawRecords = findJsonArrayOfObjects(parsed);
      if (!rawRecords) continue;
      const normalized = rawRecords
        .map((raw) => normalizeRawRecord(raw, candidate))
        .filter((r): r is NormalizedArrest => r !== null);
      if (normalized.length > 0) {
        notes.push(`JSON endpoint worked: ${candidate} (${normalized.length} records)`);
        return { records: normalized, notes, blocked: null, errors };
      }
    } catch {
      /* not JSON — skip */
    }
  }

  // 3. Fall back to HTML table parsing on the app page itself.
  const tableRecords: NormalizedArrest[] = [];
  $("table").each((_, table) => {
    const headers = $(table)
      .find("th")
      .map((_, th) => $(th).text().trim().toLowerCase())
      .get();
    if (headers.length === 0) return;
    $(table)
      .find("tbody tr, tr")
      .each((_, tr) => {
        const cells = $(tr)
          .find("td")
          .map((_, td) => $(td).text().trim())
          .get();
        if (cells.length === 0 || cells.length !== headers.length) return;
        const raw: Record<string, unknown> = {};
        headers.forEach((h, i) => (raw[h] = cells[i]));
        const normalized = normalizeRawRecord(raw, sourceUrl);
        if (normalized) tableRecords.push(normalized);
      });
  });
  if (tableRecords.length > 0) {
    notes.push(`Parsed ${tableRecords.length} records from public HTML tables`);
    return { records: tableRecords, notes, blocked: null, errors };
  }

  notes.push(
    "No accessible JSON endpoint or HTML data found. The Booking Blotter appears to be a JavaScript app whose data endpoints are not openly reachable from this client. Use the manual import fallback (/admin/import)."
  );
  return { records: [], notes, blocked: null, errors };
}

// -------------------------------------------------------------- upsert

async function isSuppressed(record: NormalizedArrest): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const filters = [`arrest_number.eq.${record.arrest_number}`];
  if (record.full_name && !record.full_name.includes(",")) {
    filters.push(`full_name.ilike.${record.full_name}`);
  }
  const { data } = await supabase
    .from("suppression_list")
    .select("id")
    .or(filters.join(","))
    .limit(1);
  return Boolean(data && data.length > 0);
}

async function upsertRecord(
  record: NormalizedArrest
): Promise<"inserted" | "updated" | "suppressed" | "skipped"> {
  const supabase = getSupabase();
  if (!supabase) return "skipped";

  if (await isSuppressed(record)) return "suppressed";

  const { data: existing } = await supabase
    .from("arrests")
    .select("id, is_hidden, mugshot_hidden")
    .eq("source", SOURCE)
    .eq("arrest_number", record.arrest_number)
    .maybeSingle();

  if (existing) {
    // Never resurrect a hidden record or re-attach a removed mugshot.
    if (existing.is_hidden) return "suppressed";
    const { error } = await supabase
      .from("arrests")
      .update({
        ...record,
        mugshot_url: existing.mugshot_hidden ? null : record.mugshot_url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw new Error(`Update failed for ${record.arrest_number}: ${error.message}`);
    return "updated";
  }

  const { error } = await supabase.from("arrests").insert({
    ...record,
    source: SOURCE,
    county: "Broward",
    status: "published",
  });
  if (error) throw new Error(`Insert failed for ${record.arrest_number}: ${error.message}`);
  return "inserted";
}

// ----------------------------------------------------------- run logic

export async function runScraper(options: ScrapeOptions): Promise<ScrapeSummary> {
  const log = options.log ?? ((line: string) => console.log(line));
  const supabase = getSupabase();
  const summary: ScrapeSummary = {
    status: "running",
    recordsFound: 0,
    recordsInserted: 0,
    recordsUpdated: 0,
    recordsSuppressed: 0,
    errors: [],
    notes: [],
  };

  let runId: string | null = null;
  if (!options.dryRun && supabase) {
    const { data } = await supabase
      .from("scraper_runs")
      .insert({ source: SOURCE, status: "running" })
      .select("id")
      .single();
    runId = data?.id ?? null;
  }

  const finish = async (status: ScraperRunStatus) => {
    summary.status = status;
    if (runId && supabase) {
      await supabase
        .from("scraper_runs")
        .update({
          completed_at: new Date().toISOString(),
          status,
          records_found: summary.recordsFound,
          records_inserted: summary.recordsInserted,
          records_updated: summary.recordsUpdated,
          errors_json: summary.errors.length ? summary.errors : null,
        })
        .eq("id", runId);
    }
    return summary;
  };

  try {
    const discovery = await discoverAndFetch(log);
    summary.notes.push(...discovery.notes);
    summary.errors.push(...discovery.errors);

    if (discovery.blocked) {
      summary.errors.push(discovery.blocked);
      log("");
      log("BLOCKED: the official source is refusing automated access.");
      log(`Detail: ${discovery.blocked}`);
      log(
        "Per project policy, no bypass is attempted. Use the manual fallback: /admin/import (CSV upload or manual record entry)."
      );
      return await finish("blocked");
    }

    let records = discovery.records;
    if (options.date) {
      records = records.filter((r) => r.booking_date === options.date);
      summary.notes.push(`Filtered to booking date ${options.date}: ${records.length} records`);
    }
    records = records.slice(0, maxRecords());
    summary.recordsFound = records.length;

    if (records.length === 0) {
      log("No records retrieved from the official source on this run.");
      return await finish("no_data");
    }

    if (options.dryRun) {
      log(`DRY RUN — ${records.length} records would be processed. Nothing was written.`);
      for (const record of records.slice(0, 25)) {
        log(
          `  • ${record.arrest_number} | ${record.full_name} | booked ${record.booking_date ?? "?"} | ${record.charges_text || "no charges parsed"}`
        );
      }
      if (records.length > 25) log(`  … and ${records.length - 25} more`);
      return await finish("dry_run");
    }

    if (!isSupabaseConfigured()) {
      summary.errors.push("Supabase is not configured; cannot write records. Run with --dry-run or set env vars.");
      return await finish("error");
    }

    for (const record of records) {
      try {
        const result = await upsertRecord(record);
        if (result === "inserted") summary.recordsInserted++;
        else if (result === "updated") summary.recordsUpdated++;
        else if (result === "suppressed") summary.recordsSuppressed++;
      } catch (e) {
        summary.errors.push(e instanceof Error ? e.message : String(e));
      }
    }

    log(
      `Done: found ${summary.recordsFound}, inserted ${summary.recordsInserted}, updated ${summary.recordsUpdated}, suppressed ${summary.recordsSuppressed}, errors ${summary.errors.length}`
    );
    return await finish(summary.errors.length > 0 ? "partial" : "success");
  } catch (e) {
    summary.errors.push(e instanceof Error ? e.message : String(e));
    log(`Scraper run failed: ${summary.errors[summary.errors.length - 1]}`);
    return await finish("error");
  }
}
