import { useTraceSpans, useTraceUsage } from '@mastra/react/hooks/traces';

import { useObservabilityStorageCapabilities } from '@/domains/configuration/hooks/use-observability-storage-capabilities';

/**
 * Token/cost usage of an experiment result's trace, only when that trace is an
 * agent run (root span) and the observability store can serve metrics.
 * `isLoading` stays true until it is known whether usage exists, so callers can reserve its space.
 */
export function useExperimentResultUsage(traceId: string | null | undefined) {
  const { data: trace, isLoading: isTraceLoading } = useTraceSpans({
    traceId: traceId,
    queryOptions: { enabled: !!traceId },
  });
  const rootSpan = trace?.spans.find(span => !span.parentSpanId);
  const isAgentTrace = rootSpan?.entityType === 'agent';
  const { supportsMetrics, isLoading: isCapabilitiesLoading } = useObservabilityStorageCapabilities();

  const isUsageEnabled = isAgentTrace && supportsMetrics;
  const usage = useTraceUsage({
    traceIds: traceId ? [traceId] : [],
    enabled: isUsageEnabled,
    autoRefetch: false,
  });
  // Switching results keeps the previous trace's usage as placeholder data, which is not `isLoading`.
  const isUsageLoading = isUsageEnabled && (usage.isLoading || usage.isPlaceholderData);

  return {
    usage: traceId ? usage.data?.get(traceId) : undefined,
    isLoading: !!traceId && (isTraceLoading || isCapabilitiesLoading || isUsageLoading),
  };
}
