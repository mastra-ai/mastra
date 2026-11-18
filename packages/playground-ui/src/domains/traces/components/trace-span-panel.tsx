import { useScorers, useTriggerScorer } from '@mastra/react/hooks/scores';
import { useTools } from '@mastra/react/hooks/tools';
import { useSpanDetail, useThreadHasOtherTraces, useTraceSpans } from '@mastra/react/hooks/traces';
import { useDownloadTraceJson } from '../hooks/use-download-trace-json';
import type { FeedbackOptions } from './feedback-options';
import { TraceSpanPanelView } from '@/domains/traces/components/trace-span-panel-view';
import type { TraceSpanPanelViewProps } from '@/domains/traces/components/trace-span-panel-view';
import { getTraceRootSpan, getTraceThreadId } from '@/domains/traces/components/trace-thread-context';
import { TraceThreadPanel } from '@/domains/traces/components/trace-thread-panel';

/** What the Studio adapter loads itself, so its callers never pass it. */
type LoadedProps =
  | 'selectedSpan'
  | 'isLoadingSelectedSpan'
  | 'traceSpans'
  | 'isLoadingTraceSpans'
  | 'traceSpansError'
  | 'registeredTools'
  | 'scorers'
  | 'isLoadingScorers'
  | 'onTriggerScorer'
  | 'onDownloadTrace'
  | 'isDownloadingTrace'
  | 'threadHasOtherTraces'
  | 'onOpenFullThread';

export interface TraceSpanPanelProps extends Omit<TraceSpanPanelViewProps, LoadedProps> {
  /** When true, opens the trace's thread (every turn) in a stacked drawer above the trace panel. */
  isFullThreadOpen?: boolean;
  /** Enables the in-place "Open full thread" swap; without it the action is not offered. */
  onFullThreadOpenChange?: (open: boolean) => void;
  /** Full-thread view: lists through the trace-query API; `false` falls back to `listTracesLight`. */
  withQueryTrace: boolean;
  /** Full-thread view: shows the per-trace Feedback tab. */
  withFeedback: boolean;
  feedbackOptions?: FeedbackOptions;
  /** Full-thread view: opens a score of one of the thread's traces (the app owns routing). */
  onOpenScore: (traceId: string, scoreId: string) => void;
}

/**
 * Studio's trace → span drilldown drawer: {@link TraceSpanPanelView} fed through the Mastra client, with
 * the trace's full thread stacked above it. It only loads data and hands it down; hosts with their own
 * transport compose `TraceSpanPanelView` (and `TraceThreadPanelView`) directly with the same response types.
 */
export function TraceSpanPanel({
  isFullThreadOpen,
  onFullThreadOpenChange,
  withQueryTrace,
  withFeedback,
  feedbackOptions,
  onOpenScore,
  ...props
}: TraceSpanPanelProps) {
  const { traceId, selectedSpanId, spans, anchorSpanId, showPartialThread, depth } = props;

  const selectedSpanDetail = useSpanDetail({
    traceId,
    spanId: selectedSpanId ?? '',
    queryOptions: { enabled: !!traceId && !!selectedSpanId },
  });
  // Passive: the full trace backs the Messages column, the signal labels and the tool results, and is
  // shared with the list's export; the trace list drives its refreshes.
  const fullTrace = useTraceSpans({ traceId, passive: true, queryOptions: { enabled: !!traceId } });
  // Tools only matter to an open span: its Input tab links the tools it offered to their pages.
  const { data: registeredTools } = useTools({ queryOptions: { enabled: !!selectedSpanId } });
  const scorers = useScorers();
  const triggerScorer = useTriggerScorer();
  const download = useDownloadTraceJson();

  const threadId = getTraceThreadId(getTraceRootSpan(spans, anchorSpanId), anchorSpanId);
  const threadToCheck = traceId && showPartialThread ? threadId : undefined;
  const threadHasOtherTraces = useThreadHasOtherTraces({
    threadId: threadToCheck,
    queryOptions: { enabled: !!threadToCheck },
  });

  return (
    <>
      <TraceSpanPanelView
        {...props}
        selectedSpan={selectedSpanDetail.data?.span}
        isLoadingSelectedSpan={selectedSpanDetail.isLoading}
        traceSpans={fullTrace.data?.spans}
        isLoadingTraceSpans={fullTrace.isLoading}
        traceSpansError={fullTrace.error ?? undefined}
        registeredTools={registeredTools}
        scorers={scorers.data}
        isLoadingScorers={scorers.isLoading}
        onTriggerScorer={triggerScorer.mutateAsync}
        onDownloadTrace={download.download}
        isDownloadingTrace={download.isPending}
        threadHasOtherTraces={threadHasOtherTraces}
        onOpenFullThread={onFullThreadOpenChange ? () => onFullThreadOpenChange(true) : undefined}
      />
      {/* Rendered after the trace panel: DataPanel stacking follows DOM order. */}
      <TraceThreadPanel
        open={!!(traceId && isFullThreadOpen && threadId)}
        depth={depth && depth > 1 ? 3 : 2}
        threadId={threadId ?? ''}
        onOpenScore={onOpenScore}
        withQueryTrace={withQueryTrace}
        withFeedback={withFeedback}
        feedbackOptions={feedbackOptions}
        onClose={() => onFullThreadOpenChange?.(false)}
      />
    </>
  );
}
