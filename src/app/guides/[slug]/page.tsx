import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AttorneyCTA from "@/components/AttorneyCTA";
import { GUIDES, getGuide } from "@/lib/guides";

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return { title: "Guide Not Found" };
  return { title: guide.metaTitle, description: guide.description };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    dateModified: guide.updated,
    author: { "@type": "Organization", name: "Broward Arrest Records" },
    publisher: { "@type": "Organization", name: "Broward Arrest Records" },
    mainEntityOfPage: `${siteUrl}/guides/${guide.slug}`,
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav className="text-xs text-slate-500" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-brand-700">Home</Link>
        {" / "}
        <Link href="/guides" className="hover:text-brand-700">Resources</Link>
        {" / "}
        <span className="text-slate-700">{guide.title}</span>
      </nav>

      <article>
        <h1 className="mt-3 font-serif text-3xl font-bold leading-tight text-brand-950">
          {guide.title}
        </h1>
        <p className="mt-2 text-xs text-slate-400">
          Updated {guide.updated} · General information, not legal advice
        </p>
        {guide.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="mt-8 font-serif text-xl font-bold text-brand-900">
              {section.heading}
            </h2>
            {section.paragraphs.map((paragraph, i) => (
              <p key={i} className="mt-3 text-sm leading-relaxed text-slate-600">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </article>

      <div className="mt-10">
        <AttorneyCTA />
      </div>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <p className="text-sm font-semibold text-slate-800">More guides</p>
        <ul className="mt-2 space-y-1.5">
          {GUIDES.filter((g) => g.slug !== guide.slug).map((g) => (
            <li key={g.slug}>
              <Link
                href={`/guides/${g.slug}`}
                className="text-sm text-brand-700 hover:underline"
              >
                {g.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
