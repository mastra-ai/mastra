import type { LightSpanRecord } from '@mastra/core/storage';
import { formatCost } from '@mastra/playground-ui/domains/metrics/components/metrics-utils';
import { useTraceUsage } from '@mastra/playground-ui/domains/traces/hooks/use-trace-usage';
import { useMemo } from 'react';

import { EnrichedTurn } from './enriched-turn';

export type EnrichedThreadProps = {
  /** The thread's traces, oldest first. */
  traces: LightSpanRecord[];
};

/**
 * The conversation rebuilt from its traces: one turn per trace, in the chat's own
 * centred column so switching modes keeps the reading position.
 */
export function EnrichedThread({ traces }: EnrichedThreadProps) {
  const traceIds = useMemo(() => traces.map(trace => trace.traceId), [traces]);
  // One breakdown for the whole thread: what a turn cost belongs next to the turn itself.
  const { data: usageByTraceId } = useTraceUsage({ traceIds, enabled: true, autoRefetch: false });

  return (
    <div className="h-full overflow-y-auto">
      <div data-testid="enriched-thread" className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
        {traces.map(trace => {
          const usage = usageByTraceId?.get(trace.traceId);

          return (
            <EnrichedTurn
              key={trace.traceId}
              traceId={trace.traceId}
              spanId={trace.spanId}
              // A thread's traces are agent runs, and each one is the root of its turn.
              isTopLevelSpan
              entityType={trace.entityType === 'agent' ? 'Agent' : undefined}
              cost={usage?.estimatedCost === undefined ? undefined : formatCost(usage.estimatedCost, usage.costUnit)}
            />
          );
        })}
      </div>
    </div>
  );
}
