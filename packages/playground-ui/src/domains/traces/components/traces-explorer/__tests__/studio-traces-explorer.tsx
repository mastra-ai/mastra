import { useObservabilityCapabilities } from '@mastra/react/hooks/capabilities';
import { useScorers, useTriggerScorer } from '@mastra/react/hooks/scores';
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useDownloadTraceJson } from '../../../hooks/use-download-trace-json';
import { useOpenTraceQuery } from '../../../hooks/use-open-trace-query';
import { useStudioTraceNavigation } from '../../../hooks/use-studio-trace-navigation';
import { useTraceColumnPreferences } from '../../../hooks/use-trace-column-preferences';
import { useTracesDiscoveryQuery } from '../../../hooks/use-traces-discovery-query';
import { useTracesFilterSuggestionsQuery } from '../../../hooks/use-traces-filter-suggestions-query';
import { useTracesHistogramQuery } from '../../../hooks/use-traces-histogram-query';
import { useTracesListQuery } from '../../../hooks/use-traces-list-query';
import { useTracesUsageQuery } from '../../../hooks/use-traces-usage-query';
import type { TraceColumnPreferences } from '../../../trace-list-columns';
import { LiveSpanInput, LiveSpanOutput, LiveTraceMessages } from '../../live-parts';
import { SpanFeedbackTab } from '../../span-feedback-tab';
import { TraceFeedbackTab } from '../../trace-feedback-tab';
import { TraceThreadPanel } from '../../trace-thread-panel';
import { TracesExplorer, resolveTraceUsageColumns, resolveTracesSupport } from '../index';
import type {
  TracesExplorerCapabilities,
  TracesExplorerFeatures,
  TracesExplorerPanelProps,
  TracesExplorerRootProps,
  TracesExplorerScope,
  TracesExplorerTraces,
  TracesFilters,
  TracesMetricsSupport,
  TracesRootSource,
  TracesSelection,
} from '../index';
import { TraceAsItemDialog } from '@/domains/observability/components/trace-as-item-dialog';
import { ScoreAsItemDialog } from '@/domains/scores/components/score-as-item-dialog';
import { TraceScoresList } from '@/domains/scores/components/trace-scores-list';
import { useLinkComponent } from '@/lib/framework';

/*
 * The traces explorer composed as Studio's traces page composes it: the Studio data hooks (`use-*-query`,
 * through the Mastra client) feed the explorer's parts, which never fetch themselves. The root's records
 * (capabilities, list, discovery) load with the page; each part's records load in the part wrapper, so
 * they wait for the body to show, like the part. Specs that check Studio end to end render it against MSW.
 */

/** What the part wrappers read their queries from: the page's state and the root's records. */
type StudioInputs = {
  selection: TracesSelection;
  filters: TracesFilters;
  capabilities: TracesExplorerCapabilities;
  features?: TracesExplorerFeatures;
  rootSource?: TracesRootSource;
  columns: TraceColumnPreferences;
  metricsSupport: TracesMetricsSupport;
  traceHref?: (traceId: string) => string;
  traces: TracesExplorerTraces;
};

const StudioInputsContext = createContext<StudioInputs | null>(null);

const useStudioInputs = () => {
  const inputs = useContext(StudioInputsContext);
  if (!inputs) throw new Error('Studio parts must be rendered inside <StudioTracesExplorer>');
  return inputs;
};

export type StudioTracesExplorerProps = Pick<
  TracesExplorerRootProps,
  'selection' | 'filters' | 'onChange' | 'sort' | 'onSortChange' | 'rootSource' | 'feedbackOptions' | 'initialFilters'
> & {
  scope?: TracesExplorerScope;
  metricsSupport: TracesMetricsSupport;
  features?: TracesExplorerFeatures;
  /** Builds the href of the dedicated trace page; without it the drawer offers no "Open trace page". */
  traceHref?: (traceId: string) => string;
  children: ReactNode;
};

