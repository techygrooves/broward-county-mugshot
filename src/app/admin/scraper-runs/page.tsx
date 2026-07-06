import { requireAdmin } from "@/lib/admin-auth";
import { getScraperRuns } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

const STATUS_STYLES: Record<string, string> = {
  success: "bg-green-100 text-green-800",
  partial: "bg-amber-100 text-amber-800",
  dry_run: "bg-sky-100 text-sky-800",
  no_data: "bg-slate-200 text-slate-600",
  blocked: "bg-red-100 text-red-800",
  error: "bg-red-100 text-red-800",
  running: "bg-brand-100 text-brand-800",
};

export default async function ScraperRunsPage() {
  await requireAdmin();
  const { runs, isDemo } = await getScraperRuns();

  return (
    <div>
      <h2 className="font-serif text-lg font-bold text-brand-900">Scraper runs</h2>
      <p className="mt-1 text-sm text-slate-500">
        History of daily scrapes of the official Broward Sheriff&apos;s Office
        Booking Blotter. A <strong>blocked</strong> status means the source
        refused automated access — use manual import instead; no bypass is
        attempted.
      </p>
      {isDemo && (
        <p className="mt-4 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Supabase is not configured — no run history to display.
        </p>
      )}
      {runs.length > 0 && (
        <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Completed</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Found</th>
                <th className="px-4 py-3 text-right">Inserted</th>
                <th className="px-4 py-3 text-right">Updated</th>
                <th className="px-4 py-3">Errors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {runs.map((run) => (
                <tr key={run.id}>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(run.started_at)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(run.completed_at)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[run.status] ?? "bg-slate-100 text-slate-600"}`}
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{run.records_found}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{run.records_inserted}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{run.records_updated}</td>
                  <td className="max-w-xs px-4 py-3 text-xs text-slate-500">
                    {run.errors_json && run.errors_json.length > 0
                      ? run.errors_json.slice(0, 3).join("; ")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!isDemo && runs.length === 0 && (
        <p className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
          No runs yet. Trigger one with{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">npm run scrape:broward</code>{" "}
          or wait for the daily cron.
        </p>
      )}
    </div>
  );
}
