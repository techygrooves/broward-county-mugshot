import Link from "next/link";

/** Soft, informational attorney call-to-action. */
export default function AttorneyCTA() {
  return (
    <aside className="rounded-lg border border-brand-100 bg-brand-50 p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent-600">
        Legal Help
      </p>
      <h2 className="mt-2 font-serif text-lg font-bold text-brand-900">
        Arrested in Broward County? You may have legal options.
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Speak with a Florida criminal defense attorney about your case, record
        sealing, expungement, and online record concerns. Early advice can make
        a meaningful difference — many attorneys offer free consultations.
      </p>
      <div className="mt-4 flex flex-wrap gap-3 text-sm font-medium">
        <Link
          href="/guides/broward-criminal-defense-help"
          className="rounded-md bg-brand-700 px-4 py-2 text-white transition-colors hover:bg-brand-800"
        >
          Find Defense Help
        </Link>
        <Link
          href="/guides/record-sealing-vs-expungement-florida"
          className="rounded-md border border-brand-200 bg-white px-4 py-2 text-brand-700 transition-colors hover:bg-brand-100"
        >
          Sealing &amp; Expungement
        </Link>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        This website is not a law firm and does not provide legal advice.
      </p>
    </aside>
  );
}
