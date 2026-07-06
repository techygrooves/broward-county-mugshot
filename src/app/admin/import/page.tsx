import { requireAdmin } from "@/lib/admin-auth";
import { CsvImportForm, ManualRecordForm } from "@/components/AdminImportForms";
import { CSV_TEMPLATE_HEADER, CSV_TEMPLATE_EXAMPLE } from "@/lib/csv";
import { isDemoMode } from "@/lib/db";

export default async function AdminImportPage() {
  await requireAdmin();
  const demo = isDemoMode();

  return (
    <div>
      <h2 className="font-serif text-lg font-bold text-brand-900">Manual import</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-500">
        The safe fallback when automated scraping of the official source is
        blocked. Import records exported or transcribed from the official
        Broward Sheriff&apos;s Office Booking Blotter / Arrest Search. Imported
        records are saved as <strong>pending</strong> and must be published
        from Manage Records before they appear publicly. Records matching the
        suppression list are never re-published.
      </p>
      {demo && (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Supabase is not configured — imports are disabled until database
          credentials are added to <code>.env.local</code>.
        </p>
      )}

      <section className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-serif text-base font-bold text-brand-900">CSV upload</h3>
        <p className="mt-1 text-sm text-slate-500">
          Header row (column order does not matter; extra columns are ignored):
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700">
          {CSV_TEMPLATE_HEADER + "\n" + CSV_TEMPLATE_EXAMPLE}
        </pre>
        <p className="mt-2 text-xs text-slate-400">
          Charges format inside the &quot;charges&quot; column:{" "}
          <code>description | statute | bond</code>, multiple charges separated
          by semicolons.
        </p>
        <div className="mt-4">
          <CsvImportForm />
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-serif text-base font-bold text-brand-900">
          Manual record entry
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Create a single record by hand. It is saved as pending until you
          publish it.
        </p>
        <div className="mt-4">
          <ManualRecordForm />
        </div>
      </section>
    </div>
  );
}
