import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for Broward Arrest Records.",
};

const h2 = "mt-8 font-serif text-xl font-bold text-brand-900";
const p = "mt-3 text-sm leading-relaxed text-slate-600";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-bold text-brand-950">Privacy Policy</h1>
      <p className={p}>Last updated: July 6, 2026</p>

      <h2 className={h2}>What this site is</h2>
      <p className={p}>
        Broward Arrest Records is an independent public-records resource that
        organizes booking information published by the Broward Sheriff&apos;s
        Office. We are not affiliated with any government agency.
      </p>

      <h2 className={h2}>Information we collect from visitors</h2>
      <p className={p}>
        We collect only what is needed to operate the site: standard server
        logs (IP address, user agent, pages requested) and the information you
        voluntarily submit through the removal request form (name, email,
        phone, relationship to the person, and your message). We do not sell
        visitor information.
      </p>

      <h2 className={h2}>Arrest record information</h2>
      <p className={p}>
        Arrest records displayed on this site come from official public
        records of the Broward Sheriff&apos;s Office. Each record links to its
        official source. We honor free removal requests and maintain a
        suppression list to prevent re-publication of removed records.
      </p>

      <h2 className={h2}>Cookies</h2>
      <p className={p}>
        The public site does not use tracking cookies. A single session cookie
        is used to authenticate site administrators.
      </p>

      <h2 className={h2}>Your choices</h2>
      <p className={p}>
        You may request removal or correction of a record about you at any
        time, free of charge, via the removal request page. You may also ask us
        to delete removal-request correspondence after your request is
        resolved.
      </p>

      <h2 className={h2}>Contact</h2>
      <p className={p}>
        Questions about this policy can be sent through the removal request
        form on this site.
      </p>
    </div>
  );
}
