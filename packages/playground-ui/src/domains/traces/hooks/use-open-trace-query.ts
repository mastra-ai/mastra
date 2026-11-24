import { useTraceSpanScores } from '@mastra/react/hooks/scores';
import {
  useSpanDetail,
  useSpanFeedback,
  useThreadHasOtherTraces,
  useTraceFeedback,
  useTraceOrBranchSpans,
  useTraceSpans,
  useTraceUsage,
} from '@mastra/react/hooks/traces';
import { getTraceRootSpan, getTraceThreadId } from '../components/trace-thread-context';
import type { TracesSelection } from '../components/traces-explorer/traces-explorer-actions';
import type {
  TracesExplorerCapabilities,
  TracesExplorerOpenTrace,
  TracesExplorerTraces,
} from '../components/traces-explorer/traces-explorer-data';
import { resolveTraceUsageColumns, resolveTracesSupport } from '../components/traces-explorer/traces-explorer-support';
import type {
  TracesExplorerFeatures,
  TracesMetricsSupport,
} from '../components/traces-explorer/traces-explorer-support';
import type { TraceColumnPreferences } from '../trace-list-columns';

export type UseOpenTraceQueryArgs = {
  /** The explorer's selection: its trace (and span) are the ones loaded. */
  selection: TracesSelection;
  /** The listed traces: a listed trace shares the list's usage query. */
  traces: Pick<TracesExplorerTraces, 'rows' | 'isLoading'>;
  capabilities: TracesExplorerCapabilities;
  features?: TracesExplorerFeatures;
  columns: TraceColumnPreferences;
  metricsSupport: TracesMetricsSupport;
  /** Refreshes with the list's polling. Defaults to `true`, like the traces list. */
  autoRefetch?: boolean;
};

/**
 * Studio's records of the trace open in the explorer, through the Mastra client: its spans, the full
 * trace behind the Messages column, the open span, its usage, whether its thread holds other turns,
 * and the counts on the Feedback and Scores tabs. Pass the result as `TracesExplorer.Panel`'s `trace`.
 */
export function useOpenTraceQuery({
  selection,
  traces: { rows, isLoading: isListLoading },
  capabilities,
  features,
  columns,
  metricsSupport,
  autoRefetch = true,
}: UseOpenTraceQueryArgs): TracesExplorerOpenTrace | undefined {
  const support = resolveTracesSupport(capabilities, features);
  const { withFeedback } = support;
  const { usageEnabled } = resolveTraceUsageColumns(columns, metricsSupport, support);
  const { traceId, spanId } = selection;

  // Tab badge counts; the tab bodies re-use these first-page queries through React Query's cache.
  const { data: traceFeedbackData } = useTraceFeedback({
    traceId,
    queryOptions: { enabled: withFeedback && !!traceId },
  });
  const { data: spanFeedbackData } = useSpanFeedback({
    traceId,
    spanId,
    queryOptions: { enabled: withFeedback && !!traceId && !!spanId },
  });

  const { spans, anchorSpanId, isLoading } = useTraceOrBranchSpans({
    traceId: traceId ?? null,
    listMode: 'traces',
    anchorSpanId: null,
  });
  const anchorSpan = anchorSpanId
    ? spans?.find(s => s.spanId === anchorSpanId)
    : spans?.find(s => s.parentSpanId == null);

  const { data: spanScoresData } = useTraceSpanScores({
    traceId,
    spanId: anchorSpan?.spanId,
    queryOptions: { enabled: !!traceId && !!anchorSpan?.spanId },
  });

  // Same key as the list's usage query when the trace is listed, so React Query serves it from cache.
  // Waits for the list so a deep-linked trace doesn't fetch its own usage before the rows arrive.
  const rowIds = rows.map(row => row.traceId);
  const isListed = !!traceId && rowIds.includes(traceId);
  const { data: usageByTraceId } = useTraceUsage({
    traceIds: isListed ? rowIds : traceId ? [traceId] : [],
    enabled: usageEnabled && !isListLoading,
    autoRefetch,
  });

  const selectedSpan = useSpanDetail({
    traceId,
    spanId: spanId ?? '',
    queryOptions: { enabled: !!traceId && !!spanId },
  });
  // Passive: the full trace backs the Messages column, the signal labels and the tool results, and is
  // shared with the list's export; the trace list drives its refreshes.
  const fullTrace = useTraceSpans({ traceId, passive: true, queryOptions: { enabled: !!traceId } });

  // The explorer always offers the Messages column, so a trace on a thread asks whether it holds other turns.
  const threadId = getTraceThreadId(getTraceRootSpan(spans, anchorSpanId), anchorSpanId);
  const hasMessages = !!(traceId && threadId);
  const threadHasOtherTraces = useThreadHasOtherTraces({
    threadId: hasMessages ? threadId : undefined,
    queryOptions: { enabled: hasMessages },
  });

  if (!traceId) return undefined;
  return {
    spans,
    isLoading,
    anchorSpanId,
    fullTrace: { spans: fullTrace.data?.spans, isLoading: fullTrace.isLoading, error: fullTrace.error ?? undefined },
    selectedSpan: { span: selectedSpan.data?.span, isLoading: selectedSpan.isLoading },
    usage: usageByTraceId?.get(traceId),
    threadHasOtherTraces,
    feedbackCount: traceFeedbackData?.pagination?.total ?? undefined,
    spanFeedbackCount: spanFeedbackData?.pagination?.total ?? undefined,
    scores: spanScoresData && {
      total: spanScoresData.pagination?.total ?? undefined,
      records: spanScoresData.scores,
    },
  };
}
