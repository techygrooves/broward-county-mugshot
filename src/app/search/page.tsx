import type { Metadata } from "next";
import ArrestCard from "@/components/ArrestCard";
import AttorneyCTA from "@/components/AttorneyCTA";
import DemoBanner from "@/components/DemoBanner";
import Pagination from "@/components/Pagination";
import SearchForm from "@/components/SearchForm";
import { searchArrests } from "@/lib/db";

export const metadata: Metadata = {
  title: "Broward County Arrest Search — Search Public Booking Records",
  description:
    "Search Broward County arrest records by name, arrest number, charge, or booking date. Free public booking information from official Broward Sheriff's Office sources.",
};

interface SearchPageParams {
  first_name?: string;
  last_name?: string;
  arrest_number?: string;
  charge?: string;
  booking_date_from?: string;
  booking_date_to?: string;
  page?: string;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchPageParams>;
}) {
  const params = await searchParams;
  const hasQuery = Boolean(
    params.first_name ||
      params.last_name ||
      params.arrest_number ||
      params.charge ||
      params.booking_date_from ||
      params.booking_date_to
  );
  const page = Math.max(1, Number(params.page) || 1);
  const result = hasQuery
    ? await searchArrests({
        first_name: params.first_name,
        last_name: params.last_name,
        arrest_number: params.arrest_number,
        charge: params.charge,
        booking_date_from: params.booking_date_from,
        booking_date_to: params.booking_date_to,
        page,
      })
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-bold text-brand-950">
        Broward County Arrest Search
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
        Search public Broward County booking information by name, arrest
        number, charge, or booking date. For the authoritative record, always
        check the official Broward Sheriff&apos;s Office search tools.
      </p>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <SearchForm
          defaults={{
            first_name: params.first_name,
            last_name: params.last_name,
            arrest_number: params.arrest_number,
            charge: params.charge,
            booking_date_from: params.booking_date_from,
            booking_date_to: params.booking_date_to,
          }}
        />
      </div>

      {result && (
        <section className="mt-8" aria-live="polite">
          <DemoBanner show={result.isDemo} />
          <p className="mt-4 text-sm text-slate-500">
            {result.total} matching record{result.total === 1 ? "" : "s"}
          </p>
          {result.records.length > 0 ? (
            <>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {result.records.map((record) => (
                  <ArrestCard key={record.id} record={record} />
                ))}
              </div>
              <Pagination
                page={result.page}
                total={result.total}
                pageSize={result.pageSize}
                basePath="/search"
                params={{
                  first_name: params.first_name,
                  last_name: params.last_name,
                  arrest_number: params.arrest_number,
                  charge: params.charge,
                  booking_date_from: params.booking_date_from,
                  booking_date_to: params.booking_date_to,
                }}
              />
            </>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No records matched your search. Try fewer filters, or check the
              official Broward Sheriff&apos;s Office arrest search for the most
              current data.
            </p>
          )}
        </section>
      )}

      <div className="mt-12">
        <AttorneyCTA />
      </div>
    </div>
  );
}
