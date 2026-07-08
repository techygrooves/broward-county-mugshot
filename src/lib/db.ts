import { getSupabase, isSupabaseConfigured } from "./supabase";
import { SAMPLE_ARRESTS } from "./sample-data";
import { getCategory } from "./charges";
import {
  ArrestRecord,
  RemovalRequest,
  ScraperRun,
  SearchParams,
  SearchResult,
  SuppressionEntry,
} from "./types";

export const PAGE_SIZE = 20;

/**
 * Data access layer. When Supabase is not configured (e.g. local preview
 * without credentials) public read functions fall back to a small set of
 * clearly-marked fictional sample records so the UI can be reviewed.
 */

export function isDemoMode(): boolean {
  return !isSupabaseConfigured();
}

/**
 * A record is publicly visible when it is not hidden (is_hidden false or
 * null) and not removed (removed_at null). We intentionally do NOT filter on
 * `status` here: imported/scraped records land as "pending" and should still
 * be visible on the site. Moderation is handled by is_hidden / removed_at
 * (and the suppression list), not by status.
 */
function visiblePublic<T extends { or: (f: string) => T; is: (c: string, v: unknown) => T }>(query: T): T {
  return query.or("is_hidden.is.false,is_hidden.is.null").is("removed_at", null);
}

// County slug <-> stored county value ("Broward", "Palm Beach").
export const COUNTY_BY_SLUG: Record<string, string> = {
  broward: "Broward",
  "palm-beach": "Palm Beach",
};

function publicSample(): ArrestRecord[] {
  return SAMPLE_ARRESTS.filter((r) => !r.is_hidden && !r.removed_at);
}

export async function getRecentArrests(limit = 12): Promise<{ records: ArrestRecord[]; isDemo: boolean }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { records: publicSample().slice(0, limit), isDemo: true };
  }
  try {
    const { data, error } = await visiblePublic(supabase.from("arrests").select("*"))
      .order("booking_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return { records: (data as ArrestRecord[]) ?? [], isDemo: false };
  } catch (e) {
    console.error("getRecentArrests failed:", e);
    return { records: [], isDemo: false };
  }
}

export async function getArrestById(id: string): Promise<{ record: ArrestRecord | null; isDemo: boolean }> {
  const supabase = getSupabase();
  if (!supabase) {
    const record = publicSample().find((r) => r.id === id) ?? null;
    return { record, isDemo: true };
  }
  try {
    const { data, error } = await visiblePublic(supabase.from("arrests").select("*").eq("id", id)).maybeSingle();
    if (error) throw error;
    return { record: (data as ArrestRecord) ?? null, isDemo: false };
  } catch (e) {
    console.error("getArrestById failed:", e);
    return { record: null, isDemo: false };
  }
}

function sampleSearch(params: SearchParams): SearchResult {
  const page = Math.max(1, params.page ?? 1);
  let records = publicSample();
  const like = (v: string | null, q?: string) =>
    !q || (v ?? "").toLowerCase().includes(q.toLowerCase());
  records = records.filter(
    (r) =>
      like(r.first_name, params.first_name) &&
      like(r.last_name, params.last_name) &&
      like(r.arrest_number, params.arrest_number) &&
      like(r.charges_text, params.charge) &&
      (!params.booking_date_from || (r.booking_date ?? "") >= params.booking_date_from) &&
      (!params.booking_date_to || (r.booking_date ?? "") <= params.booking_date_to)
  );
  const total = records.length;
  const start = (page - 1) * PAGE_SIZE;
  return {
    records: records.slice(start, start + PAGE_SIZE),
    total,
    page,
    pageSize: PAGE_SIZE,
    isDemo: true,
  };
}

