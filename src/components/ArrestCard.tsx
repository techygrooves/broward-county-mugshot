import Link from "next/link";
import { ArrestRecord } from "@/lib/types";
import { displayName, formatDate, initials, topCharge } from "@/lib/format";
import MugshotDisplay from "./MugshotDisplay";

export default function ArrestCard({ record }: { record: ArrestRecord }) {
  return (
    <Link
      href={`/arrest/${record.id}`}
      className="group flex gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <MugshotDisplay record={record} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-base font-bold text-brand-900 group-hover:text-brand-700">
          {displayName(record)}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          Booked {formatDate(record.booking_date)}
          {record.location ? ` · ${record.location}` : ""}
        </p>
        <p className="mt-2 line-clamp-2 text-sm text-slate-600">{topCharge(record)}</p>
        {(record.charges_json?.length ?? 0) > 1 && (
          <p className="mt-1 text-xs font-medium text-brand-600">
            +{(record.charges_json?.length ?? 1) - 1} additional charge(s)
          </p>
        )}
      </div>
    </Link>
  );
}

export function ArrestCardPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
      {label}
    </div>
  );
}

export function ArrestInitialsBadge({ record }: { record: ArrestRecord }) {
  return (
    <span className="flex h-14 w-14 items-center justify-center rounded-md bg-brand-100 font-serif text-lg font-bold text-brand-700">
      {initials(record)}
    </span>
  );
}
