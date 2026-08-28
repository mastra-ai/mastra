import { useTraces } from '@mastra/playground-ui/domains/traces/hooks/use-traces';
import { useMemo } from 'react';

/**
 * Lists every trace recorded for a conversation thread, oldest first.
 *
 * Both the enriched-mode switch (which only needs to know whether traces exist)
 * and the enriched view itself read this hook, so they share a single React
 * Query cache entry.
 */
export function useThreadTraces(threadId: string) {
  // `useTraces` keys effects on the `filters` identity, so an inline object would
  // reset its state on every render and loop forever.
  const filters = useMemo(() => ({ threadId }), [threadId]);
  const { data, isLoading, isError, error } = useTraces({ filters });

  // The list endpoints order by `startedAt DESC`; the enriched thread reads
  // top-to-bottom in chronological order, so flip it here.
  const traces = useMemo(() => [...(data?.spans ?? [])].reverse(), [data?.spans]);

  return { traces, hasTraces: traces.length > 0, isLoading, isError, error };
}
