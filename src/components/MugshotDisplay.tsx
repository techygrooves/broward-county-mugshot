import { ArrestRecord } from "@/lib/types";
import { initials, shouldDisplayMugshots } from "@/lib/format";

const SIZES = {
  sm: "h-16 w-14 text-lg",
  lg: "h-44 w-36 text-4xl",
};

/**
 * Booking photo display policy: the official mugshot URL is stored on the
 * record, but the image is only rendered when NEXT_PUBLIC_DISPLAY_MUGSHOTS
 * is explicitly "true" AND the record's photo has not been hidden by an
 * approved removal request. Otherwise a neutral initials placeholder is
 * shown — no hotlinking by default.
 */
export default function MugshotDisplay({
  record,
  size = "sm",
}: {
  record: ArrestRecord;
  size?: "sm" | "lg";
}) {
  const showImage =
    shouldDisplayMugshots() && record.mugshot_url && !record.mugshot_hidden;

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={record.mugshot_url as string}
        alt={`Booking photo, ${record.full_name}`}
        className={`${SIZES[size]} shrink-0 rounded-md border border-slate-200 object-cover`}
        loading="lazy"
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`${SIZES[size]} flex shrink-0 items-center justify-center rounded-md bg-brand-50 font-serif font-bold text-brand-300`}
    >
      {initials(record)}
    </span>
  );
}
