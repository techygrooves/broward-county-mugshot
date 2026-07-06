"use client";

import { useActionState } from "react";
import {
  ActionState,
  createRecordAction,
  importCsvAction,
} from "@/lib/actions/admin";

const initialState: ActionState = { ok: false, message: "" };
const field =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";
const label = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";

function StatusMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p
      className={`rounded-md border px-4 py-3 text-sm ${
        state.ok
          ? "border-green-200 bg-green-50 text-green-900"
          : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      {state.message}
    </p>
  );
}

export function CsvImportForm() {
  const [state, formAction, pending] = useActionState(importCsvAction, initialState);
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="file" className={label}>CSV file</label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-800"
        />
      </div>
      <StatusMessage state={state} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
      >
        {pending ? "Importing…" : "Upload & Import"}
      </button>
    </form>
  );
}

export function ManualRecordForm() {
  const [state, formAction, pending] = useActionState(createRecordAction, initialState);
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor="m_arrest_number" className={label}>Arrest number *</label>
          <input id="m_arrest_number" name="arrest_number" required className={field} />
        </div>
        <div>
          <label htmlFor="m_first_name" className={label}>First name</label>
          <input id="m_first_name" name="first_name" className={field} />
        </div>
        <div>
          <label htmlFor="m_middle_name" className={label}>Middle name</label>
          <input id="m_middle_name" name="middle_name" className={field} />
        </div>
        <div>
          <label htmlFor="m_last_name" className={label}>Last name</label>
          <input id="m_last_name" name="last_name" className={field} />
        </div>
        <div>
          <label htmlFor="m_sex" className={label}>Sex</label>
          <select id="m_sex" name="sex" className={field} defaultValue="">
            <option value="">Unknown</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </div>
        <div>
          <label htmlFor="m_age" className={label}>Age at booking</label>
          <input id="m_age" name="age" type="number" min={0} className={field} />
        </div>
        <div>
          <label htmlFor="m_booking_date" className={label}>Booking date</label>
          <input id="m_booking_date" name="booking_date" type="date" className={field} />
        </div>
        <div>
          <label htmlFor="m_arrest_date" className={label}>Arrest date</label>
          <input id="m_arrest_date" name="arrest_date" type="date" className={field} />
        </div>
        <div>
          <label htmlFor="m_location" className={label}>Location</label>
          <input id="m_location" name="location" placeholder="City, FL" className={field} />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label htmlFor="m_charges" className={label}>
            Charges — format: description | statute | bond, separated by semicolons
          </label>
          <textarea
            id="m_charges"
            name="charges"
            rows={2}
            placeholder="Driving under the influence | 316.193 | $1,000; Resisting without violence | 843.02 | $500"
            className={field}
          />
        </div>
        <div>
          <label htmlFor="m_bond_total" className={label}>Total bond</label>
          <input id="m_bond_total" name="bond_total" placeholder="$1,500" className={field} />
        </div>
        <div>
          <label htmlFor="m_mugshot_url" className={label}>Mugshot URL (official only)</label>
          <input id="m_mugshot_url" name="mugshot_url" type="url" className={field} />
        </div>
        <div>
          <label htmlFor="m_official_detail_url" className={label}>Official detail URL</label>
          <input
            id="m_official_detail_url"
            name="official_detail_url"
            type="url"
            placeholder="https://bookingblotter.sheriff.org/app/"
            className={field}
          />
        </div>
      </div>
      <StatusMessage state={state} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save as Pending Record"}
      </button>
    </form>
  );
}
