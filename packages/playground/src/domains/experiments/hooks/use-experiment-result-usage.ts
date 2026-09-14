import { useTraceSpans } from '@mastra/playground-ui/domains/traces/hooks/use-trace-spans';
import { useTraceUsage } from '@mastra/playground-ui/domains/traces/hooks/use-trace-usage';

import { useObservabilityStorageCapabilities } from '@/domains/configuration/hooks/use-observability-storage-capabilities';

/**
 * Token/cost usage of an experiment result's trace, only when that trace is an
 * agent run (root span) and the observability store can serve metrics.
 */
export function useExperimentResultUsage(traceId: string | null | undefined) {
  const { data: trace } = useTraceSpans(traceId);
  const rootSpan = trace?.spans.find(span => !span.parentSpanId);
  const isAgentTrace = rootSpan?.entityType === 'agent';
  const { supportsMetrics } = useObservabilityStorageCapabilities();

  const usage = useTraceUsage({
    traceIds: traceId ? [traceId] : [],
    enabled: isAgentTrace && supportsMetrics,
    autoRefetch: false,
  });

  return traceId ? usage.data?.get(traceId) : undefined;
}
