import { changeDescription } from '../../lib/breakdown-table';

/** The Change column's tooltip: what it compares, and both ranges' dates. */
export function BreakdownChangeDescription({ window }: { window: { start: Date; end: Date } }) {
  const { summary, current, previous } = changeDescription(window);
  return (
    <span className="grid gap-1">
      <span>{summary}</span>
      <span className="tabular-nums">{current}</span>
      <span className="tabular-nums">{previous}</span>
    </span>
  );
}
