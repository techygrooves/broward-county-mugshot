import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ArrestCard from "@/components/ArrestCard";
import AttorneyCTA from "@/components/AttorneyCTA";
import DemoBanner from "@/components/DemoBanner";
import Pagination from "@/components/Pagination";
import { COUNTY_BY_SLUG, getArrestsByCounty } from "@/lib/db";

export function generateStaticParams() {
  return Object.keys(COUNTY_BY_SLUG).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const county = COUNTY_BY_SLUG[slug];
  if (!county) return { title: "County Not Found" };
  return {
    title: `${county} County Arrest Records & Booking Information`,
    description: `Recent ${county} County, Florida arrest records and public booking information. An arrest is not a conviction.`,
  };
}

export default async function CountyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const county = COUNTY_BY_SLUG[slug];
  if (!county) notFound();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const result = await getArrestsByCounty(slug, page);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <nav className="text-xs text-slate-500" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-brand-700">Home</Link>
        {" / "}
        <span className="text-slate-700">{county} County</span>
      </nav>
      <h1 className="mt-3 font-serif text-3xl font-bold text-brand-950">
        {county} County Arrest Records
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
        Recent {county} County, Florida public booking information. An arrest
        does not mean the person was convicted — verify details against the
        official source linked on each record.
      </p>

      <div className="mt-4">
        <DemoBanner show={result.isDemo} />
      </div>

      {result.records.length > 0 ? (
        <>
          <p className="mt-6 text-sm text-slate-500">
            {result.total} record{result.total === 1 ? "" : "s"} in {county} County
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
            basePath={`/county/${slug}`}
          />
        </>
      ) : (
        <p className="mt-8 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
          No {county} County records are available yet.
        </p>
      )}

      <div className="mt-12">
        <AttorneyCTA />
      </div>
    </div>
  );
}
