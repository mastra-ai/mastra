import { changeDescription } from '../../lib/breakdown-table';

/** The % Change column's tooltip: which figure it compares, and both ranges' dates. */
export function BreakdownChangeDescription({ window, label }: { window: { start: Date; end: Date }; label: string }) {
  const { summary, current, previous } = changeDescription(window, label);
  return (
    <span className="grid gap-1">
      <span>{summary}</span>
      <span className="tabular-nums">{current}</span>
      <span className="tabular-nums">{previous}</span>
    </span>
  );
}
