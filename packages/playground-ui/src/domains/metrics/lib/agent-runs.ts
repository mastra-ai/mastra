import type { ActivityBucket } from '../hooks/use-metrics-activity';
import { CHART_COLORS } from './chart-colors';
import { formatPercent } from './chart-format';

/** The failure rate's one series, for its legend: Failure rate cards and the Agent runs card's Failure rate tab. */
export const FAILURE_RATE_SERIES = [{ dataKey: 'failureRate', label: 'Failed runs', color: CHART_COLORS.error }];

/** Runs in the range, and how many failed. */
export function runTotals(data: ActivityBucket[]) {
  return {
    runs: data.reduce((sum, b) => sum + b.completed + b.failed, 0),
    failed: data.reduce((sum, b) => sum + b.failed, 0),
  };
}

/** The range's failure rate, as a card's total. */
export function failureRateTotal(data: ActivityBucket[]) {
  const { runs, failed } = runTotals(data);
  return formatPercent(runs > 0 ? failed / runs : 0);
}
