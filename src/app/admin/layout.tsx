import type { Metadata } from "next";
import Link from "next/link";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { logoutAction } from "@/lib/actions/admin";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

// Admin pages depend on the session cookie and live database state; never
// prerender them (a static build without ADMIN_PASSWORD would bake in the
// login redirect).
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/records", label: "Manage Records" },
  { href: "/admin/removal-requests", label: "Removal Requests" },
  { href: "/admin/scraper-runs", label: "Scraper Runs" },
  { href: "/admin/import", label: "Import" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authed = await isAdminAuthenticated();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <h1 className="font-serif text-xl font-bold text-brand-950">
          Site Administration
        </h1>
        {authed && (
          <div className="flex flex-wrap items-center gap-4">
            <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-slate-600">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-brand-700">
                  {item.label}
                </Link>
              ))}
            </nav>
            <form action={logoutAction}>
              <button className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                Log out
              </button>
            </form>
          </div>
        )}
      </div>
      <div className="py-6">{children}</div>
    </div>
  );
}
