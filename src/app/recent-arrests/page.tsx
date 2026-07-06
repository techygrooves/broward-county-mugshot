import type { Metadata } from "next";
import ArrestCard from "@/components/ArrestCard";
import AttorneyCTA from "@/components/AttorneyCTA";
import DemoBanner from "@/components/DemoBanner";
import Pagination from "@/components/Pagination";
import { searchArrests } from "@/lib/db";

export const metadata: Metadata = {
  title: "Recent Broward Arrests — Daily Broward County Booking Information",
  description:
    "Daily listing of recent Broward County arrest records and public booking information from the official Broward Sheriff's Office source.",
};

export default async function RecentArrestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const result = await searchArrests({ page });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-bold text-brand-950">
        Recent Broward Arrest Records
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
        Recent Broward County booking information, updated on a daily schedule
        from official Broward Sheriff&apos;s Office public records. An arrest
        does not mean the person was convicted — verify details against the
        official source linked on each record.
      </p>
      <div className="mt-4">
        <DemoBanner show={result.isDemo} />
      </div>

      {result.records.length > 0 ? (
        <>
          <p className="mt-6 text-sm text-slate-500">
            {result.total} record{result.total === 1 ? "" : "s"} available
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.records.map((record) => (
              <ArrestCard key={record.id} record={record} />
            ))}
          </div>
          <Pagination
            page={result.page}
            total={result.total}
            pageSize={result.pageSize}
            basePath="/recent-arrests"
          />
        </>
      ) : (
        <p className="mt-8 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
          No records are available yet. Records appear here after the daily
          data refresh or a manual import by the site operator.
        </p>
      )}

      <div className="mt-12">
        <AttorneyCTA />
      </div>
    </div>
  );
}
