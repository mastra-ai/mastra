import { useObservabilityCapabilities } from '@mastra/react/hooks/capabilities';

const DAY = 24 * 60 * 60 * 1000;

/**
 * The first day the trace store still has data for, from the `traceRetentionDays` capability, so
 * the date picker can block custom ranges that would only come back empty. `undefined` when the
 * store reports no limit (every OSS store) or the capabilities haven't loaded.
 */
export function useTraceRetentionMinDate(): Date | undefined {
  const { data } = useObservabilityCapabilities();
  const days = data?.capabilities.traceRetentionDays;
  if (days === undefined) return undefined;
  const oldest = new Date(Date.now() - days * DAY);
  return new Date(oldest.getFullYear(), oldest.getMonth(), oldest.getDate());
}
