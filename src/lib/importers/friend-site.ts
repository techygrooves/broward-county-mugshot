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
 * The target site covers both Palm Beach and Broward counties. The importer
 * parses and reports both, but by default only Broward records are eligible
 * for a live write (this project is Broward-focused); Palm Beach and
 * Unknown-county records are reported for review and skipped on live import.
 */

export const FRIEND_SOURCE = "palmbeachandbrowardmugshots";

export type County = "Broward" | "Palm Beach" | "Unknown";

export interface FriendImportOptions {
  dryRun: boolean;
  log?: (line: string) => void;
}

export interface FriendRecord {
  source: string;
  county: County;
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
  official_detail_url: string; // friend-site detail page URL (stored in official_detail_url)
  status: "pending";
  dedup_key: string;
}

export interface SkippedPage {
  url: string;
  reason: string;
}

/** Structured skip-reason taxonomy (task 9). */
export const SKIP_REASONS = [
  "404 page",
  "non-detail page",
  "missing name",
  "missing date",
  "duplicate",
  "suppressed",
  "unknown county",
  "palm beach (not eligible for live import)",
] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];

export interface FriendImportSummary {
  status: ScraperRunStatus;
  indexPagesChecked: { url: string; status: string }[];
  skippedPages: SkippedPage[];
  detailUrlsDiscovered: number;
  detailPagesFetched: number;
  recordsParsed: number; // detail pages that yielded a named record
  validRecords: number; // parsed records that also have a date
  countyBreakdown: Record<County, number>;
  skipReasons: Record<SkipReason, number>;
  recordsInserted: number;
  recordsUpdated: number;
  recordsSuppressed: number;
  recordsSkipped: number;
  eligibleForLiveImport: number; // valid Broward records
  mugshotUrlsDetected: number;
  errors: string[];
  notes: string[];
  sampleBroward: FriendRecord[];
  samplePalmBeach: FriendRecord[];
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

/** Cap on index/category pages crawled for link discovery. */
const MAX_INDEX_PAGES = 30;

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
  /captcha|recaptcha|hcaptcha|cf-challenge|challenge-platform|access denied|request unsuccessful|incapsula|imperva|akamai|are you a robot|unusual traffic|attention required/i;

type FetchOutcome =
  | { kind: "ok"; body: string }
  | { kind: "notfound"; detail: string }
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
    if (res.status === 404 || res.status === 410) {
      return { kind: "notfound", detail: `HTTP ${res.status} from ${url}` };
    }
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

// ------------------------------------------------- county detection

// Broward and Palm Beach cities/agencies. County is decided ONLY from
// record-specific signals (explicit county field, arresting agency,
// city/location, detail-page path) — never from whole-page text, because
// the site's branding ("Palm Beach and Broward") appears on every page.
const BROWARD_SIGNALS =
  /\bbroward\b|\bbso\b|fort lauderdale|ft lauderdale|hollywood|pompano|coral springs|miramar|pembroke pines|sunrise|plantation|davie|deerfield|lauderhill|tamarac|weston|margate|coconut creek|oakland park|dania|hallandale|cooper city|parkland|wilton manors|lauderdale lakes|north lauderdale|coral gables/i;

const PALM_BEACH_SIGNALS =
  /palm beach|\bpbso\b|\bpbc\b|west palm|boca raton|boynton|delray|jupiter|wellington|lake worth|riviera beach|royal palm|greenacres|belle glade|lantana|palm springs|loxahatchee|juno beach/i;

function detectCounty(signalText: string): County {
  const text = signalText.toLowerCase();
  const broward = BROWARD_SIGNALS.test(text);
  const palmBeach = PALM_BEACH_SIGNALS.test(text);
  if (broward && !palmBeach) return "Broward";
  if (palmBeach && !broward) return "Palm Beach";
  return "Unknown";
}

// ---------------------------------------------------- detail parsing

function labelValue($: cheerio.CheerioAPI, pageText: string, labels: string[]): string | null {
  for (const label of labels) {
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

interface ParseResult {
  record: FriendRecord | null;
  reason: SkipReason | null;
}

function parseDetail(html: string, url: string): ParseResult {
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header").remove();
  const pageText = clean($("body").text()) ?? "";

  let fullName =
    clean($("h1").first().text()) ||
    clean($('meta[property="og:title"]').attr("content")) ||
    clean($("title").text());
  if (fullName) {
    fullName = fullName.replace(/\s*[|\-–].*$/, "").trim();
  }
  // A detail page for a person has a short name-like H1. Reject listing /
  // category pages (long titles, "arrests", "mugshots").
  if (!fullName || fullName.length < 3) return { record: null, reason: "missing name" };
  if (/arrest|mugshot|booking|recent|category|results?/i.test(fullName) || fullName.split(/\s+/).length > 6) {
    return { record: null, reason: "non-detail page" };
  }

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
  const countyLabel = labelValue($, pageText, ["County"]);
  const agency = labelValue($, pageText, ["Arresting Agency", "Arrested By", "Agency", "Booking Agency"]);

  const county = detectCounty(
    [countyLabel, agency, location, new URL(url).pathname].filter(Boolean).join(" ")
  );

  const firstCharge = charges[0]?.description ?? "";
  const dedupBasis = arrestNumber
    ? `an:${arrestNumber}`
    : `nm:${normalizeName(fullName)}|bd:${bookingDate ?? ""}|ch:${normalizeName(firstCharge)}|u:${url}`;
  const dedupKey = createHash("sha1").update(dedupBasis).digest("hex");

  return {
    record: {
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
    },
    reason: null,
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

// Category / index slugs (listing pages, not individual bookings).
const CATEGORY_SLUG_PATTERN =
  /(arrests?|mugshots?|bookings?|records?|category|recent|county|charges?)$|-arrests?\b|-mugshots?\b/i;

const NON_DETAIL_PATTERN =
  /\/(page|category|tag|author|wp-|feed|search|contact|about|privacy|terms|login|remove|sitemap)/i;

interface ClassifiedLinks {
  detail: string[];
  category: string[];
}

function collectLinks($: cheerio.CheerioAPI, pageUrl: string, origin: string): ClassifiedLinks {
  const detail = new Set<string>();
  const category = new Set<string>();
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
    abs.hash = "";
    if (NON_DETAIL_PATTERN.test(abs.pathname)) return;
    const segments = abs.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return;
    const slug = segments[segments.length - 1];
    if (CATEGORY_SLUG_PATTERN.test(slug)) {
      category.add(abs.toString());
    } else if (/[a-z]+-[a-z]+/i.test(slug)) {
      // person-like slug (e.g. john-smith) — treat as a booking detail page
      detail.add(abs.toString());
    }
  });
  return { detail: Array.from(detail), category: Array.from(category) };
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
    // Store the friend-site detail page URL in the existing column.
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
    indexPagesChecked: [],
    skippedPages: [],
    detailUrlsDiscovered: 0,
    detailPagesFetched: 0,
    recordsParsed: 0,
    validRecords: 0,
    countyBreakdown: { Broward: 0, "Palm Beach": 0, Unknown: 0 },
    skipReasons: Object.fromEntries(SKIP_REASONS.map((r) => [r, 0])) as Record<SkipReason, number>,
    recordsInserted: 0,
    recordsUpdated: 0,
    recordsSuppressed: 0,
    recordsSkipped: 0,
    eligibleForLiveImport: 0,
    mugshotUrlsDetected: 0,
    errors: [],
    notes: [],
    sampleBroward: [],
    samplePalmBeach: [],
  };

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
          records_found: summary.validRecords,
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
  const crawledIndex = new Set<string>();
  const indexQueue: string[] = INDEX_PATH_CANDIDATES.map((p) => new URL(p, baseUrl()).toString());
  let blocked = false;

  // --- Phase 1: crawl index/category pages, collecting detail links.
  while (indexQueue.length > 0 && crawledIndex.size < MAX_INDEX_PAGES) {
    const url = indexQueue.shift() as string;
    if (crawledIndex.has(url)) continue;
    crawledIndex.add(url);
    if (detailUrls.size >= maxRecords()) break;

    await sleep(delayMs());
    log(`Checking source page: ${url}`);
    const res = await politeFetch(url);

    if (res.kind === "blocked") {
      summary.indexPagesChecked.push({ url, status: "blocked" });
      blocked = true;
      break;
    }
    if (res.kind === "notfound") {
      // 404 category/index page — non-fatal skipped source page (task 1/2).
      summary.indexPagesChecked.push({ url, status: "404 (skipped)" });
      summary.skippedPages.push({ url, reason: "404 page" });
      summary.skipReasons["404 page"]++;
      continue;
    }
    if (res.kind === "error") {
      summary.indexPagesChecked.push({ url, status: "error" });
      summary.errors.push(res.detail);
      continue;
    }

    summary.indexPagesChecked.push({ url, status: "ok" });
    const { detail, category } = collectLinks(cheerio.load(res.body), url, origin);
    detail.forEach((u) => detailUrls.add(u));
    for (const c of category) {
      if (!crawledIndex.has(c) && crawledIndex.size + indexQueue.length < MAX_INDEX_PAGES) {
        indexQueue.push(c);
      }
    }
    log(`  found ${detail.length} detail link(s), ${category.length} category link(s)`);
  }

  summary.detailUrlsDiscovered = detailUrls.size;

  if (blocked && detailUrls.size === 0) {
    summary.errors.push("Friend site refused automated access (blocked). No bypass attempted.");
    log("BLOCKED: the friend site refused automated access. No bypass attempted.");
    return await finish("blocked");
  }

  // --- Phase 2: fetch and parse detail pages (bounded by the record cap).
  const seen = new Set<string>();
  const records: FriendRecord[] = [];

  for (const url of Array.from(detailUrls).slice(0, maxRecords())) {
    await sleep(delayMs());
    const res = await politeFetch(url);
    summary.detailPagesFetched++;

    if (res.kind === "blocked") {
      summary.errors.push(res.detail);
      log(`BLOCKED at ${url} — stopping detail fetches, no bypass attempted.`);
      blocked = true;
      break;
    }
    if (res.kind === "notfound") {
      summary.skippedPages.push({ url, reason: "404 page" });
      summary.skipReasons["404 page"]++;
      continue;
    }
    if (res.kind === "error") {
      summary.errors.push(res.detail);
      continue;
    }

    const { record, reason } = parseDetail(res.body, url);
    if (!record) {
      if (reason) summary.skipReasons[reason]++;
      continue;
    }
    summary.recordsParsed++;

    // Validity gate: an individual arrest record needs a date.
    if (!record.booking_date && !record.arrest_date) {
      summary.skipReasons["missing date"]++;
      continue;
    }
    // In-run dedup.
    if (seen.has(record.dedup_key)) {
      summary.skipReasons["duplicate"]++;
      continue;
    }
    seen.add(record.dedup_key);

    summary.validRecords++;
    summary.countyBreakdown[record.county]++;
    if (record.mugshot_url) summary.mugshotUrlsDetected++;
    records.push(record);
  }

  summary.sampleBroward = records.filter((r) => r.county === "Broward").slice(0, 5);
  summary.samplePalmBeach = records.filter((r) => r.county === "Palm Beach").slice(0, 5);
  summary.eligibleForLiveImport = summary.countyBreakdown.Broward;

  if (records.length === 0) {
    log("No valid records parsed from the friend site on this run.");
    return await finish(blocked ? "blocked" : "no_data");
  }

  // --- Phase 3a: dry-run prints, writes nothing.
  if (options.dryRun) {
    log("");
    log(`DRY RUN — ${records.length} valid record(s). Nothing was written to the database.`);
    log(
      `County breakdown → Broward: ${summary.countyBreakdown.Broward}, Palm Beach: ${summary.countyBreakdown["Palm Beach"]}, Unknown: ${summary.countyBreakdown.Unknown}`
    );
    return await finish("dry_run");
  }

  // --- Phase 3b: live import (Broward-only by default).
  if (!isSupabaseConfigured()) {
    summary.errors.push("Supabase is not configured; cannot write records. Use --dry-run or set env vars.");
    return await finish("error");
  }
  for (const record of records) {
    if (record.county === "Palm Beach") {
      summary.skipReasons["palm beach (not eligible for live import)"]++;
      summary.recordsSkipped++;
      continue;
    }
    if (record.county === "Unknown") {
      summary.skipReasons["unknown county"]++;
      summary.recordsSkipped++;
      continue;
    }
    try {
      const result = await upsertRecord(record);
      if (result === "inserted") summary.recordsInserted++;
      else if (result === "updated") summary.recordsUpdated++;
      else if (result === "suppressed") {
        summary.recordsSuppressed++;
        summary.skipReasons["suppressed"]++;
      } else summary.recordsSkipped++;
    } catch (e) {
      summary.errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  log(
    `Done: valid ${summary.validRecords}, inserted ${summary.recordsInserted}, updated ${summary.recordsUpdated}, suppressed ${summary.recordsSuppressed}, skipped ${summary.recordsSkipped}, errors ${summary.errors.length}`
  );
  return await finish(summary.errors.length > 0 ? "partial" : "success");
}
