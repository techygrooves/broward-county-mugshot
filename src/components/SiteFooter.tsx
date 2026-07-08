import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <p className="font-serif text-base font-bold text-brand-900">
              Broward Arrest Records
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              An independent public-records resource organizing official
              Broward Sheriff&apos;s Office booking information. Not affiliated
              with the Broward Sheriff&apos;s Office or any government agency.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Explore</p>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
              <li><Link className="hover:text-brand-700" href="/recent-arrests">Recent Arrest Records</Link></li>
              <li><Link className="hover:text-brand-700" href="/county/broward">Broward County Arrests</Link></li>
              <li><Link className="hover:text-brand-700" href="/county/palm-beach">Palm Beach County Arrests</Link></li>
              <li><Link className="hover:text-brand-700" href="/search">Arrest Search</Link></li>
              <li><Link className="hover:text-brand-700" href="/charges">Browse by Charge</Link></li>
              <li><Link className="hover:text-brand-700" href="/guides">Legal Information Guides</Link></li>
              <li><Link className="hover:text-brand-700" href="/remove-mugshot">Free Removal Request</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Legal</p>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
              <li><Link className="hover:text-brand-700" href="/privacy">Privacy Policy</Link></li>
              <li><Link className="hover:text-brand-700" href="/terms">Terms of Use</Link></li>
              <li><Link className="hover:text-brand-700" href="/disclaimer">Disclaimer</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-slate-200 pt-6 text-xs leading-relaxed text-slate-500">
          <p>
            All information on this site comes from public arrest records. An
            arrest does not mean the person was convicted; every person is
            presumed innocent unless proven guilty in court. Information may
            change or contain errors — verify against the official{" "}
            <a
              href="https://bookingblotter.sheriff.org/app/"
              rel="nofollow noopener"
              className="underline hover:text-brand-700"
            >
              Broward Sheriff&apos;s Office source
            </a>{" "}
            for the latest record. This site does not provide legal advice and
            must not be used for employment, tenant, or credit screening under
            the Fair Credit Reporting Act. Removal requests are always free.
          </p>
          <p className="mt-3">
            © {new Date().getFullYear()} Broward Arrest Records. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
