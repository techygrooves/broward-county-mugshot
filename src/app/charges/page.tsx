import type { Metadata } from "next";
import Link from "next/link";
import { CHARGE_CATEGORIES } from "@/lib/charges";

export const metadata: Metadata = {
  title: "Browse Broward Arrest Records by Charge Type",
  description:
    "Browse Broward County public booking information by charge category: DUI, battery, domestic violence, theft, drug charges, and more.",
};

export default function ChargesIndexPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-bold text-brand-950">
        Broward Booking Information by Charge
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
        Public arrest records grouped by common Florida charge categories.
        Charges listed at booking are frequently amended, reduced, or dropped —
        an arrest does not mean the person was convicted.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CHARGE_CATEGORIES.map((category) => (
          <Link
            key={category.slug}
            href={`/charges/${category.slug}`}
            className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <h2 className="font-serif text-lg font-bold text-brand-900 group-hover:text-brand-700">
              {category.shortName}
            </h2>
            <p className="mt-2 line-clamp-3 text-sm text-slate-600">
              {category.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
