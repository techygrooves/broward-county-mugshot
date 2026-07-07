import * as cheerio from "cheerio";
import { createHash } from "crypto";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { Charge, ScraperRunStatus } from "@/lib/types";

/**
 * Authorized importer for a friend site (palmbeachandbrowardmugshots.com),
 * used with the site owner's explicit permission.
 *
 * The target is a WordPress site: booking records are posts, dates come
 * from post/published metadata when not labelled, photos are WordPress
 * featured images (wp-content/uploads), and county is signalled by the
 * category / breadcrumb / index page a post is discovered under.
 *
 * Safety model (unchanged): authorization gate (FRIEND_SITE_ALLOWED),
 * honest UA, delay, hard cap, stop-on-block with no bypass or proxies,
 * dry-run writes nothing, suppression checked before writes, mugshot URLs
 * stored only (never downloaded, uploaded, or displayed).
 *
 * Both Broward and Palm Beach records are parsed and eligible for import.
 */

export const FRIEND_SOURCE = "palmbeachandbrowardmugshots";

export type County = "Broward" | "Palm Beach" | "Unknown";

export interface FriendImportOptions {
  dryRun: boolean;
  debug?: boolean;
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
  official_detail_url: string;
  status: "pending";
  date_source: string | null;
  county_source: string | null;
  dedup_key: string;
}

export interface SkippedPage {
  url: string;
  reason: string;
}

export interface PageDebug {
  url: string;
  title: string | null;
  h1: string | null;
  name: string | null;
  county: County;
  dateMatches: string[];
  contentPreview: string;
  imageCandidates: string[];
  reason: string;
}

export const SKIP_REASONS = [
  "404 page",
  "non-detail page",
  "missing name",
  "missing date",
  "duplicate",
  "suppressed",
  "unknown county",
] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];

