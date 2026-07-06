import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import {
  approveRemovalRequest,
  rejectRemovalRequest,
} from "@/lib/actions/admin";
import { getRemovalRequests } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { RemovalRequestStatus } from "@/lib/types";

const STATUS_STYLES: Record<RemovalRequestStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-slate-200 text-slate-600",
};

export default async function RemovalRequestsPage() {
  await requireAdmin();
  const { requests, isDemo } = await getRemovalRequests();

  const grouped: RemovalRequestStatus[] = ["pending", "approved", "rejected"];

  return (
    <div>
      <h2 className="font-serif text-lg font-bold text-brand-900">Removal requests</h2>
      <p className="mt-1 text-sm text-slate-500">
        All requests are free. Approving hides the record (or just its photo)
        and adds it to the suppression list so the scraper never re-publishes
        it.
      </p>
      {isDemo && (
        <p className="mt-4 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Supabase is not configured — no removal requests to display.
        </p>
      )}

      {grouped.map((status) => {
        const items = requests.filter((r) => r.status === status);
        return (
          <section key={status} className="mt-8">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {status} ({items.length})
            </h3>
            {items.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">None.</p>
            ) : (
              <div className="mt-3 space-y-4">
                {items.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {request.requester_name}{" "}
                          <span className="font-normal text-slate-500">
                            &lt;{request.requester_email}&gt;
                          </span>
                          {request.requester_phone ? (
                            <span className="font-normal text-slate-500">
                              {" "}· {request.requester_phone}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {formatDateTime(request.created_at)} · relationship:{" "}
                          {request.relationship_to_person ?? "not stated"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[request.status]}`}
                      >
                        {request.status}
                      </span>
                    </div>

                    {request.arrest ? (
                      <p className="mt-3 text-sm text-slate-600">
                        Record:{" "}
                        <Link
                          href={`/arrest/${request.arrest.id}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {request.arrest.full_name} ({request.arrest.arrest_number})
                        </Link>
                        {request.arrest.is_hidden && (
                          <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600">
                            hidden
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">
                        Record: not linked — identify it from the message below.
                      </p>
                    )}

                    {request.message && (
                      <p className="mt-2 whitespace-pre-line rounded-md bg-slate-50 p-3 text-sm text-slate-600">
                        {request.message}
                      </p>
                    )}
                    {request.proof_notes && (
                      <p className="mt-2 text-sm text-slate-600">
                        <span className="font-medium">Supporting info:</span>{" "}
                        {request.proof_notes}
                      </p>
                    )}

                    {request.status === "pending" && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <form action={approveRemovalRequest}>
                          <input type="hidden" name="request_id" value={request.id} />
                          <input type="hidden" name="mode" value="record" />
                          <button className="rounded-md bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800">
                            Approve — hide record
                          </button>
                        </form>
                        <form action={approveRemovalRequest}>
                          <input type="hidden" name="request_id" value={request.id} />
                          <input type="hidden" name="mode" value="mugshot" />
                          <button className="rounded-md border border-brand-300 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50">
                            Approve — hide photo only
                          </button>
                        </form>
                        <form action={rejectRemovalRequest}>
                          <input type="hidden" name="request_id" value={request.id} />
                          <button className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                            Reject
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
