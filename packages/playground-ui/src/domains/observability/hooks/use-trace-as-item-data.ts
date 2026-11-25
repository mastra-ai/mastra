import { useSpanDetail, useTraceTrajectory } from '@mastra/react/hooks/traces';

export type UseTraceAsItemDataArgs = {
  traceId: string | null | undefined;
  rootSpanId: string | null | undefined;
  /** Loads only while on, e.g. while the dialog is open. Defaults to on. */
  enabled?: boolean;
};

/**
 * What `TraceDatasetItemDialog` is prefilled from: the trace's root span and its trajectory, read through
 * the Mastra client in context. Call it under the client that serves traces and pass the result down.
 */
export function useTraceAsItemData({ traceId, rootSpanId, enabled = true }: UseTraceAsItemDataArgs) {
  const span = useSpanDetail({
    traceId,
    spanId: rootSpanId,
    queryOptions: { enabled: enabled && Boolean(traceId) && Boolean(rootSpanId) },
  });
  const trajectory = useTraceTrajectory({
    traceId,
    queryOptions: { enabled: enabled && Boolean(traceId) },
  });

  return {
    rootSpan: span.data?.span,
    trajectory: trajectory.data,
    isLoading: span.isLoading || trajectory.isLoading,
  };
}