export interface FriendImportSummary {
  status: ScraperRunStatus;
  indexPagesChecked: { url: string; status: string }[];
  skippedPages: SkippedPage[];
  detailUrlsDiscovered: number;
  detailPagesFetched: number;
  namesFound: number;
  datesFound: number;
  validRecords: number;
  countyBreakdown: Record<County, number>;
  skipReasons: Record<SkipReason, number>;
  mugshotUrlsDetected: number;
  genericImagesSkipped: number;
  wouldInsert: number;
  wouldUpdate: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsSuppressed: number;
  recordsSkipped: number;
  eligibleForLiveImport: number;
  errors: string[];
  notes: string[];
  sampleBroward: FriendRecord[];
  samplePalmBeach: FriendRecord[];
  debugPages: PageDebug[];
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
const MAX_INDEX_PAGES = 30;
function userAgent(): string {
  return env("FRIEND_SITE_USER_AGENT", "Broward Arrest Resource MVP (authorized importer) - contact@example.com");
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
      headers: { "User-Agent": userAgent(), Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.status === 404 || res.status === 410) return { kind: "notfound", detail: `HTTP ${res.status} from ${url}` };
    if ([401, 403, 429, 503].includes(res.status)) return { kind: "blocked", detail: `HTTP ${res.status} from ${url}` };
    if (!res.ok) return { kind: "error", detail: `HTTP ${res.status} from ${url}` };
    const body = await res.text();
    if (BLOCK_BODY_PATTERNS.test(body.slice(0, 20_000))) {
      return { kind: "blocked", detail: `Anti-bot / CAPTCHA challenge page from ${url}` };
    }
    return { kind: "ok", body };
  } catch (e) {
    return { kind: "error", detail: `Fetch failed for ${url}: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// -------------------------------------------------------- small utils

function clean(text: string | null | undefined): string | null {
  if (!text) return null;
  const s = text.replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function toDate(value: string | null): string | null {
  const s = clean(value);
  if (!s) return null;
  const iso = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const numeric = s.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (numeric) {
    const mm = numeric[1].padStart(2, "0");
    const dd = numeric[2].padStart(2, "0");
    let yyyy = numeric[3];
    if (yyyy.length === 2) yyyy = `20${yyyy}`;
    if (Number(mm) >= 1 && Number(mm) <= 12 && Number(dd) >= 1 && Number(dd) <= 31) return `${yyyy}-${mm}-${dd}`;
  }
  const named = s.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/i);
  if (named) {
    const mm = MONTHS[named[1].slice(0, 3).toLowerCase()];
    const dd = named[2].padStart(2, "0");
    if (mm) return `${named[3]}-${mm}-${dd}`;
  }
  return null;
}

function findDateLikeStrings(text: string): string[] {
  const out = new Set<string>();
  const patterns = [
    /\b\d{4}-\d{2}-\d{2}\b/g,
    /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b/gi,
  ];
  for (const re of patterns) for (const m of text.matchAll(re)) out.add(m[0]);
  return Array.from(out).slice(0, 12);
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function splitName(full: string): { first: string | null; middle: string | null; last: string | null } {
  const cleaned = clean(full) ?? "";
  if (cleaned.includes(",")) {
    const [lastPart, rest] = cleaned.split(",");
    const restParts = clean(rest)?.split(/\s+/) ?? [];
    return { last: clean(lastPart), first: restParts[0] ?? null, middle: restParts.slice(1).join(" ") || null };
  }
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: null, middle: null, last: null };
  if (parts.length === 1) return { first: parts[0], middle: null, last: null };
  return { first: parts[0], last: parts[parts.length - 1], middle: parts.slice(1, -1).join(" ") || null };
}

// ------------------------------------------------- county detection

const BROWARD_SIGNALS =
  /\bbroward\b|\bbso\b|fort lauderdale|ft lauderdale|hollywood|pompano|coral springs|miramar|pembroke pines|sunrise|plantation|davie|deerfield|lauderhill|tamarac|weston|margate|coconut creek|oakland park|dania|hallandale|cooper city|parkland|wilton manors|lauderdale lakes|north lauderdale/i;

const PALM_BEACH_SIGNALS =
  /palm beach|\bpbso\b|\bpbc\b|west palm|boca raton|boynton|delray|jupiter|wellington|lake worth|riviera beach|royal palm|greenacres|belle glade|lantana|palm springs|loxahatchee|juno beach/i;

/** County hint from an index/detail URL path (task 1). */
function pathCountyHint(path: string): County {
  const p = path.toLowerCase();
  if (/palm[-_ ]?beach/.test(p)) return "Palm Beach";
  if (/broward/.test(p)) return "Broward";
  return "Unknown";
}

function classifyCounty(signals: { text: string; weight: number }[]): County {
  let broward = 0;
  let palm = 0;
  for (const { text, weight } of signals) {
    if (!text) continue;
    if (BROWARD_SIGNALS.test(text)) broward += weight;
    if (PALM_BEACH_SIGNALS.test(text)) palm += weight;
  }
  if (broward > palm) return "Broward";
  if (palm > broward) return "Palm Beach";
  return "Unknown";
}

// ---------------------------------------------------- content cleanup

// Selectors for non-content chrome removed before extracting charges/text.
const CHROME_SELECTORS =
  "script, style, nav, footer, header, aside, form, .widget, .widgets, .widget-area, #secondary, .sidebar, .site-footer, .site-header, .footer, .menu, .nav-menu, .navigation, .main-navigation, .breadcrumb, .breadcrumbs, .cat-links, .post-categories, .sharedaddy, .jp-relatedposts, .related-posts, .comments-area, .entry-footer";

// Boilerplate / navigation phrases that must never be treated as charges.
const CHARGE_BOILERPLATE =
  /browse arrests by charge|palm beach and broward mugshots|report a tip|public safety resources|meet the publisher|recent (posts|arrests)|related|leave a (comment|reply)|share this|categories|read more|continue reading|newsletter|subscribe|advertisement|all rights reserved|©|view all|see more|home\b|contact/i;

const CHARGE_KEYWORDS =
  /possess|batter|assault|dui|driving|theft|burglar|traffic|robbery|fraud|forgery|resist|domestic|weapon|firearm|drug|cocaine|cannabis|marijuana|trespass|homicide|murder|violation|probation|contempt|disorderly|solicit|larceny|grand|petit|controlled|paraphernalia|dwls|battery|stalking|kidnap|fleeing|eluding|obstruct/i;

// "DUI Arrests", "Battery Arrests", etc. — charge-category menu labels.
const CATEGORY_LABEL = /^(.*)\barrests?$/i;

function isValidCharge(line: string): boolean {
  const s = line.trim();
  if (s.length < 4 || s.length > 200) return false;
  if (CHARGE_BOILERPLATE.test(s)) return false;
  if (/^\W+$/.test(s)) return false;
  if (CATEGORY_LABEL.test(s) && s.split(/\s+/).length <= 4) return false; // "DUI Arrests"
  const hasStatute = /\d{3}\.\d{2,3}/.test(s) || /\bf\.?\s?s\.?\b/i.test(s);
  const hasKeyword = CHARGE_KEYWORDS.test(s);
  return hasStatute || hasKeyword || s.split(/\s+/).length >= 3;
}

// ---------------------------------------------------- image handling

const GENERIC_IMAGE =
  /cropped-image|cropped-|logo|banner|header|favicon|site-icon|placeholder|avatar|gravatar|spinner|loading|default|blank|sprite|wp-emoji|icon[-_.]/i;

interface GatheredImages {
  kept: string[]; // ordered, best first
  genericCount: number;
}

function gatherImages($: cheerio.CheerioAPI, $content: cheerio.Cheerio<never>, url: string): GatheredImages {
  const scored: { url: string; priority: number }[] = [];
  const push = (raw: string | undefined | null, priority: number) => {
    if (!raw) return;
    const first = raw.split(",")[0].trim().split(/\s+/)[0];
    if (!first) return;
    try {
      scored.push({ url: new URL(first, url).toString(), priority });
    } catch {
      /* ignore */
    }
  };

  // Featured / content images (nearest to the record) rank highest.
  $content.find("img").each((_, el) => {
    const isFeatured = /wp-post-image|attachment-|size-/i.test($(el).attr("class") ?? "");
    push($(el).attr("src"), isFeatured ? 1 : 3);
    push($(el).attr("data-src"), isFeatured ? 1 : 3);
    push($(el).attr("data-lazy-src"), isFeatured ? 1 : 3);
    push($(el).attr("srcset") || $(el).attr("data-srcset"), 4);
  });
  $("img.wp-post-image, .post-thumbnail img, figure.wp-block-post-featured-image img, .featured-image img").each((_, el) => {
    push($(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src"), 1);
  });
  // Social meta (usually the featured image on WP posts).
  push($('meta[property="og:image"]').attr("content"), 2);
  push($('meta[name="twitter:image"]').attr("content"), 2);
  $content.find("[style*='background-image']").each((_, el) => {
    const m = ($(el).attr("style") ?? "").match(/background-image\s*:\s*url\(['"]?([^'")]+)['"]?\)/i);
    if (m) push(m[1], 5);
  });

  const seen = new Set<string>();
  const kept: { url: string; priority: number }[] = [];
  let genericCount = 0;
  for (const c of scored) {
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    if (/\.svg(\?|$)/i.test(c.url) || GENERIC_IMAGE.test(c.url)) {
      genericCount++;
      continue;
    }
    // Prefer things that look like uploaded photos.
    const isPhoto = /wp-content\/uploads/i.test(c.url) || /\.(jpe?g|png|webp)(\?|$)/i.test(c.url);
    kept.push({ url: c.url, priority: isPhoto ? c.priority : c.priority + 5 });
  }
  kept.sort((a, b) => a.priority - b.priority);
  return { kept: kept.map((k) => k.url), genericCount };
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
    const re = new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:#-]?\\s*([^\\n|]{1,120})`, "i");
    const m = pageText.match(re);
    if (m) {
      const val = clean(m[1]);
      if (val) return val;
    }
  }
  return null;
}

