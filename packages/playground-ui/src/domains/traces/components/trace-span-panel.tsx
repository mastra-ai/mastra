import { useScorers, useTriggerScorer } from '@mastra/react/hooks/scores';
import { useSpanDetail, useThreadHasOtherTraces, useTraceSpans } from '@mastra/react/hooks/traces';
import { useMemo } from 'react';
import { useDownloadTraceJson } from '../hooks/use-download-trace-json';
import { useStudioTraceNavigation } from '../hooks/use-studio-trace-navigation';
import { TraceSpanPanelView } from './trace-span-panel-view';
import type { TraceSpanPanelViewProps } from './trace-span-panel-view';
import { LiveSpanInput, LiveSpanOutput, LiveTraceMessages } from '@/domains/traces/components/live-parts';
import { getTraceRootSpan, getTraceThreadId } from '@/domains/traces/components/trace-thread-context';
import { useLinkComponent } from '@/lib/framework';

export interface TraceSpanPanelProps extends Omit<
  TraceSpanPanelViewProps,
  | 'navigation'
  | 'fullTrace'
  | 'selectedSpan'
  | 'threadHasOtherTraces'
  | 'scorers'
  | 'isLoadingScorers'
  | 'onTriggerScorer'
  | 'onDownload'
  | 'isDownloading'
  | 'renderMessages'
  | 'spanInput'
  | 'spanOutput'
> {
  /** The trace page the drawer's "Open trace page" goes to, through Studio's router; without it, it offers none. */
  traceHref?: string;
  /** @deprecated No longer used: Studio always offers scoring, so the notice never shows. */
  showUnavailableFeaturesMsg?: boolean;
}

/**
 * Studio's trace → span drilldown drawer: a {@link TraceSpanPanelView} fed through the Mastra client. It
 * only loads data and hands it to the view; the trace's full thread is the host's to show. A host with
 * its own transport renders `TraceSpanPanelView` (or composes `TracePanel`) with its own data.
 */
export function TraceSpanPanel({
  traceHref,
  selectedSpanId,
  showPartialThread,
  showUnavailableFeaturesMsg: _showUnavailableFeaturesMsg,
  ...props
}: TraceSpanPanelProps) {
  const { traceId, spans, anchorSpanId } = props;
  const { navigate } = useLinkComponent();
  // Studio opens the entity, tools and delegated agents through its router; the trace page is the caller's.
  const studioNavigation = useStudioTraceNavigation();
  const navigation = useMemo(
    () => ({ ...studioNavigation, onOpenTrace: traceHref ? () => navigate(traceHref) : undefined }),
    [studioNavigation, traceHref, navigate],
  );

  const selectedSpanDetail = useSpanDetail({
    traceId,
    spanId: selectedSpanId ?? '',
    queryOptions: { enabled: !!traceId && !!selectedSpanId },
  });
  // Passive: the full trace backs the Messages column, the signal labels and the tool results, and is
  // shared with the list's export; the trace list drives its refreshes.
  const fullTrace = useTraceSpans({ traceId, passive: true, queryOptions: { enabled: !!traceId } });
  const scorers = useScorers();
  const triggerScorer = useTriggerScorer();
  const download = useDownloadTraceJson();

  const threadId = getTraceThreadId(getTraceRootSpan(spans, anchorSpanId), anchorSpanId);
  const hasMessages = !!(traceId && showPartialThread && threadId);
  // A single-trace thread would show exactly what the Messages column already shows.
  const threadHasOtherTraces = useThreadHasOtherTraces({
    threadId: hasMessages ? threadId : undefined,
    queryOptions: { enabled: hasMessages },
  });

  return (
    <TraceSpanPanelView
      {...props}
      selectedSpanId={selectedSpanId}
      showPartialThread={showPartialThread}
      navigation={navigation}
      fullTrace={{
        spans: fullTrace.data?.spans,
        isLoading: fullTrace.isLoading,
        error: fullTrace.error ?? undefined,
      }}
      selectedSpan={{ span: selectedSpanDetail.data?.span, isLoading: selectedSpanDetail.isLoading }}
      threadHasOtherTraces={threadHasOtherTraces}
      scorers={scorers.data}
      isLoadingScorers={scorers.isLoading}
      onTriggerScorer={triggerScorer.mutateAsync}
      onDownload={download.download}
      isDownloading={download.isPending}
      // Loads the MCP app tools for the live tool cards once the messages show.
      renderMessages={messagesProps => <LiveTraceMessages {...messagesProps} />}
      // Each tab loads what it draws when it opens: the tool registry, the live tool cards.
      spanInput={<LiveSpanInput />}
      spanOutput={<LiveSpanOutput />}
    />
  );
}
