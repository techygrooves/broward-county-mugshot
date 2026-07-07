import * as cheerio from "cheerio";
import { createHash } from "crypto";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { Charge, ScraperRunStatus } from "@/lib/types";

/**
 * Authorized importer for a friend site (palmbeachandbrowardmugshots.com).
 *
 * The owner of the target site has given explicit permission to import
 * records. Even so, this adapter behaves like the official scraper:
 *  - It only runs when FRIEND_SITE_ALLOWED === "true" (an explicit
 *    authorization gate the operator sets after confirming permission).
 *  - Honest, identifiable User-Agent (FRIEND_SITE_USER_AGENT).
 *  - Delay between requests (FRIEND_SITE_DELAY_MS) and a hard record cap
 *    (FRIEND_SITE_MAX_RECORDS).
 *  - Stops politely with status "blocked" on 401/403/429/503 or a
 *    CAPTCHA / anti-bot challenge page — no bypassing.
 *  - Dry-run mode writes nothing.
 *  - suppression_list is checked before every insert; hidden records are
 *    never resurrected; dedupe keeps daily runs idempotent.
 *  - Mugshot URLs are stored only when visible in public HTML. Images are
 *    never downloaded, uploaded, or displayed (display is separately gated
 *    by NEXT_PUBLIC_DISPLAY_MUGSHOTS, which stays false).
 *
 * The target site covers both Palm Beach and Broward counties; this project
 * is Broward-only, so records that are clearly Palm Beach are skipped.
 */

export const FRIEND_SOURCE = "palmbeachandbrowardmugshots";

export interface FriendImportOptions {
  dryRun: boolean;
  log?: (line: string) => void;
}

export interface FriendRecord {
  source: string;
  county: string;
  arrest_number: string | null;
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
  official_detail_url: string; // friend-site detail page URL (task 8)
  status: "pending";
  dedup_key: string;
}

export interface FriendImportSummary {
  status: ScraperRunStatus;
  pagesChecked: string[];
  detailUrlsDiscovered: number;
  recordsParsed: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsSkipped: number;
  recordsSuppressed: number;
  mugshotUrlsDetected: number;
  errors: string[];
  notes: string[];
  sample: FriendRecord[];
}

// ------------------------------------------------------------- config

