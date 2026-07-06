"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_COOKIE,
  isAdminAuthenticated,
  sessionToken,
  verifyPassword,
} from "@/lib/admin-auth";
import { parseCsv } from "@/lib/csv";
import { getSupabase } from "@/lib/supabase";
import { Charge } from "@/lib/types";

export interface ActionState {
  ok: boolean;
  message: string;
}

// ------------------------------------------------------------- auth

export async function loginAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  if (!process.env.ADMIN_PASSWORD) {
    return {
      ok: false,
      message:
        "ADMIN_PASSWORD is not set. Add it to .env.local (see .env.example) and restart the server.",
    };
  }
  if (!verifyPassword(password)) {
    return { ok: false, message: "Incorrect password." };
  }
  const token = sessionToken();
  if (!token) return { ok: false, message: "Admin auth is not configured." };
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

async function assertAdmin(): Promise<void> {
  if (!(await isAdminAuthenticated())) {
    throw new Error("Not authenticated");
  }
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

// ------------------------------------------------------ record admin

export async function setRecordHidden(formData: FormData): Promise<void> {
  await assertAdmin();
  const supabase = getSupabase();
  if (!supabase) return;
  const id = String(formData.get("id") ?? "");
  const hide = String(formData.get("hide") ?? "") === "true";
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!id) return;
  const { error } = await supabase
    .from("arrests")
    .update({
      is_hidden: hide,
      hidden_reason: hide ? reason ?? "Hidden by admin" : null,
      removed_at: hide ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) console.error("setRecordHidden failed:", error);
  revalidateAll();
}

export async function setMugshotHidden(formData: FormData): Promise<void> {
  await assertAdmin();
  const supabase = getSupabase();
  if (!supabase) return;
  const id = String(formData.get("id") ?? "");
  const hide = String(formData.get("hide") ?? "") === "true";
  if (!id) return;
  const { error } = await supabase
    .from("arrests")
    .update({ mugshot_hidden: hide })
    .eq("id", id);
  if (error) console.error("setMugshotHidden failed:", error);
  revalidateAll();
}

export async function publishRecord(formData: FormData): Promise<void> {
  await assertAdmin();
  const supabase = getSupabase();
  if (!supabase) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const { error } = await supabase
    .from("arrests")
    .update({ status: "published" })
    .eq("id", id);
  if (error) console.error("publishRecord failed:", error);
  revalidateAll();
}

export async function deleteRecord(formData: FormData): Promise<void> {
  await assertAdmin();
  const supabase = getSupabase();
  if (!supabase) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const { error } = await supabase.from("arrests").delete().eq("id", id);
  if (error) console.error("deleteRecord failed:", error);
  revalidateAll();
}

// ------------------------------------------------- removal requests

/**
 * Approve a removal request. mode:
 *  - "record": hide the whole record
 *  - "mugshot": hide only the booking photo
 * Either way the identifiers go on the suppression list so the scraper
 * never re-publishes what was removed.
 */
export async function approveRemovalRequest(formData: FormData): Promise<void> {
  await assertAdmin();
  const supabase = getSupabase();
  if (!supabase) return;
  const requestId = String(formData.get("request_id") ?? "");
  const mode = String(formData.get("mode") ?? "record");
  if (!requestId) return;
  try {
    const { data: request, error } = await supabase
      .from("removal_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();
    if (error || !request) throw error ?? new Error("Request not found");

    if (request.arrest_id) {
      const { data: arrest } = await supabase
        .from("arrests")
        .select("*")
        .eq("id", request.arrest_id)
        .maybeSingle();
      if (arrest) {
        if (mode === "mugshot") {
          await supabase
            .from("arrests")
            .update({ mugshot_hidden: true })
            .eq("id", arrest.id);
        } else {
          await supabase
            .from("arrests")
            .update({
              is_hidden: true,
              hidden_reason: "Removal request approved",
              removed_at: new Date().toISOString(),
            })
            .eq("id", arrest.id);
        }
        await supabase.from("suppression_list").insert({
          arrest_number: arrest.arrest_number,
          full_name: arrest.full_name,
          reason:
            mode === "mugshot"
              ? `Mugshot removal approved (request ${requestId})`
              : `Record removal approved (request ${requestId})`,
        });
      }
    }

    await supabase
      .from("removal_requests")
      .update({ status: "approved", resolved_at: new Date().toISOString() })
      .eq("id", requestId);
  } catch (e) {
    console.error("approveRemovalRequest failed:", e);
  }
  revalidateAll();
}

export async function rejectRemovalRequest(formData: FormData): Promise<void> {
  await assertAdmin();
  const supabase = getSupabase();
  if (!supabase) return;
  const requestId = String(formData.get("request_id") ?? "");
  if (!requestId) return;
  const { error } = await supabase
    .from("removal_requests")
    .update({ status: "rejected", resolved_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) console.error("rejectRemovalRequest failed:", error);
  revalidateAll();
}

// ----------------------------------------------------------- import

function parseCharges(raw: string): Charge[] {
  if (!raw) return [];
  return raw
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [description, statute, bond] = part.split("|").map((s) => s.trim());
      return {
        description: description ?? part,
        statute: statute || null,
        bond_amount: bond || null,
      };
    });
}

function chargesToText(charges: Charge[]): string {
  return charges
    .map((c) => [c.description, c.statute].filter(Boolean).join(" "))
    .join("; ");
}

interface ImportableRow {
  arrest_number: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  sex?: string;
  age?: string;
  booking_date?: string;
  arrest_date?: string;
  release_date?: string;
  location?: string;
  charges?: string;
  bond_total?: string;
  mugshot_url?: string;
  official_detail_url?: string;
}

async function upsertImportedRow(
  row: ImportableRow,
  source: string
): Promise<"inserted" | "updated" | "suppressed" | "skipped"> {
  const supabase = getSupabase();
  if (!supabase) return "skipped";
  const arrestNumber = row.arrest_number?.trim();
  if (!arrestNumber) return "skipped";

  const fullName = [row.first_name, row.middle_name, row.last_name]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(" ");

  const { data: suppressed } = await supabase
    .from("suppression_list")
    .select("id")
    .or(
      [
        `arrest_number.eq.${arrestNumber}`,
        fullName ? `full_name.ilike.${fullName}` : null,
      ]
        .filter(Boolean)
        .join(",")
    )
    .limit(1);
  if (suppressed && suppressed.length > 0) return "suppressed";

  const charges = parseCharges(row.charges ?? "");
  const record = {
    source,
    county: "Broward",
    arrest_number: arrestNumber,
    first_name: row.first_name?.trim() || null,
    middle_name: row.middle_name?.trim() || null,
    last_name: row.last_name?.trim() || null,
    full_name: fullName || arrestNumber,
    sex: row.sex?.trim() || null,
    age: row.age && !Number.isNaN(Number(row.age)) ? Number(row.age) : null,
    booking_date: row.booking_date?.trim() || null,
    arrest_date: row.arrest_date?.trim() || null,
    release_date: row.release_date?.trim() || null,
    location: row.location?.trim() || null,
    charges_json: charges,
    charges_text: chargesToText(charges),
    bond_json: row.bond_total ? { total_bond: row.bond_total.trim() } : null,
    mugshot_url: row.mugshot_url?.trim() || null,
    official_detail_url:
      row.official_detail_url?.trim() ||
      process.env.BROWARD_SOURCE_URL ||
      "https://bookingblotter.sheriff.org/app/",
    status: "pending" as const,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from("arrests")
    .select("id, is_hidden")
    .eq("arrest_number", arrestNumber)
    .maybeSingle();

  if (existing) {
    if (existing.is_hidden) return "suppressed";
    const { error } = await supabase
      .from("arrests")
      .update(record)
      .eq("id", existing.id);
    if (error) throw error;
    return "updated";
  }
  const { error } = await supabase.from("arrests").insert(record);
  if (error) throw error;
  return "inserted";
}

export async function importCsvAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await assertAdmin();
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, message: "Supabase is not configured — imports need a database." };
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Please choose a CSV file to upload." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, message: "CSV too large (5 MB max)." };
  }
  try {
    const text = await file.text();
    const rows = parseCsv(text) as unknown as ImportableRow[];
    if (rows.length === 0) {
      return { ok: false, message: "No data rows found. Check the CSV header format." };
    }
    let inserted = 0;
    let updated = 0;
    let suppressed = 0;
    let skipped = 0;
    for (const row of rows.slice(0, 1000)) {
      const result = await upsertImportedRow(row, "manual-import");
      if (result === "inserted") inserted++;
      else if (result === "updated") updated++;
      else if (result === "suppressed") suppressed++;
      else skipped++;
    }
    revalidateAll();
    return {
      ok: true,
      message: `Import complete: ${inserted} inserted, ${updated} updated, ${suppressed} blocked by suppression/hidden flags, ${skipped} skipped. Imported records are held as "pending" until you publish them from Manage Records.`,
    };
  } catch (e) {
    console.error("importCsvAction failed:", e);
    return { ok: false, message: `Import failed: ${e instanceof Error ? e.message : "unknown error"}` };
  }
}

