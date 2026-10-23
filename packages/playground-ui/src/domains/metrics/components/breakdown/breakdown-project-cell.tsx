/** The Project column's cell at org scope: the project's colour, when the page gives one, and its name. */
export function BreakdownProjectCell({ name, color }: { name: string; color?: string }) {
  return (
    <span title={name}>
      {color && (
        <span
          aria-hidden
          className="mr-2 inline-block size-2 rounded-[2px] align-middle"
          style={{ backgroundColor: color }}
        />
      )}
      {name}
    </span>
  );
}
