import Link from "next/link";

interface PaginationProps {
  page: number;
  total: number;
  pageSize: number;
  basePath: string;
  params?: Record<string, string | undefined>;
}

export default function Pagination({ page, total, pageSize, basePath, params = {} }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const href = (p: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, value);
    }
    query.set("page", String(p));
    return `${basePath}?${query.toString()}`;
  };

  const button =
    "rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50";

  return (
    <nav className="mt-8 flex items-center justify-between" aria-label="Pagination">
      {page > 1 ? (
        <Link href={href(page - 1)} className={button}>← Previous</Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-slate-500">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={href(page + 1)} className={button}>Next →</Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
