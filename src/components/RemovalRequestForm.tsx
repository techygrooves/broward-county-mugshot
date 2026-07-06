"use client";

import { useActionState } from "react";
import { submitRemovalRequest, FormState } from "@/lib/actions/public";

const initialState: FormState = { ok: false, message: "" };

const field =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";
const label = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";

export default function RemovalRequestForm({
  arrestId,
  arrestNumber,
}: {
  arrestId?: string;
  arrestNumber?: string;
}) {
  const [state, formAction, pending] = useActionState(submitRemovalRequest, initialState);

  if (state.ok) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-sm leading-relaxed text-green-900">
        <p className="font-semibold">Request received</p>
        <p className="mt-1">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="arrest_id" value={arrestId ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="requester_name" className={label}>Your name *</label>
          <input id="requester_name" name="requester_name" required className={field} />
        </div>
        <div>
          <label htmlFor="requester_email" className={label}>Your email *</label>
          <input id="requester_email" name="requester_email" type="email" required className={field} />
        </div>
        <div>
          <label htmlFor="requester_phone" className={label}>Phone (optional)</label>
          <input id="requester_phone" name="requester_phone" type="tel" className={field} />
        </div>
        <div>
          <label htmlFor="relationship_to_person" className={label}>Relationship to the person</label>
          <select id="relationship_to_person" name="relationship_to_person" className={field} defaultValue="">
            <option value="">Select…</option>
            <option value="self">This is my record</option>
            <option value="family">Family member</option>
            <option value="attorney">Attorney / legal representative</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="arrest_number" className={label}>Arrest / booking number (if known)</label>
          <input
            id="arrest_number"
            name="arrest_number"
            defaultValue={arrestNumber ?? ""}
            placeholder="Helps us find the exact record"
            className={field}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="proof_notes" className={label}>
            Supporting information (case outcome, sealing/expungement order, etc.)
          </label>
          <textarea
            id="proof_notes"
            name="proof_notes"
            rows={3}
            className={field}
            placeholder="e.g. Charges dismissed on 2026-03-01, case no. 26-001234; record expunged per court order"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="message" className={label}>Message *</label>
          <textarea
            id="message"
            name="message"
            rows={4}
            required
            className={field}
            placeholder="Tell us which record you want removed and why"
          />
        </div>
      </div>
      {state.message && !state.ok && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800 disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit Free Removal Request"}
      </button>
    </form>
  );
}
