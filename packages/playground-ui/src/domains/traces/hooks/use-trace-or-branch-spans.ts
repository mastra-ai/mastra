import type { TraceListMode } from '../trace-filters';
import type { SearchableSpan } from '../types';
import { useBranch } from './use-branch';
import { useTraceSpans } from './use-trace-spans';

export interface UseTraceOrBranchSpansArgs {
  traceId: string | null | undefined;
  /** Required when `listMode === 'branches'` — the anchor span identifying the displayed
   *  subtree. The hook fetches `getBranch(traceId, anchorSpanId)`. Intra-panel span selection
   *  is separate (the caller's `spanIdParam`); the anchor stays put while it changes. */
  anchorSpanId?: string | null;
  listMode: TraceListMode;
  depth?: number;
}

export interface UseTraceOrBranchSpansResult {
  spans: SearchableSpan[] | undefined;
  /** Set in branches mode; undefined in traces mode (which uses parentSpanId == null). */
  anchorSpanId: string | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

/**
 * Unified data source for the trace/span detail panel. Returns trace spans (full tree from the
 * root) in traces mode, or branch spans (subtree rooted at `anchorSpanId`) in branches mode.
 * Only the active query fires; the inactive one is disabled via its `enabled` flag.
 *
 * Both modes carry full span payloads: the panel renders and searches them, so a lightweight
 * projection here would hide content from the reader looking straight at it.
 */
export function useTraceOrBranchSpans({
  traceId,
  anchorSpanId,
  listMode,
  depth,
}: UseTraceOrBranchSpansArgs): UseTraceOrBranchSpansResult {
  const isBranches = listMode === 'branches';

  const traceQuery = useTraceSpans(isBranches ? null : traceId);
  const branchQuery = useBranch({
    traceId: isBranches ? traceId : null,
    spanId: isBranches ? anchorSpanId : null,
    depth,
  });

  if (isBranches) {
    return {
      spans: branchQuery.data?.spans,
      anchorSpanId: anchorSpanId ?? undefined,
      isLoading: branchQuery.isLoading,
      isError: branchQuery.isError,
      error: branchQuery.error,
    };
  }

  return {
    spans: traceQuery.data?.spans,
    anchorSpanId: undefined,
    isLoading: traceQuery.isLoading,
    isError: traceQuery.isError,
    error: traceQuery.error,
  };
}