export async function searchArrests(params: SearchParams): Promise<SearchResult> {
  const supabase = getSupabase();
  if (!supabase) return sampleSearch(params);
  const page = Math.max(1, params.page ?? 1);
  try {
    let query = visiblePublic(supabase.from("arrests").select("*", { count: "exact" }));
    if (params.first_name) query = query.ilike("first_name", `%${params.first_name}%`);
    if (params.last_name) query = query.ilike("last_name", `%${params.last_name}%`);
    if (params.arrest_number) query = query.ilike("arrest_number", `%${params.arrest_number}%`);
    if (params.charge) query = query.ilike("charges_text", `%${params.charge}%`);
    if (params.booking_date_from) query = query.gte("booking_date", params.booking_date_from);
    if (params.booking_date_to) query = query.lte("booking_date", params.booking_date_to);
    const from = (page - 1) * PAGE_SIZE;
    const { data, error, count } = await query
      .order("booking_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    return {
      records: (data as ArrestRecord[]) ?? [],
      total: count ?? 0,
      page,
      pageSize: PAGE_SIZE,
      isDemo: false,
    };
  } catch (e) {
    console.error("searchArrests failed:", e);
    return { records: [], total: 0, page, pageSize: PAGE_SIZE, isDemo: false };
  }
}

export async function getArrestsByCategory(slug: string, page = 1): Promise<SearchResult> {
  const category = getCategory(slug);
  if (!category) {
    return { records: [], total: 0, page, pageSize: PAGE_SIZE, isDemo: isDemoMode() };
  }
  const supabase = getSupabase();
  if (!supabase) {
    const records = publicSample().filter((r) =>
      category.keywords.some((k) =>
        (r.charges_text ?? "").toLowerCase().includes(k.toLowerCase())
      )
    );
    return { records, total: records.length, page, pageSize: PAGE_SIZE, isDemo: true };
  }
  try {
    const orFilter = category.keywords
      .map((k) => `charges_text.ilike.%${k.replaceAll(",", "")}%`)
      .join(",");
    const from = (page - 1) * PAGE_SIZE;
    const { data, error, count } = await visiblePublic(
      supabase.from("arrests").select("*", { count: "exact" }).or(orFilter)
    )
      .order("booking_date", { ascending: false, nullsFirst: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    return {
      records: (data as ArrestRecord[]) ?? [],
      total: count ?? 0,
      page,
      pageSize: PAGE_SIZE,
      isDemo: false,
    };
  } catch (e) {
    console.error("getArrestsByCategory failed:", e);
    return { records: [], total: 0, page, pageSize: PAGE_SIZE, isDemo: false };
  }
}

export async function getArrestsByCounty(slug: string, page = 1): Promise<SearchResult & { county: string | null }> {
  const county = COUNTY_BY_SLUG[slug];
  if (!county) {
    return { records: [], total: 0, page, pageSize: PAGE_SIZE, isDemo: isDemoMode(), county: null };
  }
  const supabase = getSupabase();
  if (!supabase) {
    const records = publicSample().filter((r) => r.county === county);
    return { records, total: records.length, page, pageSize: PAGE_SIZE, isDemo: true, county };
  }
  try {
    const from = (page - 1) * PAGE_SIZE;
    const { data, error, count } = await visiblePublic(
      supabase.from("arrests").select("*", { count: "exact" }).eq("county", county)
    )
      .order("booking_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    return {
      records: (data as ArrestRecord[]) ?? [],
      total: count ?? 0,
      page,
      pageSize: PAGE_SIZE,
      isDemo: false,
      county,
    };
  } catch (e) {
    console.error("getArrestsByCounty failed:", e);
    return { records: [], total: 0, page, pageSize: PAGE_SIZE, isDemo: false, county };
  }
}

// ---------------------------------------------------------------- admin

export interface AdminStats {
  totalRecords: number;
  visibleRecords: number;
  hiddenRecords: number;
  pendingRecords: number;
  browardRecords: number;
  palmBeachRecords: number;
  withMugshotRecords: number;
  pendingRemovals: number;
  lastRun: ScraperRun | null;
  isDemo: boolean;
}

export async function getAdminStats(): Promise<AdminStats> {
  const supabase = getSupabase();
  const empty = (isDemo: boolean): AdminStats => ({
    totalRecords: isDemo ? SAMPLE_ARRESTS.length : 0,
    visibleRecords: 0,
    hiddenRecords: 0,
    pendingRecords: 0,
    browardRecords: 0,
    palmBeachRecords: 0,
    withMugshotRecords: 0,
    pendingRemovals: 0,
    lastRun: null,
    isDemo,
  });
  if (!supabase) return empty(true);
  const countHead = () => supabase.from("arrests").select("id", { count: "exact", head: true });
  try {
    const [total, visible, hidden, pending, broward, palmBeach, withMugshot, removals, runs] =
      await Promise.all([
        countHead(),
        visiblePublic(countHead()),
        countHead().eq("is_hidden", true),
        countHead().eq("status", "pending"),
        countHead().eq("county", "Broward"),
        countHead().eq("county", "Palm Beach"),
        countHead().not("mugshot_url", "is", null),
        supabase.from("removal_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("scraper_runs").select("*").order("started_at", { ascending: false }).limit(1),
      ]);
    return {
      totalRecords: total.count ?? 0,
      visibleRecords: visible.count ?? 0,
      hiddenRecords: hidden.count ?? 0,
      pendingRecords: pending.count ?? 0,
      browardRecords: broward.count ?? 0,
      palmBeachRecords: palmBeach.count ?? 0,
      withMugshotRecords: withMugshot.count ?? 0,
      pendingRemovals: removals.count ?? 0,
      lastRun: (runs.data?.[0] as ScraperRun) ?? null,
      isDemo: false,
    };
  } catch (e) {
    console.error("getAdminStats failed:", e);
    return empty(false);
  }
}

export async function getAllRecordsAdmin(page = 1, filter?: string): Promise<SearchResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      records: SAMPLE_ARRESTS,
      total: SAMPLE_ARRESTS.length,
      page: 1,
      pageSize: PAGE_SIZE,
      isDemo: true,
    };
  }
  try {
    let query = supabase.from("arrests").select("*", { count: "exact" });
    if (filter === "hidden") query = query.eq("is_hidden", true);
    if (filter === "pending") query = query.eq("status", "pending");
    if (filter === "removal_requested") query = query.eq("removal_requested", true);
    const from = (page - 1) * PAGE_SIZE;
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    return {
      records: (data as ArrestRecord[]) ?? [],
      total: count ?? 0,
      page,
      pageSize: PAGE_SIZE,
      isDemo: false,
    };
  } catch (e) {
    console.error("getAllRecordsAdmin failed:", e);
    return { records: [], total: 0, page, pageSize: PAGE_SIZE, isDemo: false };
  }
}

