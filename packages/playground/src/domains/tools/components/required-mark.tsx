/** Same marker as a required form label (`FieldBlock.Label`), so the schema and the form read alike. */
export function RequiredMark() {
  return (
    <>
      <span aria-hidden className="ml-0.5 text-destructive-indicator">
        *
      </span>
      <span className="sr-only"> (required)</span>
    </>
  );
}
