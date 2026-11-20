import type { BoardSourceOption } from '../boardSourceFilters';

/** Brand colors belong to the SVG mark, independent of menu highlight colors. */
export function BoardSourceIcon({ option: { Icon, color } }: { option: BoardSourceOption }) {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center" style={{ color }} aria-hidden>
      <Icon className="size-4" />
    </span>
  );
}