export function StudioTracesExplorer({
  selection,
  filters,
  onChange,
  sort,
  onSortChange,
  scope,
  metricsSupport,
  features,
  rootSource,
  feedbackOptions,
  initialFilters,
  traceHref,
  children,
}: StudioTracesExplorerProps) {
  const { data, isLoading } = useObservabilityCapabilities();
  const capabilities = { data, isLoading };
  const columns = useTraceColumnPreferences();
  const traces = useTracesListQuery({
    filters,
    sort,
    columns: columns.preferences,
    capabilities,
    features,
    rootSource,
  });
  const discovery = useTracesDiscoveryQuery({ filters, capabilities, features });

  const inputs: StudioInputs = {
    selection,
    filters,
    capabilities,
    features,
    rootSource,
    columns: columns.preferences,
    metricsSupport,
    traceHref,
    traces,
  };

  return (
    <StudioInputsContext.Provider value={inputs}>
      <TracesExplorer
        selection={selection}
        filters={filters}
        onChange={onChange}
        sort={sort}
        onSortChange={onSortChange}
        columns={columns.preferences}
        onColumnsChange={columns.setPreferences}
        capabilities={capabilities}
        traces={traces}
        discovery={discovery}
        scope={scope}
        metricsSupport={metricsSupport}
        features={features}
        rootSource={rootSource}
        feedbackOptions={feedbackOptions}
        initialFilters={initialFilters}
      >
        {children}
      </TracesExplorer>
    </StudioInputsContext.Provider>
  );
}

/** `TracesExplorer.FilterBar` with Studio's suggestions. */
export function StudioFilterBar() {
  const { filters, capabilities, features } = useStudioInputs();
  const suggestions = useTracesFilterSuggestionsQuery({ filters, capabilities, features });
  return <TracesExplorer.FilterBar suggestions={suggestions} />;
}

/** `TracesExplorer.Histogram` with Studio's counts. */
export function StudioHistogram() {
  const { filters, capabilities, features, rootSource } = useStudioInputs();
  return <TracesExplorer.Histogram data={useTracesHistogramQuery({ filters, capabilities, features, rootSource })} />;
}

/** `TracesExplorer.List` with Studio's usage. */
export function StudioList() {
  const { capabilities, features, columns, metricsSupport, traces } = useStudioInputs();
  const { usageEnabled } = resolveTraceUsageColumns(
    columns,
    metricsSupport,
    resolveTracesSupport(capabilities, features),
  );
  const usage = useTracesUsageQuery({ traceIds: traces.rows.map(row => row.traceId), enabled: usageEnabled });
  return <TracesExplorer.List usage={usage} />;
}

/** `TracesExplorer.Panel` with Studio's records, adapters and navigation; `props` override them. */
export function StudioPanel(props: Partial<TracesExplorerPanelProps>) {
  const { selection, capabilities, features, columns, metricsSupport, traceHref, traces } = useStudioInputs();
  const support = resolveTracesSupport(capabilities, features);
  const trace = useOpenTraceQuery({ selection, traces, capabilities, features, columns, metricsSupport });
  const studioNavigation = useStudioTraceNavigation();
  const { navigate, paths } = useLinkComponent();
  const scorers = useScorers();
  const triggerScorer = useTriggerScorer();
  const download = useDownloadTraceJson();

  return (
    <TracesExplorer.Panel
      trace={trace}
      navigation={{ ...studioNavigation, onOpenTrace: traceHref ? traceId => navigate(traceHref(traceId)) : undefined }}
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
          withQueryTrace={support.withQueryTrace}
          withFeedback={support.withFeedback}
          onOpenScore={() => {}}
        />
      )}
      renderDatasetDialog={dialog => <TraceAsItemDialog {...dialog} />}
      onOpenScoreTrace={(traceId, spanId) => navigate(paths.traceLink(traceId, spanId))}
      renderScoreDatasetDialog={dialog => <ScoreAsItemDialog {...dialog} />}
      {...props}
    />
  );
}
