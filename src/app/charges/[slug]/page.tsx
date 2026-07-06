import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ArrestCard from "@/components/ArrestCard";
import AttorneyCTA from "@/components/AttorneyCTA";
import DemoBanner from "@/components/DemoBanner";
import Pagination from "@/components/Pagination";
import { CHARGE_CATEGORIES, getCategory } from "@/lib/charges";
import { getArrestsByCategory } from "@/lib/db";

export function generateStaticParams() {
  return CHARGE_CATEGORIES.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) return { title: "Charge Category Not Found" };
  return {
    title: `${category.name} — Public Booking Records`,
    description: category.description,
  };
}

export default async function ChargeCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const result = await getArrestsByCategory(slug, page);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <nav className="text-xs text-slate-500" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-brand-700">Home</Link>
        {" / "}
        <Link href="/charges" className="hover:text-brand-700">Charges</Link>
        {" / "}
        <span className="text-slate-700">{category.shortName}</span>
      </nav>
      <h1 className="mt-3 font-serif text-3xl font-bold text-brand-950">
        {category.name}
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
        {category.description} An arrest does not mean the person was
        convicted; charges are often amended or dropped.
      </p>

      <div className="mt-4">
        <DemoBanner show={result.isDemo} />
      </div>

      {result.records.length > 0 ? (
        <>
          <p className="mt-6 text-sm text-slate-500">
            {result.total} record{result.total === 1 ? "" : "s"} in this category
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
            basePath={`/charges/${slug}`}
          />
        </>
      ) : (
        <p className="mt-8 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
          No records in this category right now. Check back after the next
          daily data refresh.
        </p>
      )}

      <div className="mt-12">
        <AttorneyCTA />
      </div>
    </div>
  );
}
