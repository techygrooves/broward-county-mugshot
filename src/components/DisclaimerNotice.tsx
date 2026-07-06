/** Required disclaimer shown on every arrest detail page. */
export default function DisclaimerNotice() {
  return (
    <div
      role="note"
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900"
    >
      This information comes from public arrest records. An arrest does not
      mean the person was convicted. Information may change or contain errors.
      Check the official Broward Sheriff source for the latest record.
    </div>
  );
}
