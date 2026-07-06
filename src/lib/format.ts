import { ArrestRecord } from "./types";

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.length <= 10 ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-US", { timeZone: "UTC" }) + " UTC";
}

export function displayName(record: ArrestRecord): string {
  return record.full_name || [record.first_name, record.middle_name, record.last_name].filter(Boolean).join(" ") || "Name unavailable";
}

export function initials(record: ArrestRecord): string {
  const name = displayName(record);
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase() || "?";
}

export function topCharge(record: ArrestRecord): string {
  const charge = record.charges_json?.[0]?.description;
  return charge ?? "Charge information unavailable";
}

export function sexLabel(sex: string | null): string {
  if (!sex) return "—";
  const s = sex.trim().toUpperCase();
  if (s.startsWith("M")) return "Male";
  if (s.startsWith("F")) return "Female";
  return sex;
}

export function shouldDisplayMugshots(): boolean {
  return process.env.NEXT_PUBLIC_DISPLAY_MUGSHOTS === "true";
}
