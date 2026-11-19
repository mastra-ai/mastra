import { TraceAsItemDialog } from '@mastra/playground-ui/domains/observability/components/trace-as-item-dialog';
import { ScoreAsItemDialog } from '@mastra/playground-ui/domains/scores/components/score-as-item-dialog';
import { TraceScoresList } from '@mastra/playground-ui/domains/scores/components/trace-scores-list';
import {
  LiveSpanInput,
  LiveSpanOutput,
  LiveTraceMessages,
} from '@mastra/playground-ui/domains/traces/components/live-parts';
import { SpanFeedbackTab } from '@mastra/playground-ui/domains/traces/components/span-feedback-tab';
import { TraceFeedbackTab } from '@mastra/playground-ui/domains/traces/components/trace-feedback-tab';
import { TraceThreadPanel } from '@mastra/playground-ui/domains/traces/components/trace-thread-panel';
import { TracesExplorer, resolveTracesSupport } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import type {
  TracesExplorerCapabilities,
  TracesExplorerTraces,
  TracesMetricsSupport,
  TracesSelection,
} from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import { useDownloadTraceJson } from '@mastra/playground-ui/domains/traces/hooks/use-download-trace-json';
import { useOpenTraceQuery } from '@mastra/playground-ui/domains/traces/hooks/use-open-trace-query';
import { useStudioTraceNavigation } from '@mastra/playground-ui/domains/traces/hooks/use-studio-trace-navigation';
import type { TraceColumnPreferences } from '@mastra/playground-ui/domains/traces/trace-list-columns';
import { useScorers, useTriggerScorer } from '@mastra/react/hooks/scores';
import { memo } from 'react';
import { useNavigate } from 'react-router';
import { STUDIO_TRACES_FEATURES } from './features';
import { CreateDatasetDialog } from '@/domains/datasets/components/create-dataset-dialog';
import { LiveKitRecordingReview } from '@/domains/voice/components/livekit-recording-review';
import { paths, traceScoreLink } from '@/lib/app-routing';

type TracesPanelProps = {
  selection: TracesSelection;
  traces: Pick<TracesExplorerTraces, 'rows' | 'isLoading'>;
  capabilities: TracesExplorerCapabilities;
  columns: TraceColumnPreferences;
  metricsSupport: TracesMetricsSupport;
};

/**
 * The open trace's drawer, fed with Studio's records of the selected trace. Its views that load their own
 * data (messages with live tool cards, span tabs, feedback, scores, the full thread, the dataset dialog)
 * are Studio's adapters, each loading once it shows.
 */
export const TracesPanel = memo(function TracesPanel({
  selection,
  traces,
  capabilities,
  columns,
  metricsSupport,
}: TracesPanelProps) {
  const navigate = useNavigate();
  const { withQueryTrace, withFeedback } = resolveTracesSupport(capabilities, STUDIO_TRACES_FEATURES);
  const trace = useOpenTraceQuery({
    selection,
    traces,
    capabilities,
    features: STUDIO_TRACES_FEATURES,
    columns,
    metricsSupport,
  });
  // The entity, tools and delegated agents open their Studio pages; this is the trace's page already.
  const navigation = { ...useStudioTraceNavigation(), onOpenTrace: undefined };
  const scorers = useScorers();
  const triggerScorer = useTriggerScorer();
  const download = useDownloadTraceJson();

  return (
    <TracesExplorer.Panel
      trace={trace}
      navigation={navigation}
      scorers={scorers.data}
      isLoadingScorers={scorers.isLoading}
      onTriggerScorer={triggerScorer.mutateAsync}
      onDownload={download.download}
      isDownloading={download.isPending}
      renderMessages={messages => <LiveTraceMessages {...messages} />}
      spanInput={<LiveSpanInput />}
      spanOutput={<LiveSpanOutput />}
      renderFeedback={feedback => <TraceFeedbackTab {...feedback} />}
      renderSpanFeedback={feedback => <SpanFeedbackTab {...feedback} />}
      renderScores={({ traceId, rootSpanId, onScoreSelect }) => (
        <TraceScoresList traceId={traceId} spanId={rootSpanId} onScoreSelect={onScoreSelect} />
      )}
      renderThread={thread => (
        <TraceThreadPanel
          {...thread}
          withQueryTrace={withQueryTrace}
          withFeedback={withFeedback}
          onOpenScore={(traceId, scoreId) => navigate(traceScoreLink(traceId, scoreId))}
        />
      )}
      renderDatasetDialog={dialog => (
        <TraceAsItemDialog {...dialog} renderCreateDatasetDialog={props => <CreateDatasetDialog {...props} />} />
      )}
      onOpenScoreTrace={(traceId, spanId) => navigate(paths.traceLink(traceId, spanId))}
      renderScoreDatasetDialog={dialog => <ScoreAsItemDialog {...dialog} />}
      headerActionsSlot={({ traceId, spans }) => (
        <LiveKitRecordingReview key={traceId} traceId={traceId} spans={spans} />
      )}
    />
  );
});
