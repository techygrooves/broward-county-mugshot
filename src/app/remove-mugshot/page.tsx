import type { Metadata } from "next";
import Link from "next/link";
import RemovalRequestForm from "@/components/RemovalRequestForm";

export const metadata: Metadata = {
  title: "Free Mugshot & Record Removal Request — Broward County",
  description:
    "Request removal of a Broward County arrest record or booking photo from this website, free of charge. Florida law prohibits charging for mugshot removal, and we support that policy.",
};

export default async function RemoveMugshotPage({
  searchParams,
}: {
  searchParams: Promise<{ arrest_id?: string; arrest_number?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-bold text-brand-950">
        Request Removal of a Record or Booking Photo
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
        Removal requests on this website are <strong>always free</strong>.
        Florida law (Fla. Stat. § 943.0593) prohibits charging fees to remove
        arrest booking photographs, and we support that policy. Every request
        is reviewed by a person. If approved, the record or photo is hidden and
        added to a suppression list so future data updates do not re-publish it.
      </p>

      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
        <strong>Beware of paid “removal services.”</strong> You never need to
        pay this website — or anyone — to complete this process here. Removal
        from this site does not change the official government record; for
        that, see our guide on{" "}
        <Link href="/guides/record-sealing-vs-expungement-florida" className="font-semibold underline">
          sealing and expungement in Florida
        </Link>.
      </div>

      <h2 className="mt-8 font-serif text-xl font-bold text-brand-900">
        Good reasons for removal
      </h2>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
        <li>Charges were dropped, dismissed, or never filed</li>
        <li>You were found not guilty</li>
        <li>The record was sealed or expunged by a court</li>
        <li>Mistaken identity or inaccurate information</li>
        <li>Safety, harassment, or similar personal-safety concerns</li>
      </ul>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <RemovalRequestForm
          arrestId={params.arrest_id}
          arrestNumber={params.arrest_number}
        />
      </div>

      <p className="mt-6 text-xs leading-relaxed text-slate-500">
        We aim to review requests promptly. Submitting a request does not
        guarantee removal, but documented outcomes (dismissals, sealing or
        expungement orders, proof of mistaken identity) are routinely approved.
        This page is not legal advice.
      </p>
    </div>
  );
}
