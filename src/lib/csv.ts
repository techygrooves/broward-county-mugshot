/**
 * Minimal CSV parser (handles quoted fields, embedded commas, escaped
 * quotes and CRLF). Returns rows keyed by the header row, lowercased.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((c) => c.trim() !== "")) rows.push(row);
  }
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = (cells[idx] ?? "").trim();
    });
    return record;
  });
}

export const CSV_TEMPLATE_HEADER =
  "arrest_number,first_name,middle_name,last_name,sex,age,booking_date,arrest_date,release_date,location,charges,bond_total,mugshot_url,official_detail_url";

export const CSV_TEMPLATE_EXAMPLE =
  'BSO-2026-12345,John,Q,Public,M,35,2026-07-01,2026-07-01,,"Fort Lauderdale, FL","Driving under the influence | 316.193 | $1,000; Resisting without violence | 843.02 | $500",$1500,,https://bookingblotter.sheriff.org/app/';
