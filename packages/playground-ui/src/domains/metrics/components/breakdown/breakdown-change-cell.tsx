import type { Change, ChangeMetric } from '../../lib/breakdown';
import { changeTrend } from '../../lib/breakdown';
import { formatChange } from '../../lib/breakdown-table';
import { BreakdownTrendText } from './breakdown-trend-text';

export function BreakdownChangeCell({ change, metric }: { change: Change | undefined; metric: ChangeMetric }) {
  if (!change) return <BreakdownTrendText trend={undefined} />;
  return <BreakdownTrendText trend={changeTrend(change, metric)}>{formatChange(change, metric)}</BreakdownTrendText>;
}