export async function getScraperRuns(limit = 30): Promise<{ runs: ScraperRun[]; isDemo: boolean }> {
  const supabase = getSupabase();
  if (!supabase) return { runs: [], isDemo: true };
  try {
    const { data, error } = await supabase
      .from("scraper_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return { runs: (data as ScraperRun[]) ?? [], isDemo: false };
  } catch (e) {
    console.error("getScraperRuns failed:", e);
    return { runs: [], isDemo: false };
  }
}

export async function getRemovalRequests(): Promise<{ requests: (RemovalRequest & { arrest?: ArrestRecord | null })[]; isDemo: boolean }> {
  const supabase = getSupabase();
  if (!supabase) return { requests: [], isDemo: true };
  try {
    const { data, error } = await supabase
      .from("removal_requests")
      .select("*, arrest:arrests(*)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return {
      requests: (data as (RemovalRequest & { arrest?: ArrestRecord | null })[]) ?? [],
      isDemo: false,
    };
  } catch (e) {
    console.error("getRemovalRequests failed:", e);
    return { requests: [], isDemo: false };
  }
}

export async function getSuppressionList(): Promise<SuppressionEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("suppression_list")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data as SuppressionEntry[]) ?? [];
  } catch (e) {
    console.error("getSuppressionList failed:", e);
    return [];
  }
}