export async function createRecordAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await assertAdmin();
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, message: "Supabase is not configured — record creation needs a database." };
  }
  const row: ImportableRow = {
    arrest_number: String(formData.get("arrest_number") ?? ""),
    first_name: String(formData.get("first_name") ?? ""),
    middle_name: String(formData.get("middle_name") ?? ""),
    last_name: String(formData.get("last_name") ?? ""),
    sex: String(formData.get("sex") ?? ""),
    age: String(formData.get("age") ?? ""),
    booking_date: String(formData.get("booking_date") ?? ""),
    arrest_date: String(formData.get("arrest_date") ?? ""),
    location: String(formData.get("location") ?? ""),
    charges: String(formData.get("charges") ?? ""),
    bond_total: String(formData.get("bond_total") ?? ""),
    mugshot_url: String(formData.get("mugshot_url") ?? ""),
    official_detail_url: String(formData.get("official_detail_url") ?? ""),
  };
  if (!row.arrest_number.trim()) {
    return { ok: false, message: "Arrest number is required (it is the deduplication key)." };
  }
  try {
    const result = await upsertImportedRow(row, "manual-entry");
    revalidateAll();
    if (result === "suppressed") {
      return {
        ok: false,
        message:
          "This record matches the suppression list or a hidden record and was not re-published.",
      };
    }
    return {
      ok: true,
      message: `Record ${result}. It is held as "pending" until you publish it from Manage Records.`,
    };
  } catch (e) {
    console.error("createRecordAction failed:", e);
    return { ok: false, message: `Save failed: ${e instanceof Error ? e.message : "unknown error"}` };
  }
}
