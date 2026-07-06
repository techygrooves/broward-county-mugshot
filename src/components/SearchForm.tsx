interface SearchFormProps {
  compact?: boolean;
  defaults?: Record<string, string | undefined>;
}

/** GET form targeting /search — works without client-side JavaScript. */
export default function SearchForm({ compact = false, defaults = {} }: SearchFormProps) {
  const field =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";
  return (
    <form action="/search" method="get" className="w-full">
      <div className={`grid gap-3 ${compact ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        <div>
          <label htmlFor="first_name" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            First name
          </label>
          <input id="first_name" name="first_name" defaultValue={defaults.first_name} placeholder="e.g. John" className={field} />
        </div>
        <div>
          <label htmlFor="last_name" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Last name
          </label>
          <input id="last_name" name="last_name" defaultValue={defaults.last_name} placeholder="e.g. Smith" className={field} />
        </div>
        <div>
          <label htmlFor="arrest_number" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Arrest number
          </label>
          <input id="arrest_number" name="arrest_number" defaultValue={defaults.arrest_number} placeholder="Booking / arrest no." className={field} />
        </div>
        <div>
          <label htmlFor="charge" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Charge
          </label>
          <input id="charge" name="charge" defaultValue={defaults.charge} placeholder="e.g. DUI, battery" className={field} />
        </div>
        <div>
          <label htmlFor="booking_date_from" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Booked from
          </label>
          <input id="booking_date_from" name="booking_date_from" type="date" defaultValue={defaults.booking_date_from} className={field} />
        </div>
        <div>
          <label htmlFor="booking_date_to" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Booked to
          </label>
          <input id="booking_date_to" name="booking_date_to" type="date" defaultValue={defaults.booking_date_to} className={field} />
        </div>
      </div>
      <button
        type="submit"
        className="mt-4 w-full rounded-md bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800 sm:w-auto"
      >
        Search Broward Arrest Records
      </button>
    </form>
  );
}
