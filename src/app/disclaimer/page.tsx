import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Disclaimer",
  description:
    "Disclaimer for Broward Arrest Records: arrest information comes from public records, an arrest is not a conviction, and information may change or contain errors.",
};

const h2 = "mt-8 font-serif text-xl font-bold text-brand-900";
const p = "mt-3 text-sm leading-relaxed text-slate-600";

export default function DisclaimerPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-bold text-brand-950">Disclaimer</h1>

      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-900">
        This information comes from public arrest records. An arrest does not
        mean the person was convicted. Information may change or contain
        errors. Check the official Broward Sheriff source for the latest
        record.
      </div>

      <h2 className={h2}>Presumption of innocence</h2>
      <p className={p}>
        Every person listed on this site is presumed innocent unless and until
        proven guilty in a court of law. Booking charges are frequently
        amended, reduced, dismissed, or never formally filed by the State
        Attorney.
      </p>

      <h2 className={h2}>Not an official source</h2>
      <p className={p}>
        This website is independent and is not affiliated with, endorsed by, or
        operated by the Broward Sheriff&apos;s Office or any government agency.
        The authoritative record is always the official Broward Sheriff&apos;s
        Office source linked from each record page.
      </p>

      <h2 className={h2}>Not a consumer reporting agency</h2>
      <p className={p}>
        This site is not a consumer reporting agency as defined by the Fair
        Credit Reporting Act (FCRA), and its information must not be used for
        employment, tenant, credit, insurance, or similar eligibility
        decisions.
      </p>

      <h2 className={h2}>Not legal advice</h2>
      <p className={p}>
        Nothing on this site is legal advice. Consult a licensed Florida
        attorney about your specific situation.
      </p>

      <h2 className={h2}>Corrections and removal</h2>
      <p className={p}>
        If information about you is outdated, incorrect, sealed, or expunged,
        submit a{" "}
        <Link href="/remove-mugshot" className="font-semibold text-brand-700 underline">
          free removal request
        </Link>
        . We never charge for removal.
      </p>
    </div>
  );
}
