import type { Change, ChangeMetric } from '../../lib/breakdown';
import { changeTrend } from '../../lib/breakdown';
import { DASH, formatChange } from '../../lib/breakdown-table';

const TREND_CLASS = { good: 'text-badge-green-foreground', bad: 'text-badge-red-foreground' } as const;

export function BreakdownChangeCell({ change, metric }: { change: Change | undefined; metric: ChangeMetric }) {
  // The cell sits in the list's main column, so a flat or missing change is muted here.
  if (!change) return <span className="text-muted-foreground">{DASH}</span>;
  const trend = changeTrend(change, metric);
  return <span className={trend ? TREND_CLASS[trend] : 'text-muted-foreground'}>{formatChange(change, metric)}</span>;
}