function env(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

function baseUrl(): string {
  return env("FRIEND_SITE_BASE_URL", "https://palmbeachandbrowardmugshots.com").replace(/\/+$/, "");
}

function isAuthorized(): boolean {
  return process.env.FRIEND_SITE_ALLOWED === "true";
}

function delayMs(): number {
  const n = Number(process.env.FRIEND_SITE_DELAY_MS);
  return Number.isFinite(n) && n >= 500 ? n : 3000;
}

function maxRecords(): number {
  const n = Number(process.env.FRIEND_SITE_MAX_RECORDS);
  return Number.isFinite(n) && n > 0 ? n : 100;
}

function userAgent(): string {
  return env(
    "FRIEND_SITE_USER_AGENT",
    "Broward Arrest Resource MVP (authorized importer) - contact@example.com"
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ------------------------------------------------------- polite fetch

const BLOCK_BODY_PATTERNS =
  /captcha|recaptcha|hcaptcha|cf-challenge|challenge-platform|access denied|request unsuccessful|incapsula|imperva|akamai|are you a robot|unusual traffic|cloudflare/i;

type FetchOutcome =
  | { kind: "ok"; body: string }
  | { kind: "blocked"; detail: string }
  | { kind: "error"; detail: string };

async function politeFetch(url: string): Promise<FetchOutcome> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    const res = await fetch(url, {
      headers: {
        "User-Agent": userAgent(),
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if ([401, 403, 429, 503].includes(res.status)) {
      return { kind: "blocked", detail: `HTTP ${res.status} from ${url}` };
    }
    if (!res.ok) {
      return { kind: "error", detail: `HTTP ${res.status} from ${url}` };
    }
    const body = await res.text();
    if (BLOCK_BODY_PATTERNS.test(body.slice(0, 20_000))) {
      return { kind: "blocked", detail: `Anti-bot / CAPTCHA challenge page from ${url}` };
    }
    return { kind: "ok", body };
  } catch (e) {
    return {
      kind: "error",
      detail: `Fetch failed for ${url}: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// -------------------------------------------------------- small utils

function clean(text: string | null | undefined): string | null {
  if (!text) return null;
  const s = text.replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
}

function toDate(value: string | null): string | null {
  const s = clean(value);
  if (!s) return null;
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  const named = s.match(
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/i
  );
  if (named) {
    const d = new Date(`${named[1]} ${named[2]}, ${named[3]}`);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitName(full: string): { first: string | null; middle: string | null; last: string | null } {
  const cleaned = clean(full) ?? "";
  if (cleaned.includes(",")) {
    const [lastPart, rest] = cleaned.split(",");
    const restParts = clean(rest)?.split(/\s+/) ?? [];
    return {
      last: clean(lastPart),
      first: restParts[0] ?? null,
      middle: restParts.slice(1).join(" ") || null,
    };
  }
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: null, middle: null, last: null };
  if (parts.length === 1) return { first: parts[0], middle: null, last: null };
  return {
    first: parts[0],
    last: parts[parts.length - 1],
    middle: parts.slice(1, -1).join(" ") || null,
  };
}

// ---------------------------------------------------- detail parsing

/** Find a value that follows a label like "Booking Date:" using several
 * strategies: definition lists, tables, labelled spans, and a plain-text
 * regex fallback over the visible page text. */
function labelValue($: cheerio.CheerioAPI, pageText: string, labels: string[]): string | null {
  for (const label of labels) {
    // dt/dd, th/td, or "label:" siblings
    let found: string | null = null;
    $("dt, th, .label, strong, b, span").each((_, el) => {
      if (found) return;
      const t = clean($(el).text());
      if (!t) return;
      const normalized = t.replace(/[:\s]+$/, "").toLowerCase();
      if (normalized === label.toLowerCase()) {
        const container = $(el);
        const dd = container.next("dd, td").first();
        const val = clean(dd.text()) || clean(container.parent().find("dd, td").last().text());
        if (val && val.toLowerCase() !== label.toLowerCase()) found = val;
      }
    });
    if (found) return found;

    // plain-text "Label: value" fallback
    const re = new RegExp(
      `${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:#-]?\\s*([^\\n|]{1,120})`,
      "i"
    );
    const m = pageText.match(re);
    if (m) {
      const val = clean(m[1]);
      if (val) return val;
    }
  }
  return null;
}

function parseCharges($: cheerio.CheerioAPI, pageText: string): Charge[] {
  const charges: Charge[] = [];

  // Strategy 1: a heading "Charge(s)" followed by a list.
  $("h1, h2, h3, h4, strong, .label").each((_, el) => {
    if (charges.length > 0) return;
    const heading = clean($(el).text())?.toLowerCase() ?? "";
    if (/^charges?\b/.test(heading)) {
      const list = $(el).nextAll("ul, ol").first();
      list.find("li").each((_, li) => {
        const desc = clean($(li).text());
        if (desc) charges.push({ description: desc });
      });
      if (charges.length === 0) {
        // charges as sibling text lines
        const block = clean($(el).next().text());
        if (block) {
          block
            .split(/;|•|\n/)
            .map((s) => clean(s))
            .filter((s): s is string => Boolean(s))
            .forEach((desc) => charges.push({ description: desc }));
        }
      }
    }
  });
  if (charges.length > 0) return charges;

  // Strategy 2: table rows that mention statute/charge.
  $("table tr").each((_, tr) => {
    const cells = $(tr)
      .find("td")
      .map((_, td) => clean($(td).text()))
      .get()
      .filter(Boolean) as string[];
    if (cells.length >= 1 && /charge|statute|offense|\d{3}\.\d{2}/i.test(cells.join(" "))) {
      const desc = cells[0];
      if (desc && !/^charge|^statute|^offense/i.test(desc)) {
        charges.push({ description: desc, statute: cells[1] ?? null, bond_amount: cells[2] ?? null });
      }
    }
  });
  if (charges.length > 0) return charges;

  // Strategy 3: plain-text "Charges: ..." fallback.
  const m = pageText.match(/charges?\s*[:#-]?\s*([^\n]{3,240})/i);
  if (m) {
    clean(m[1])
      ?.split(/;|•/)
      .map((s) => clean(s))
      .filter((s): s is string => Boolean(s))
      .forEach((desc) => charges.push({ description: desc }));
  }
  return charges;
}

function parseDetail(html: string, url: string): FriendRecord | null {
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header").remove();
  const pageText = clean($("body").text()) ?? "";

  // Name: h1 first, then og:title / <title>.
  let fullName =
    clean($("h1").first().text()) ||
    clean($('meta[property="og:title"]').attr("content")) ||
    clean($("title").text());
  if (fullName) {
    fullName = fullName.replace(/\s*[|\-–].*$/, "").trim(); // strip site suffix
  }
  if (!fullName || fullName.length < 3) return null;

  // JSON-LD Person, if present.
  let sex: string | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).contents().text());
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        if (node && typeof node === "object" && /person/i.test(String(node["@type"]))) {
          if (node.name && !fullName) fullName = clean(String(node.name));
          if (node.gender) sex = clean(String(node.gender));
        }
      }
    } catch {
      /* ignore malformed JSON-LD */
    }
  });

  const county =
    /palm\s*beach/i.test(pageText) && !/broward/i.test(pageText) ? "Palm Beach" : "Broward";

  const { first, middle, last } = splitName(fullName);

  const ageRaw = labelValue($, pageText, ["Age"]);
  const ageMatch = ageRaw?.match(/\d{1,3}/);
  const age = ageMatch ? Number(ageMatch[0]) : null;

  sex = sex || labelValue($, pageText, ["Sex", "Gender"]);
  if (sex) {
    const s = sex.trim().toUpperCase();
    sex = s.startsWith("M") ? "M" : s.startsWith("F") ? "F" : sex;
  }

  const charges = parseCharges($, pageText);
  const chargesText = charges
    .map((c) => [c.description, c.statute].filter(Boolean).join(" "))
    .join("; ");

  const arrestNumber =
    labelValue($, pageText, [
      "Booking Number", "Booking #", "Booking No", "Arrest Number", "Arrest #",
      "Case Number", "Case #", "Jail Number", "Inmate Number", "Booking ID",
    ]) ?? null;

  // Mugshot: og:image, else the most photo-like <img>.
  let mugshot = clean($('meta[property="og:image"]').attr("content"));
  if (!mugshot) {
    $("img").each((_, el) => {
      if (mugshot) return;
      const src = $(el).attr("src") || $(el).attr("data-src");
      if (src && /(mugshot|booking|inmate|photo|upload|arrest)/i.test(src)) {
        mugshot = src;
      }
    });
  }
  if (mugshot) {
    try {
      mugshot = new URL(mugshot, url).toString();
    } catch {
      mugshot = null;
    }
  }

  const bond = labelValue($, pageText, ["Total Bond", "Bond", "Bail", "Bond Amount"]);

  const bookingDate = toDate(labelValue($, pageText, ["Booking Date", "Booked", "Book Date", "Date Booked"]));
  const arrestDate = toDate(labelValue($, pageText, ["Arrest Date", "Date Arrested"]));
  const releaseDate = toDate(labelValue($, pageText, ["Release Date", "Released", "Date Released"]));
  const location = labelValue($, pageText, ["Location", "Arrest Location", "City", "Agency", "Facility"]);

  const firstCharge = charges[0]?.description ?? "";
  const dedupBasis = arrestNumber
    ? `an:${arrestNumber}`
    : `nm:${normalizeName(fullName)}|bd:${bookingDate ?? ""}|ch:${normalizeName(firstCharge)}|u:${url}`;
  const dedupKey = createHash("sha1").update(dedupBasis).digest("hex");

  return {
    source: FRIEND_SOURCE,
    county,
    arrest_number: arrestNumber,
    first_name: first,
    middle_name: middle,
    last_name: last,
    full_name: fullName,
    sex,
    age: Number.isFinite(age) ? age : null,
    booking_date: bookingDate,
    arrest_date: arrestDate,
    release_date: releaseDate,
    location,
    charges_json: charges,
    charges_text: chargesText,
    bond_json: bond ? { total_bond: bond } : null,
    mugshot_url: mugshot ?? null,
    official_detail_url: url,
    status: "pending",
    dedup_key: dedupKey,
  };
}

// -------------------------------------------------------- discovery

const INDEX_PATH_CANDIDATES = [
  "/",
  "/recent-arrests",
  "/recent",
  "/arrests",
  "/broward",
  "/broward-county",
  "/broward-county-arrests",
  "/county/broward",
  "/mugshots",
];

const DETAIL_HREF_PATTERN =
  /\/(mugshots?|arrests?|bookings?|records?|inmates?|person|profile)\/[a-z0-9][a-z0-9\-_/]+/i;

const NON_DETAIL_PATTERN =
  /\/(page|category|tag|author|wp-|feed|search|contact|about|privacy|terms|login|remove)/i;

function collectDetailLinks($: cheerio.CheerioAPI, pageUrl: string, origin: string): string[] {
  const links = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let abs: URL;
    try {
      abs = new URL(href, pageUrl);
    } catch {
      return;
    }
    if (abs.origin !== origin) return;
    if (NON_DETAIL_PATTERN.test(abs.pathname)) return;
    const segments = abs.pathname.split("/").filter(Boolean);
    const looksLikeDetail =
      DETAIL_HREF_PATTERN.test(abs.pathname) ||
      (segments.length >= 1 && /[a-z]+-[a-z]+/i.test(segments[segments.length - 1]));
    if (looksLikeDetail) {
      abs.hash = "";
      links.add(abs.toString());
    }
  });
  return Array.from(links);
}

