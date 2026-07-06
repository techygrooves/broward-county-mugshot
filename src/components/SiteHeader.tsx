import Link from "next/link";

const NAV = [
  { href: "/recent-arrests", label: "Recent Arrests" },
  { href: "/search", label: "Arrest Search" },
  { href: "/charges", label: "Charges" },
  { href: "/guides", label: "Resources" },
  { href: "/remove-mugshot", label: "Request Removal" },
];

export default function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-800 font-serif text-lg font-bold text-white">
            B
          </span>
          <span>
            <span className="block font-serif text-lg font-bold leading-tight text-brand-900">
              Broward Arrest Records
            </span>
            <span className="block text-xs text-slate-500">
              Public Booking Information · Broward County, FL
            </span>
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-slate-600">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-brand-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
