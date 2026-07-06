import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminStats } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

function StatCard({ label, value, href }: { label: string; value: string | number; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <p className="text-3xl font-bold text-brand-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </Link>
  );
}

export default async function AdminDashboardPage() {
  await requireAdmin();
  const stats = await getAdminStats();

  return (
    <div>
      {stats.isDemo && (
        <p className="mb-6 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Supabase is not configured — dashboard numbers reflect built-in
          sample data and admin write actions are disabled. See README for
          database setup.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total records" value={stats.totalRecords} href="/admin/records" />
        <StatCard label="Hidden records" value={stats.hiddenRecords} href="/admin/records?filter=hidden" />
        <StatCard label="Pending (unpublished) records" value={stats.pendingRecords} href="/admin/records?filter=pending" />
        <StatCard label="Pending removal requests" value={stats.pendingRemovals} href="/admin/removal-requests" />
      </div>

      <div className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-lg font-bold text-brand-900">Last scraper run</h2>
        {stats.lastRun ? (
          <div className="mt-2 text-sm text-slate-600">
            <p>
              <span className="font-medium">{stats.lastRun.status}</span> —
              started {formatDateTime(stats.lastRun.started_at)}
            </p>
            <p className="mt-1">
              Found {stats.lastRun.records_found}, inserted{" "}
              {stats.lastRun.records_inserted}, updated{" "}
              {stats.lastRun.records_updated}
            </p>
            <Link href="/admin/scraper-runs" className="mt-2 inline-block text-brand-700 hover:underline">
              View all runs →
            </Link>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            No scraper runs recorded yet. Run{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">npm run scrape:broward:dry-run</code>{" "}
            to test the pipeline, or use{" "}
            <Link href="/admin/import" className="text-brand-700 hover:underline">
              manual import
            </Link>
            .
          </p>
        )}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-base font-bold text-brand-900">Data pipeline</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Official source: Broward Sheriff&apos;s Office Booking Blotter</li>
            <li>Scraper stops automatically if the source blocks automated access</li>
            <li>Fallback: CSV upload or manual entry on the Import page</li>
            <li>Imported records stay &quot;pending&quot; until published</li>
          </ul>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-base font-bold text-brand-900">Removal policy</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>All removal requests are free (Fla. Stat. § 943.0593)</li>
            <li>Approving a request hides the record or its photo</li>
            <li>Approved removals go on the suppression list</li>
            <li>The scraper never re-publishes suppressed records</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
