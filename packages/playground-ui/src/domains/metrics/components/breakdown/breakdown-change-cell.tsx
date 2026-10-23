import type { Change, ChangeMetric } from '../../lib/breakdown';
import { changeTrend } from '../../lib/breakdown';
import { DASH, formatChange } from '../../lib/breakdown-table';

const TREND_CLASS = { good: 'text-badge-green-foreground', bad: 'text-badge-red-foreground' } as const;

export function BreakdownChangeCell({ change, metric }: { change: Change | undefined; metric: ChangeMetric }) {
  if (!change) return DASH;
  const trend = changeTrend(change, metric);
  return <span className={trend && TREND_CLASS[trend]}>{formatChange(change, metric)}</span>;
}
