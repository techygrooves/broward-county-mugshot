import { redirect } from "next/navigation";
import AdminLoginForm from "@/components/AdminLoginForm";
import { isAdminAuthenticated, isAdminConfigured } from "@/lib/admin-auth";

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) redirect("/admin");
  return (
    <div className="mx-auto max-w-sm">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-serif text-lg font-bold text-brand-900">Admin login</h2>
        <p className="mt-1 text-sm text-slate-500">
          Enter the admin password to manage records, imports, and removal
          requests.
        </p>
        {!isAdminConfigured() && (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            ADMIN_PASSWORD is not set. Add it to <code>.env.local</code> (see
            <code> .env.example</code>) and restart the server to enable admin
            access.
          </p>
        )}
        <div className="mt-4">
          <AdminLoginForm />
        </div>
      </div>
    </div>
  );
}
