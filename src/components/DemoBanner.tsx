export default function DemoBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
      <strong>Preview mode:</strong> Supabase is not configured, so the
      records below are fictional sample data used to demonstrate the layout.
      Connect a database (see README) to load real Broward County booking
      information.
    </div>
  );
}
