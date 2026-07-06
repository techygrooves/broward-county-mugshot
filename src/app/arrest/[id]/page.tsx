import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AttorneyCTA from "@/components/AttorneyCTA";
import DemoBanner from "@/components/DemoBanner";
import DisclaimerNotice from "@/components/DisclaimerNotice";
import MugshotDisplay from "@/components/MugshotDisplay";
import { categorize } from "@/lib/charges";
import { getArrestById } from "@/lib/db";
import { displayName, formatDate, sexLabel } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { record } = await getArrestById(id);
  if (!record) return { title: "Record Not Found" };
  const name = displayName(record);
  return {
    title: `${name} — Broward County Booking Information, ${formatDate(record.booking_date)}`,
    description: `Public arrest record for ${name}, booked in Broward County, Florida on ${formatDate(
      record.booking_date
    )}. Sourced from official Broward Sheriff's Office public records. An arrest is not a conviction.`,
  };
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2.5 text-sm">
      <dt className="shrink-0 font-medium text-slate-500">{label}</dt>
      <dd className="text-right text-slate-800">{value}</dd>
    </div>
  );
}

export default async function ArrestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { record, isDemo } = await getArrestById(id);
  if (!record) notFound();

  const name = displayName(record);
  const categories = categorize(record.charges_text);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <nav className="text-xs text-slate-500" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-brand-700">Home</Link>
        {" / "}
        <Link href="/recent-arrests" className="hover:text-brand-700">Recent Arrests</Link>
        {" / "}
        <span className="text-slate-700">{name}</span>
      </nav>

      <div className="mt-4">
        <DemoBanner show={isDemo} />
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row">
          <MugshotDisplay record={record} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent-600">
              Broward County Booking Information
            </p>
            <h1 className="mt-1 font-serif text-2xl font-bold text-brand-950 sm:text-3xl">
              {name}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Arrest number: {record.arrest_number}
            </p>
            <dl className="mt-4">
              <DetailRow label="Booking date" value={formatDate(record.booking_date)} />
              <DetailRow label="Arrest date" value={formatDate(record.arrest_date)} />
              {record.release_date && (
                <DetailRow label="Release date" value={formatDate(record.release_date)} />
              )}
              <DetailRow label="Sex" value={sexLabel(record.sex)} />
              <DetailRow label="Age at booking" value={record.age ? String(record.age) : "—"} />
              <DetailRow label="Location" value={record.location ?? "—"} />
              {record.bond_json?.total_bond && (
                <DetailRow label="Total bond" value={record.bond_json.total_bond} />
              )}
            </dl>
          </div>
        </div>

        <h2 className="mt-8 font-serif text-lg font-bold text-brand-900">Charges</h2>
        {record.charges_json && record.charges_json.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {record.charges_json.map((charge, i) => (
              <li
                key={i}
                className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
              >
                <p className="font-medium text-slate-800">{charge.description}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {charge.statute ? `Statute ${charge.statute}` : ""}
                  {charge.statute && charge.bond_amount ? " · " : ""}
                  {charge.bond_amount ? `Bond ${charge.bond_amount}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            Charge information is unavailable for this record. Check the
            official source below.
          </p>
        )}

        {categories.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={`/charges/${category.slug}`}
                className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
              >
                {category.shortName}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-6 text-sm">
          {record.official_detail_url && (
            <a
              href={record.official_detail_url}
              rel="nofollow noopener"
              target="_blank"
              className="font-semibold text-brand-700 hover:underline"
            >
              View the official Broward Sheriff&apos;s Office record →
            </a>
          )}
          <Link
            href={`/remove-mugshot?arrest_id=${record.id}&arrest_number=${encodeURIComponent(record.arrest_number)}`}
            className="text-slate-500 hover:text-brand-700 hover:underline"
          >
            Request removal or correction (free)
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <DisclaimerNotice />
      </div>

      <div className="mt-8">
        <AttorneyCTA />
      </div>
    </div>
  );
}
