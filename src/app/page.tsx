import Link from "next/link";
import type { Metadata } from "next";
import SearchForm from "@/components/SearchForm";
import ArrestCard from "@/components/ArrestCard";
import AttorneyCTA from "@/components/AttorneyCTA";
import DemoBanner from "@/components/DemoBanner";
import { getRecentArrests } from "@/lib/db";
import { CHARGE_CATEGORIES } from "@/lib/charges";
import { GUIDES } from "@/lib/guides";

export const metadata: Metadata = {
  title: "Broward County Arrest Search — Recent Broward Arrest Records",
  description:
    "Free Broward County arrest search. Browse recent Broward arrest records and public booking information from the official Broward Sheriff's Office source.",
};

export const revalidate = 300;

export default async function HomePage() {
  const { records, isDemo } = await getRecentArrests(9);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Broward Arrest Records",
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/search?last_name={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero + search */}
      <section className="border-b border-slate-200 bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent-600">
              Public Arrest Information
            </p>
            <h1 className="mt-3 font-serif text-3xl font-bold leading-tight text-brand-950 sm:text-4xl">
              Broward County Arrest Records &amp; Booking Information
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              Search recent Broward County booking information sourced from
              official Broward Sheriff&apos;s Office public records. An arrest
              is not a conviction — every person is presumed innocent unless
              proven guilty in court.
            </p>
          </div>
          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-serif text-lg font-bold text-brand-900">
              Broward County Arrest Search
            </h2>
            <SearchForm />
          </div>
        </div>
      </section>

      {/* Recent arrests */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-serif text-2xl font-bold text-brand-950">
              Recent Broward Arrest Records
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              The latest public booking information available to this site.
            </p>
          </div>
          <Link
            href="/recent-arrests"
            className="hidden text-sm font-semibold text-brand-700 hover:text-brand-800 sm:block"
          >
            View all →
          </Link>
        </div>
        <div className="mt-3">
          <DemoBanner show={isDemo} />
        </div>
        {records.length > 0 ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {records.map((record) => (
              <ArrestCard key={record.id} record={record} />
            ))}
          </div>
        ) : (
          <p className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            No records are available yet. Records appear here after the daily
            data refresh or a manual import.
          </p>
        )}
        <div className="mt-6 sm:hidden">
          <Link href="/recent-arrests" className="text-sm font-semibold text-brand-700">
            View all recent arrests →
          </Link>
        </div>
      </section>

      {/* Charge categories */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="font-serif text-2xl font-bold text-brand-950">
            Browse Broward Booking Information by Charge
          </h2>
          <div className="mt-6 flex flex-wrap gap-2">
            {CHARGE_CATEGORIES.map((category) => (
              <Link
                key={category.slug}
                href={`/charges/${category.slug}`}
                className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-brand-400 hover:text-brand-700"
              >
                {category.shortName}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA + guides */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-2">
          <AttorneyCTA />
          <div>
            <h2 className="font-serif text-xl font-bold text-brand-950">
              Know Your Rights &amp; Resources
            </h2>
            <ul className="mt-4 space-y-3">
              {GUIDES.slice(0, 5).map((guide) => (
                <li key={guide.slug}>
                  <Link
                    href={`/guides/${guide.slug}`}
                    className="text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline"
                  >
                    {guide.title} →
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm text-slate-500">
              Need something corrected or removed?{" "}
              <Link href="/remove-mugshot" className="font-semibold text-brand-700 hover:underline">
                Submit a free removal request
              </Link>
              . We never charge for removal — Florida law prohibits it, and we
              support that policy.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