function parseCharges($: cheerio.CheerioAPI, $content: cheerio.Cheerio<never>, contentText: string): Charge[] {
  const raw: string[] = [];

  // 1. A "Charges" heading inside content → following list or block.
  $content.find("h1, h2, h3, h4, strong").each((_, el) => {
    if (raw.length > 0) return;
    const heading = clean($(el).text())?.toLowerCase() ?? "";
    if (/^charges?\b/.test(heading)) {
      const list = $(el).nextAll("ul, ol").first();
      list.find("li").each((_, li) => {
        const d = clean($(li).text());
        if (d) raw.push(d);
      });
      if (raw.length === 0) {
        clean($(el).next().text())
          ?.split(/;|•|\n/)
          .map((s) => clean(s))
          .filter((s): s is string => Boolean(s))
          .forEach((d) => raw.push(d));
      }
    }
  });

  // 2. Labelled "Charges: a; b; c".
  if (raw.length === 0) {
    const val = labelValue($, contentText, ["Charges", "Charge", "Offense", "Offenses"]);
    val
      ?.split(/;|•/)
      .map((s) => clean(s))
      .filter((s): s is string => Boolean(s))
      .forEach((d) => raw.push(d));
  }

  // 3. Lines in content that carry a statute pattern.
  if (raw.length === 0) {
    for (const line of contentText.split(/[;\n]/)) {
      if (/\d{3}\.\d{2,3}/.test(line)) {
        const d = clean(line);
        if (d) raw.push(d);
      }
    }
  }

  const seen = new Set<string>();
  const charges: Charge[] = [];
  for (const line of raw) {
    if (!isValidCharge(line)) continue;
    const key = normalizeName(line);
    if (seen.has(key)) continue;
    seen.add(key);
    const statute = line.match(/\d{3}\.\d{2,3}[a-z0-9().]*/i)?.[0] ?? null;
    charges.push({ description: line, statute });
    if (charges.length >= 15) break;
  }
  return charges;
}

