import type { Metadata } from "next";
import Link from "next/link";
import { GUIDES } from "@/lib/guides";

export const metadata: Metadata = {
  title: "Broward Arrest & Record Resources — Legal Information Guides",
  description:
    "Guides on Broward County arrests, mugshot removal rights in Florida, record sealing and expungement, and finding criminal defense help.",
};

export default function GuidesIndexPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-bold text-brand-950">
        Legal Information Guides
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
        Plain-language guides about Broward County arrest records, your rights
        under Florida law, and where to find help. General information only —
        not legal advice.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {GUIDES.map((guide) => (
          <Link
            key={guide.slug}
            href={`/guides/${guide.slug}`}
            className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <h2 className="font-serif text-lg font-bold text-brand-900 group-hover:text-brand-700">
              {guide.title}
            </h2>
            <p className="mt-2 line-clamp-3 text-sm text-slate-600">
              {guide.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
