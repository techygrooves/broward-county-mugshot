import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import {
  deleteRecord,
  publishRecord,
  setMugshotHidden,
  setRecordHidden,
} from "@/lib/actions/admin";
import { getAllRecordsAdmin } from "@/lib/db";
import { displayName, formatDate } from "@/lib/format";
import Pagination from "@/components/Pagination";

const FILTERS = [
  { key: undefined, label: "All" },
  { key: "hidden", label: "Hidden" },
  { key: "pending", label: "Pending" },
  { key: "removal_requested", label: "Removal requested" },
];

export default async function AdminRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const result = await getAllRecordsAdmin(page, params.filter);

  return (
    <div>
      <h2 className="font-serif text-lg font-bold text-brand-900">Manage records</h2>
      {result.isDemo && (
        <p className="mt-4 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Supabase is not configured — showing sample data; actions are
          disabled.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.label}
            href={filter.key ? `/admin/records?filter=${filter.key}` : "/admin/records"}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              params.filter === filter.key
                ? "border-brand-600 bg-brand-700 text-white"
                : "border-slate-300 bg-white text-slate-600 hover:border-brand-400"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name / arrest no.</th>
              <th className="px-4 py-3">Booked</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">State</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.records.map((record) => (
              <tr key={record.id}>
                <td className="px-4 py-3">
                  <Link
                    href={`/arrest/${record.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {displayName(record)}
                  </Link>
                  <p className="text-xs text-slate-400">{record.arrest_number}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{formatDate(record.booking_date)}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{record.source}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        record.status === "published"
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {record.status}
                    </span>
                    {record.is_hidden && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        hidden
                      </span>
                    )}
                    {record.mugshot_hidden && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        photo hidden
                      </span>
                    )}
                    {record.removal_requested && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        removal requested
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {record.status === "pending" && (
                      <form action={publishRecord}>
                        <input type="hidden" name="id" value={record.id} />
                        <button className="rounded border border-green-300 bg-green-50 px-2 py-1 text-xs font-medium text-green-800 hover:bg-green-100">
                          Publish
                        </button>
                      </form>
                    )}
                    <form action={setRecordHidden}>
                      <input type="hidden" name="id" value={record.id} />
                      <input type="hidden" name="hide" value={record.is_hidden ? "false" : "true"} />
                      <button className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                        {record.is_hidden ? "Unhide" : "Hide"}
                      </button>
                    </form>
                    <form action={setMugshotHidden}>
                      <input type="hidden" name="id" value={record.id} />
                      <input type="hidden" name="hide" value={record.mugshot_hidden ? "false" : "true"} />
                      <button className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                        {record.mugshot_hidden ? "Unhide photo" : "Hide photo"}
                      </button>
                    </form>
                    <form action={deleteRecord}>
                      <input type="hidden" name="id" value={record.id} />
                      <button className="rounded border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.records.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-500">No records match this filter.</p>
        )}
      </div>

      <Pagination
        page={result.page}
        total={result.total}
        pageSize={result.pageSize}
        basePath="/admin/records"
        params={{ filter: params.filter }}
      />
    </div>
  );
}