const NON_RECORD_SLUG =
  /report-a-tip|public-safety-resources|meet-the-publisher|about|contact|privacy|terms|disclaimer|advertise|publisher|resources|story|news|category|tag|author|page|home/i;

const NON_RECORD_TITLE =
  /report a tip|public safety resources|meet the publisher|about us|contact|privacy|terms|disclaimer|advertise|resources|home page|archive/i;

interface ParseResult {
  record: FriendRecord | null;
  reason: SkipReason | null;
  debug: PageDebug;
}

function parseDetail(html: string, url: string, countyHint: County): ParseResult {
  const $ = cheerio.load(html);
  const title = clean($("title").text());
  const h1 = clean($("h1").first().text());

  // Metadata captured before stripping scripts/chrome.
  const metaPublished =
    clean($('meta[property="article:published_time"]').attr("content")) ||
    clean($('meta[property="og:updated_time"]').attr("content")) ||
    clean($('meta[itemprop="datePublished"]').attr("content")) ||
    clean($("time[datetime]").first().attr("datetime")) ||
    clean($("time.entry-date, time.published").first().text());

  const breadcrumbText = $(".breadcrumb, .breadcrumbs, [class*='breadcrumb'], .cat-links a, .post-categories a, a[rel~='category']")
    .map((_, el) => $(el).text())
    .get()
    .join(" ");

  let sex: string | null = null;
  let jsonLdName: string | null = null;
  let jsonLdPublished: string | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).contents().text());
      const nodes = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const type = String(node["@type"] ?? "").toLowerCase();
        if (type.includes("person")) {
          if (node.name) jsonLdName = clean(String(node.name));
          if (node.gender) sex = clean(String(node.gender));
        }
        if ((node.datePublished || node.dateCreated) && !jsonLdPublished) {
          jsonLdPublished = clean(String(node.datePublished ?? node.dateCreated));
        }
      }
    } catch {
      /* ignore */
    }
  });

  let fullName = h1 || clean($('meta[property="og:title"]').attr("content")) || jsonLdName || title;
  if (fullName) fullName = fullName.replace(/\s*[|\-–—].*$/, "").trim();
  if (fullName) fullName = fullName.replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/, "").trim();

  const slug = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";

  // Strip chrome, then work within the post content only.
  $(CHROME_SELECTORS).remove();
  const $content = ($(".entry-content").first().length
    ? $(".entry-content").first()
    : $("article").first().length
      ? $("article").first()
      : $("main").first().length
        ? $("main").first()
        : $("body")) as unknown as cheerio.Cheerio<never>;
  const contentText = clean($content.text()) ?? "";

  const debugBase: PageDebug = {
    url,
    title,
    h1,
    name: fullName,
    county: "Unknown",
    dateMatches: findDateLikeStrings(`${title ?? ""} ${contentText}`),
    contentPreview: contentText.slice(0, 500),
    imageCandidates: [],
    reason: "",
  };

  if (!fullName || fullName.length < 3) {
    return { record: null, reason: "missing name", debug: { ...debugBase, reason: "missing name" } };
  }
  // Non-record pages (task 2): resource/news/about pages, or an over-long
  // "name" that is really a headline.
  if (NON_RECORD_SLUG.test(slug) || (title && NON_RECORD_TITLE.test(title)) || fullName.split(/\s+/).length > 5) {
    return { record: null, reason: "non-detail page", debug: { ...debugBase, reason: "non-detail page (resource/news/about)" } };
  }

  const { first, middle, last } = splitName(fullName);
  const ageMatch = labelValue($, contentText, ["Age"])?.match(/\d{1,3}/);
  const age = ageMatch ? Number(ageMatch[0]) : null;

  sex = sex || labelValue($, contentText, ["Sex", "Gender"]);
  if (sex) {
    const s = sex.trim().toUpperCase();
    sex = s.startsWith("M") ? "M" : s.startsWith("F") ? "F" : sex;
  }

  const charges = parseCharges($, $content, contentText);
  const chargesText = charges.map((c) => [c.description, c.statute].filter(Boolean).join(" ")).join("; ");
  const arrestNumber =
    labelValue($, contentText, [
      "Booking Number", "Booking #", "Booking No", "Arrest Number", "Arrest #",
      "Case Number", "Case #", "Jail Number", "Inmate Number", "Booking ID",
    ]) ?? null;

  // Task 2: require arrest/booking-style content, not just a name.
  const hasArrestSignal =
    charges.length > 0 ||
    Boolean(arrestNumber) ||
    age !== null ||
    /\b(charge|charges|booking|booked|arrest|bond|bail|jail|custody|inmate|mugshot)\b/i.test(contentText.slice(0, 4000));
  if (!hasArrestSignal) {
    return { record: null, reason: "non-detail page", debug: { ...debugBase, reason: "non-detail page (no arrest/booking content)" } };
  }

  // Dates.
  const bookingLabeled = toDate(labelValue($, contentText, ["Booking Date", "Booked", "Book Date", "Date Booked"]));
  const arrestLabeled = toDate(labelValue($, contentText, ["Arrest Date", "Date Arrested", "Arrested On"]));
  const releaseLabeled = toDate(labelValue($, contentText, ["Release Date", "Released", "Date Released"]));
  const titleDate = toDate(title);
  const wpPublished = toDate(metaPublished) || toDate(jsonLdPublished);
  const bodyDate = toDate(findDateLikeStrings(contentText)[0] ?? null);

  let bookingDate: string | null = null;
  let dateSource: string | null = null;
  if (bookingLabeled) [bookingDate, dateSource] = [bookingLabeled, "booking_label"];
  else if (arrestLabeled) [bookingDate, dateSource] = [arrestLabeled, "arrest_label"];
  else if (wpPublished) [bookingDate, dateSource] = [wpPublished, "imported_from_friend_site_date"];
  else if (titleDate) [bookingDate, dateSource] = [titleDate, "imported_from_friend_site_date"];
  else if (bodyDate) [bookingDate, dateSource] = [bodyDate, "imported_from_friend_site_date"];

  // County: detail-specific signals first, else the index-page hint (task 1).
  const countyLabel = labelValue($, contentText, ["County"]);
  const agency = labelValue($, contentText, ["Arresting Agency", "Arrested By", "Agency", "Booking Agency"]);
  const location = labelValue($, contentText, ["Location", "Arrest Location", "City", "Facility"]);
  const detailCounty = classifyCounty([
    { text: countyLabel ?? "", weight: 100 },
    { text: breadcrumbText, weight: 25 },
    { text: new URL(url).pathname.replace(/-/g, " "), weight: 20 },
    { text: title ?? "", weight: 12 },
    { text: [agency, location].filter(Boolean).join(" "), weight: 10 },
    { text: contentText, weight: 2 },
  ]);
  let county: County;
  let countySource: string;
  if (detailCounty !== "Unknown") {
    county = detailCounty;
    countySource = "detail_page";
  } else if (countyHint !== "Unknown") {
    county = countyHint;
    countySource = "index_page_hint";
  } else {
    county = "Unknown";
    countySource = "undetermined";
  }

  const { kept: imageKept, genericCount } = gatherImages($, $content, url);
  const mugshot = imageKept[0] ?? null;
  const bond = labelValue($, contentText, ["Total Bond", "Bond", "Bail", "Bond Amount"]);

  const firstCharge = charges[0]?.description ?? "";
  const dedupBasis = arrestNumber
    ? `an:${arrestNumber}`
    : `nm:${normalizeName(fullName)}|bd:${bookingDate ?? ""}|ch:${normalizeName(firstCharge)}|u:${url}`;
  const dedupKey = createHash("sha1").update(dedupBasis).digest("hex");

  const record: FriendRecord = {
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
    arrest_date: arrestLabeled,
    release_date: releaseLabeled,
    location,
    charges_json: charges,
    charges_text: chargesText,
    bond_json: bond ? { total_bond: bond } : null,
    mugshot_url: mugshot,
    official_detail_url: url,
    status: "pending",
    date_source: dateSource,
    county_source: countySource,
    dedup_key: dedupKey,
  };

  const debug: PageDebug = {
    ...debugBase,
    name: fullName,
    county,
    imageCandidates: imageKept.slice(0, 8),
    reason: bookingDate ? "ok" : "missing date",
  };
  // Carry the per-page generic-image count via a private field for the runner.
  (record as FriendRecord & { _genericImages?: number })._genericImages = genericCount;
  return { record, reason: null, debug };
}