// -------------------------------------------------- suppression/upsert

async function isSuppressed(record: FriendRecord): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const filters: string[] = [];
  if (record.arrest_number) filters.push(`arrest_number.eq.${record.arrest_number}`);
  if (record.full_name && !record.full_name.includes(",")) {
    filters.push(`full_name.ilike.${record.full_name}`);
  }
  if (filters.length === 0) return false;
  const { data } = await supabase
    .from("suppression_list")
    .select("id")
    .or(filters.join(","))
    .limit(1);
  return Boolean(data && data.length > 0);
}

/** Idempotent upsert. Dedupe by (source, arrest_number); when the friend
 * site provides no arrest number we synthesize a stable one from the dedup
 * key so the existing unique(source, arrest_number) index enforces
 * idempotency (task 10). */
async function upsertRecord(
  record: FriendRecord
): Promise<"inserted" | "updated" | "suppressed" | "skipped"> {
  const supabase = getSupabase();
  if (!supabase) return "skipped";
  if (await isSuppressed(record)) return "suppressed";

  const arrestNumber = record.arrest_number ?? `PBBM-${record.dedup_key.slice(0, 16)}`;

  const { data: existing } = await supabase
    .from("arrests")
    .select("id, is_hidden, mugshot_hidden")
    .eq("source", FRIEND_SOURCE)
    .eq("arrest_number", arrestNumber)
    .maybeSingle();

  const row = {
    source: FRIEND_SOURCE,
    county: record.county,
    arrest_number: arrestNumber,
    first_name: record.first_name,
    middle_name: record.middle_name,
    last_name: record.last_name,
    full_name: record.full_name,
    sex: record.sex,
    age: record.age,
    booking_date: record.booking_date,
    arrest_date: record.arrest_date,
    release_date: record.release_date,
    location: record.location,
    charges_json: record.charges_json,
    charges_text: record.charges_text,
    bond_json: record.bond_json,
    // Store the friend-site detail page URL in the existing column (task 8).
    official_detail_url: record.official_detail_url,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    if (existing.is_hidden) return "suppressed";
    const { error } = await supabase
      .from("arrests")
      .update({
        ...row,
        mugshot_url: existing.mugshot_hidden ? null : record.mugshot_url,
      })
      .eq("id", existing.id);
    if (error) throw new Error(`Update failed for ${arrestNumber}: ${error.message}`);
    return "updated";
  }

  const { error } = await supabase.from("arrests").insert({
    ...row,
    mugshot_url: record.mugshot_url,
    status: "pending", // held for admin review, like manual import
  });
  if (error) throw new Error(`Insert failed for ${arrestNumber}: ${error.message}`);
  return "inserted";
}

