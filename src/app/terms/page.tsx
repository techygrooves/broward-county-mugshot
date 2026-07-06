import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Terms of use for Broward Arrest Records.",
};

const h2 = "mt-8 font-serif text-xl font-bold text-brand-900";
const p = "mt-3 text-sm leading-relaxed text-slate-600";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-bold text-brand-950">Terms of Use</h1>
      <p className={p}>Last updated: July 6, 2026</p>

      <h2 className={h2}>Acceptance</h2>
      <p className={p}>
        By using this website you agree to these terms. If you do not agree,
        do not use the site.
      </p>

      <h2 className={h2}>Nature of the information</h2>
      <p className={p}>
        This site republishes public arrest and booking information from
        official Broward Sheriff&apos;s Office sources. An arrest does not mean
        the person was convicted. Every person is presumed innocent unless and
        until proven guilty in a court of law. Information may be incomplete,
        outdated, or contain errors; the official source always controls.
      </p>

      <h2 className={h2}>Prohibited uses</h2>
      <p className={p}>
        You may not use this site: (a) for employment, tenant, credit, or
        insurance screening or any purpose covered by the Fair Credit Reporting
        Act — this site is not a consumer reporting agency; (b) to harass,
        stalk, threaten, or intimidate any person; (c) to charge others for
        removal of information from this site; or (d) to scrape the site in a
        manner that degrades service.
      </p>

      <h2 className={h2}>Free removal</h2>
      <p className={p}>
        Removal requests are always free. We will never solicit or accept a
        fee to remove a booking photograph or arrest record, consistent with
        Florida Statute 943.0593.
      </p>

      <h2 className={h2}>No legal advice</h2>
      <p className={p}>
        Content on this site is general information, not legal advice, and
        does not create an attorney-client relationship. Consult a licensed
        Florida attorney about your specific situation.
      </p>

      <h2 className={h2}>Disclaimer of warranties; limitation of liability</h2>
      <p className={p}>
        The site is provided &quot;as is&quot; without warranties of any kind.
        To the maximum extent permitted by law, we are not liable for any
        damages arising from use of the site or reliance on its content.
      </p>

      <h2 className={h2}>Changes</h2>
      <p className={p}>
        We may update these terms at any time; continued use constitutes
        acceptance of the updated terms.
      </p>
    </div>
  );
}