// -------------------------------------------------------- discovery

const INDEX_PATH_CANDIDATES = [
  "/",
  "/broward",
  "/broward-county",
  "/broward-county-arrests",
  "/broward-county-mugshots",
  "/county/broward",
  "/palm-beach",
  "/palm-beach-county",
  "/palm-beach-county-arrests",
  "/palm-beach-county-mugshots",
  "/recent-arrests",
];

const CATEGORY_SLUG_PATTERN =
  /(arrests?|mugshots?|bookings?|records?|category|recent|county|charges?)$|-arrests?\b|-mugshots?\b|broward|palm-beach/i;

const NON_DETAIL_PATTERN =
  /\/(page|category|tag|author|wp-|feed|search|contact|about|privacy|terms|login|remove|sitemap|report-a-tip|resources|publisher)/i;

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
    if (CATEGORY_SLUG_PATTERN.test(slug)) category.add(abs.toString());
    else if (/[a-z]+-[a-z]+/i.test(slug)) detail.add(abs.toString());
  });
  return { detail: Array.from(detail), category: Array.from(category) };
}

// -------------------------------------------------- suppression/upsert

async function isSuppressed(record: FriendRecord): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const filters: string[] = [];
  if (record.arrest_number) filters.push(`arrest_number.eq.${record.arrest_number}`);
  if (record.full_name && !record.full_name.includes(",")) filters.push(`full_name.ilike.${record.full_name}`);
  if (filters.length === 0) return false;
  const { data } = await supabase.from("suppression_list").select("id").or(filters.join(",")).limit(1);
  return Boolean(data && data.length > 0);
}
function synthArrestNumber(record: FriendRecord): string {
  return record.arrest_number ?? `PBBM-${record.dedup_key.slice(0, 16)}`;
}
async function findExisting(record: FriendRecord) {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from("arrests")
    .select("id, is_hidden, mugshot_hidden")
    .eq("source", FRIEND_SOURCE)
    .eq("arrest_number", synthArrestNumber(record))
    .maybeSingle();
  return data ?? null;
}
async function upsertRecord(record: FriendRecord): Promise<"inserted" | "updated" | "suppressed" | "skipped"> {
  const supabase = getSupabase();
  if (!supabase) return "skipped";
  if (await isSuppressed(record)) return "suppressed";
  const arrestNumber = synthArrestNumber(record);
  const existing = await findExisting(record);
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
    date_source: record.date_source,
    official_detail_url: record.official_detail_url,
    updated_at: new Date().toISOString(),
  };
  if (existing) {
    if (existing.is_hidden) return "suppressed";
    const { error } = await supabase
      .from("arrests")
      .update({ ...row, mugshot_url: existing.mugshot_hidden ? null : record.mugshot_url })
      .eq("id", existing.id);
    if (error) throw new Error(`Update failed for ${arrestNumber}: ${error.message}`);
    return "updated";
  }
  const { error } = await supabase.from("arrests").insert({ ...row, mugshot_url: record.mugshot_url, status: "pending" });
  if (error) throw new Error(`Insert failed for ${arrestNumber}: ${error.message}`);
  return "inserted";
}

