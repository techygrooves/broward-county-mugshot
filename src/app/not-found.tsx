import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent-600">
        404
      </p>
      <h1 className="mt-2 font-serif text-3xl font-bold text-brand-950">
        Page or record not found
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600">
        The record may have been removed following an approved removal
        request, or the address may be incorrect.
      </p>
      <div className="mt-6 flex justify-center gap-3 text-sm font-medium">
        <Link href="/" className="rounded-md bg-brand-700 px-4 py-2 text-white hover:bg-brand-800">
          Go home
        </Link>
        <Link href="/search" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50">
          Search records
        </Link>
      </div>
    </div>
  );
}
