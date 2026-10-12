import { formatDuration, formatPercent } from '@mastra/playground-ui/domains/metrics/lib/chart-format';
import { errorRateOf } from './run-activity';
import type { RunActivity } from './run-activity';
import type { Latency } from './use-root-run-latency';

const ERROR_RATE_RISE = 0.05;
const LATENCY_RISE_RATIO = 1.5;
const LATENCY_RISE_MIN_MS = 250;

export function errorRateRegression(activity: RunActivity, noun: string) {
  const rate = errorRateOf(activity.runs, activity.errors);
  const previousRate = errorRateOf(activity.previousRuns, activity.previousErrors);
  if (rate === null || previousRate === null || rate - previousRate < ERROR_RATE_RISE) return undefined;
  return `${noun} ${formatPercent(rate)}, was ${formatPercent(previousRate)}`;
}

export function latencyRegression(latency: Latency | undefined) {
  if (!latency || latency.p95 === null || latency.previousP95 === null) return undefined;
  const rise = latency.p95 - latency.previousP95;
  if (latency.p95 < latency.previousP95 * LATENCY_RISE_RATIO || rise < LATENCY_RISE_MIN_MS) return undefined;
  return `p95 ${formatDuration(latency.p95)}, was ${formatDuration(latency.previousP95)}`;
}