// ------------------------------------------------------------- runner

export async function runFriendSiteImport(options: FriendImportOptions): Promise<FriendImportSummary> {
  const log = options.log ?? ((line: string) => console.log(line));
  const supabase = getSupabase();
  const summary: FriendImportSummary = {
    status: "running",
    indexPagesChecked: [],
    skippedPages: [],
    detailUrlsDiscovered: 0,
    detailPagesFetched: 0,
    namesFound: 0,
    datesFound: 0,
    validRecords: 0,
    countyBreakdown: { Broward: 0, "Palm Beach": 0, Unknown: 0 },
    skipReasons: Object.fromEntries(SKIP_REASONS.map((r) => [r, 0])) as Record<SkipReason, number>,
    mugshotUrlsDetected: 0,
    genericImagesSkipped: 0,
    wouldInsert: 0,
    wouldUpdate: 0,
    recordsInserted: 0,
    recordsUpdated: 0,
    recordsSuppressed: 0,
    recordsSkipped: 0,
    eligibleForLiveImport: 0,
    errors: [],
    notes: [],
    sampleBroward: [],
    samplePalmBeach: [],
    debugPages: [],
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
    const { data } = await supabase.from("scraper_runs").insert({ source: FRIEND_SOURCE, status: "running" }).select("id").single();
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
  const detailUrls = new Map<string, County>(); // url -> county hint from discovering page
  const crawledIndex = new Set<string>();
  const indexQueue: string[] = INDEX_PATH_CANDIDATES.map((p) => new URL(p, baseUrl()).toString());
  let blocked = false;

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
    const hint = pathCountyHint(new URL(url).pathname);
    const { detail, category } = collectLinks(cheerio.load(res.body), url, origin);
    for (const d of detail) {
      const prev = detailUrls.get(d);
      if (prev === undefined || (prev === "Unknown" && hint !== "Unknown")) detailUrls.set(d, hint);
    }
    for (const c of category) {
      if (!crawledIndex.has(c) && crawledIndex.size + indexQueue.length < MAX_INDEX_PAGES) indexQueue.push(c);
    }
    log(`  found ${detail.length} detail link(s) [hint: ${hint}], ${category.length} category link(s)`);
  }

  summary.detailUrlsDiscovered = detailUrls.size;
  if (blocked && detailUrls.size === 0) {
    summary.errors.push("Friend site refused automated access (blocked). No bypass attempted.");
    log("BLOCKED: the friend site refused automated access. No bypass attempted.");
    return await finish("blocked");
  }

  const seen = new Set<string>();
  const records: FriendRecord[] = [];

  for (const [url, hint] of Array.from(detailUrls).slice(0, maxRecords())) {
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

    const { record, reason, debug } = parseDetail(res.body, url, hint);
    if (!record) {
      if (reason) summary.skipReasons[reason]++;
      continue;
    }
    summary.genericImagesSkipped += (record as FriendRecord & { _genericImages?: number })._genericImages ?? 0;
    summary.namesFound++;

    if (!record.booking_date && !record.arrest_date) {
      summary.skipReasons["missing date"]++;
      if (options.debug && summary.debugPages.length < 5) summary.debugPages.push(debug);
      continue;
    }
    summary.datesFound++;

    if (seen.has(record.dedup_key)) {
      summary.skipReasons["duplicate"]++;
      continue;
    }
    seen.add(record.dedup_key);

    if (record.county === "Unknown") summary.skipReasons["unknown county"]++;
    summary.validRecords++;
    summary.countyBreakdown[record.county]++;
    if (record.mugshot_url) summary.mugshotUrlsDetected++;
    records.push(record);
  }

  const eligible = records.filter((r) => r.county !== "Unknown");
  summary.eligibleForLiveImport = eligible.length;
  summary.sampleBroward = records.filter((r) => r.county === "Broward").slice(0, 5);
  summary.samplePalmBeach = records.filter((r) => r.county === "Palm Beach").slice(0, 5);

  if (isSupabaseConfigured()) {
    for (const record of eligible) {
      try {
        if (await findExisting(record)) summary.wouldUpdate++;
        else summary.wouldInsert++;
      } catch {
        summary.wouldInsert++;
      }
    }
  } else {
    summary.wouldInsert = eligible.length;
    summary.notes.push("Supabase not configured — insert/update split not previewed; showing all eligible as would-insert.");
  }

  if (records.length === 0) {
    log("No valid records parsed from the friend site on this run.");
    return await finish(blocked ? "blocked" : "no_data");
  }

  if (options.dryRun) {
    log("");
    log(`DRY RUN — ${records.length} valid record(s). Nothing was written to the database.`);
    log(`County breakdown → Broward: ${summary.countyBreakdown.Broward}, Palm Beach: ${summary.countyBreakdown["Palm Beach"]}, Unknown: ${summary.countyBreakdown.Unknown}`);
    return await finish("dry_run");
  }

  if (!isSupabaseConfigured()) {
    summary.errors.push("Supabase is not configured; cannot write records. Use --dry-run or set env vars.");
    return await finish("error");
  }
  for (const record of records) {
    if (record.county === "Unknown") {
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

  log(`Done: valid ${summary.validRecords}, inserted ${summary.recordsInserted}, updated ${summary.recordsUpdated}, suppressed ${summary.recordsSuppressed}, skipped ${summary.recordsSkipped}, errors ${summary.errors.length}`);
  return await finish(summary.errors.length > 0 ? "partial" : "success");
}