// ------------------------------------------------------------- runner

export async function runFriendSiteImport(
  options: FriendImportOptions
): Promise<FriendImportSummary> {
  const log = options.log ?? ((line: string) => console.log(line));
  const supabase = getSupabase();
  const summary: FriendImportSummary = {
    status: "running",
    pagesChecked: [],
    detailUrlsDiscovered: 0,
    recordsParsed: 0,
    recordsInserted: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    recordsSuppressed: 0,
    mugshotUrlsDetected: 0,
    errors: [],
    notes: [],
    sample: [],
  };

  // Authorization gate — this importer only runs against a site whose owner
  // has granted permission, recorded via FRIEND_SITE_ALLOWED=true.
  if (!isAuthorized()) {
    summary.status = "blocked";
    summary.notes.push(
      "FRIEND_SITE_ALLOWED is not 'true'. This authorized importer will not contact the friend site until you confirm permission by setting FRIEND_SITE_ALLOWED=true in .env.local (see .env.example)."
    );
    log(summary.notes[summary.notes.length - 1]);
    return summary;
  }

  let runId: string | null = null;
  if (!options.dryRun && supabase) {
    const { data } = await supabase
      .from("scraper_runs")
      .insert({ source: FRIEND_SOURCE, status: "running" })
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
          records_found: summary.recordsParsed,
          records_inserted: summary.recordsInserted,
          records_updated: summary.recordsUpdated,
          errors_json: summary.errors.length ? summary.errors : null,
        })
        .eq("id", runId);
    }
    return summary;
  };

  const origin = new URL(baseUrl()).origin;
  const detailUrls = new Set<string>();
  let blockedDetail: string | null = null;

  // 1. Crawl candidate index pages, collecting detail links.
  for (const path of INDEX_PATH_CANDIDATES) {
    if (detailUrls.size >= maxRecords()) break;
    const url = new URL(path, baseUrl()).toString();
    await sleep(delayMs());
    log(`Checking index page: ${url}`);
    const res = await politeFetch(url);
    if (res.kind === "blocked") {
      blockedDetail = res.detail;
      summary.pagesChecked.push(`${url} [blocked]`);
      break;
    }
    if (res.kind === "error") {
      // 404s on guessed paths are expected; note and continue.
      summary.pagesChecked.push(`${url} [${res.detail.includes("404") ? "not found" : "error"}]`);
      continue;
    }
    summary.pagesChecked.push(`${url} [ok]`);
    const $ = cheerio.load(res.body);
    const found = collectDetailLinks($, url, origin);
    found.forEach((u) => detailUrls.add(u));
    log(`  found ${found.length} candidate detail link(s)`);
  }

  summary.detailUrlsDiscovered = detailUrls.size;

  if (blockedDetail && detailUrls.size === 0) {
    summary.errors.push(blockedDetail);
    log("");
    log("BLOCKED: the friend site refused automated access. No bypass attempted.");
    log(`Detail: ${blockedDetail}`);
    return await finish("blocked");
  }

  // 2. Fetch and parse detail pages (bounded by the record cap).
  const records: FriendRecord[] = [];
  for (const url of Array.from(detailUrls).slice(0, maxRecords())) {
    await sleep(delayMs());
    const res = await politeFetch(url);
    if (res.kind === "blocked") {
      summary.errors.push(res.detail);
      log(`BLOCKED at ${url} — stopping detail fetches, no bypass attempted.`);
      break;
    }
    if (res.kind === "error") {
      summary.errors.push(res.detail);
      continue;
    }
    const parsed = parseDetail(res.body, url);
    if (!parsed) {
      summary.recordsSkipped++;
      continue;
    }
    if (parsed.county !== "Broward") {
      summary.recordsSkipped++;
      log(`  skip (not Broward): ${parsed.full_name} — ${url}`);
      continue;
    }
    records.push(parsed);
    if (parsed.mugshot_url) summary.mugshotUrlsDetected++;
  }

  summary.recordsParsed = records.length;
  summary.sample = records.slice(0, 25);

  if (records.length === 0) {
    log("No Broward records parsed from the friend site on this run.");
    return await finish(blockedDetail ? "blocked" : "no_data");
  }

  // 3a. Dry-run: print, write nothing.
  if (options.dryRun) {
    log("");
    log(`DRY RUN — ${records.length} record(s) would be processed. Nothing was written.`);
    for (const r of summary.sample) {
      log(
        `  • ${r.arrest_number ?? "(no arrest#)"} | ${r.full_name} | booked ${r.booking_date ?? "?"} | ${r.charges_text || "no charges parsed"} | mugshot:${r.mugshot_url ? "detected(not shown)" : "none"} | ${r.official_detail_url}`
      );
    }
    if (records.length > summary.sample.length) {
      log(`  … and ${records.length - summary.sample.length} more`);
    }
    return await finish("dry_run");
  }

  // 3b. Live import.
  if (!isSupabaseConfigured()) {
    summary.errors.push("Supabase is not configured; cannot write records. Use --dry-run or set env vars.");
    return await finish("error");
  }
  for (const record of records) {
    try {
      const result = await upsertRecord(record);
      if (result === "inserted") summary.recordsInserted++;
      else if (result === "updated") summary.recordsUpdated++;
      else if (result === "suppressed") summary.recordsSuppressed++;
      else summary.recordsSkipped++;
    } catch (e) {
      summary.errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  log(
    `Done: parsed ${summary.recordsParsed}, inserted ${summary.recordsInserted}, updated ${summary.recordsUpdated}, suppressed ${summary.recordsSuppressed}, skipped ${summary.recordsSkipped}, errors ${summary.errors.length}`
  );
  return await finish(summary.errors.length > 0 ? "partial" : "success");
}
