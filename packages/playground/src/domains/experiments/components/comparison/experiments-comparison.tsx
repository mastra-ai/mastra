import { Notice } from '@mastra/playground-ui/components/Notice';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useTraceQueryAvailable } from '@mastra/playground-ui/domains/capabilities';
import { focusRingInset } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import {
  useAllDatasetExperimentResultsQueries,
  useCompareExperiments,
  useDatasetExperimentsQueries,
  useScoresByExperimentIdsQueries,
} from '@mastra/react/hooks/datasets';
import { useExperimentsItemUsage } from '@mastra/react/hooks/experiments';
import { useMemo, useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import { buildComparisonRows, sideDurationMs } from './build-comparison-rows';
import type { ComparisonRow } from './build-comparison-rows';
import { ComparisonItemPanel } from './comparison-item-panel';
import { ComparisonItemPayload } from './comparison-item-payload';
import { totalTokens } from './comparison-metric-format';
import { sectionStackClass } from './comparison-section';
import { ComparisonSideCell } from './comparison-side-cell';
import { ComparisonSideSummary, ComparisonSideTitle } from './comparison-side-header';
import type { ComparisonSideMetrics, ScorerSummary } from './comparison-side-header';
import { ComparisonTracePanel } from './comparison-trace-panel';
import { columnLabel } from './constants';
import { useObservabilityStorageCapabilities } from '@/domains/configuration/hooks/use-observability-storage-capabilities';

interface ExperimentsComparisonProps {
  datasetId: string;
  baselineId: string;
  /** Experiments compared against the baseline, in column order. */
  contenderIds: string[];
  /** Makes the given contender the baseline. */
  onSetBaseline?: (experimentId: string) => void;
}

const cell = 'min-w-0 px-4 py-3';

/**
 * Items column plus one column per experiment. N is dynamic, so it goes through a CSS variable.
 * The columns keep their width at every viewport size: the page scrolls sideways instead.
 */
const gridRow =
  'grid grid-cols-[minmax(22rem,26rem)_repeat(var(--compare-cols),minmax(32rem,1fr))] divide-x divide-border border-border';

/**
 * Rows open on click, but their buttons, links and fields keep their own behaviour. Portaled
 * content (tooltips, popovers) bubbles through React yet sits outside the row in the DOM.
 */
const isFromControl = (event: MouseEvent<HTMLElement>) =>
  !(event.target instanceof Element) ||
  !event.currentTarget.contains(event.target) ||
  event.target.closest(
    'a, button, input, select, textarea, [role="button"], [role="link"], [data-slot="collapsible-box-fade"]',
  ) !== null;

/** Selecting text to copy it shouldn't open the item. */
const hasTextSelection = () => Boolean(window.getSelection()?.toString());

const isNumber = (value: number | null): value is number => value != null;

const mean = (values: number[]) =>
  values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

const average = (rows: ComparisonRow[], index: number, scorerId: string) =>
  mean(
    rows
      .map(row => row.sides[index]?.scores.find(score => score.scorerId === scorerId)?.value ?? null)
      .filter(isNumber),
  );

const columnMetrics = (rows: ComparisonRow[], index: number): ComparisonSideMetrics => {
  const sides = rows.map(row => row.sides[index]).filter(side => side?.present);
  return {
    errorCount: sides.filter(side => side.error).length,
    averageScore: mean(sides.flatMap(side => side.scores.map(score => score.value)).filter(isNumber)),
    averageDurationMs: mean(sides.map(sideDurationMs).filter(isNumber)),
  };
};

/**
 * Comparison table of a baseline and one or more contender experiments. Every item is a
 * row, with each experiment side by side so a change reads as a diff against the baseline.
 */
export function ExperimentsComparison({
  datasetId,
  baselineId,
  contenderIds,
  onSetBaseline,
}: ExperimentsComparisonProps) {
  const experimentIds = useMemo(() => [baselineId, ...contenderIds], [baselineId, contenderIds]);
  const [selectedItemId, setSelectedItemId] = useState<string>();
  const [featuredTraceId, setFeaturedTraceId] = useState<string>();
  const traceQuery = useTraceQueryAvailable();
  // One drawer at a time: the item and the trace replace each other.
  const openItem = (itemId: string) => {
    setFeaturedTraceId(undefined);
    setSelectedItemId(itemId);
  };
  const showTrace = (traceId: string) => {
    setSelectedItemId(undefined);
    setFeaturedTraceId(traceId);
  };

  const {
    data: comparison,
    isLoading,
    error,
  } = useCompareExperiments({
    datasetId,
    experimentIds,
    baselineId,
    queryOptions: { enabled: Boolean(datasetId) && Boolean(baselineId) && contenderIds.length > 0 },
  });

  const { data: experimentsById, isLoading: isExperimentsLoading } = useDatasetExperimentsQueries({
    datasetId,
    experimentIds,
  });

  const experimentRefs = useMemo(
    () => experimentIds.map(id => ({ id, status: experimentsById[id]?.status })),
    [experimentIds, experimentsById],
  );

  const { data: resultsById, isLoading: isResultsLoading } = useAllDatasetExperimentResultsQueries({
    datasetId,
    experiments: experimentRefs,
  });
  // Scorer reasons live in the scores store, not on the result rows.
  const { data: scoresById } = useScoresByExperimentIdsQueries({ experiments: experimentRefs });

  const { supportsMetrics, isLoading: isCapabilitiesLoading } = useObservabilityStorageCapabilities();
  // Filtered by experiment id, so it runs alongside the results instead of waiting for their trace ids.
  const { data: usageById, isLoading: isUsageLoading } = useExperimentsItemUsage({
    experiments: experimentRefs,
    supportsMetrics,
  });

  const rows = useMemo(
    () => buildComparisonRows({ comparison, experimentIds, resultsById, scoresById, usageById }),
    [comparison, experimentIds, resultsById, scoresById, usageById],
  );

  /** Per-scorer averages for each column; contenders also carry their delta against the baseline. */
  const summaries = useMemo((): ScorerSummary[][] => {
    const scorerIds = [
      ...new Set(rows.flatMap(row => row.sides.flatMap(side => side.scores.map(s => s.scorerId)))),
    ].sort();
    return experimentIds.map((_, index) =>
      scorerIds.map(scorerId => {
        const value = average(rows, index, scorerId);
        const baseline = average(rows, 0, scorerId);
        const delta = index > 0 && value != null && baseline != null ? value - baseline : null;
        return { scorerId, average: value, delta };
      }),
    );
  }, [rows, experimentIds]);

  const metrics = useMemo(
    () =>
      experimentIds.map((experimentId, index): ComparisonSideMetrics => {
        const summary = usageById[experimentId]?.summary;
        return {
          ...columnMetrics(rows, index),
          cost: summary?.estimatedCost,
          costUnit: summary?.costUnit,
          tokens: totalTokens(summary),
        };
      }),
    [rows, experimentIds, usageById],
  );

  if (isLoading || isExperimentsLoading || isCapabilitiesLoading || isUsageLoading) {
    // Centred on the viewport, like the app boot spinner, so swapping from one to the other doesn't shift.
    return (
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <Notice variant="warning" title="Error loading comparison">
        <Notice.Message>{error instanceof Error ? error.message : 'Unknown error'}</Notice.Message>
      </Notice>
    );
  }

  if (!comparison || comparison.items.length === 0) {
    return (
      <Txt as="p" variant="body" tone="muted" className="py-5 text-center">
        No comparison data
      </Txt>
    );
  }

  const baselineExperiment = experimentsById[baselineId];

  return (
    <>
      <div
        role="table"
        aria-label="Experiments comparison"
        // The column minimums set the width: max-content would stretch columns to the unwrapped text.
        className="grid min-w-[calc(22rem_+_var(--compare-cols)_*_32rem)]"
        style={{ '--compare-cols': experimentIds.length } as CSSProperties}
      >
        {/* Titles stay pinned while scrolling down, so every column still says which experiment it is. */}
        <div role="row" className={cn(gridRow, 'sticky top-0 z-20 bg-background')}>
          <div role="columnheader" aria-label="Items" className={cell} />
          {experimentIds.map((experimentId, index) => (
            <div
              key={experimentId}
              role="columnheader"
              aria-label={columnLabel(index)}
              className={cn(cell, 'border-b')}
            >
              <ComparisonSideTitle
                role={index === 0 ? 'baseline' : 'contender'}
                label={columnLabel(index)}
                experiment={experimentsById[experimentId] ?? undefined}
                onSetBaseline={index > 0 && onSetBaseline ? () => onSetBaseline(experimentId) : undefined}
              />
            </div>
          ))}
        </div>

        <div role="row" aria-label="Summary" className={cn(gridRow, 'border-b')}>
          <div role="cell" aria-label="Items" className={cell} />
          {experimentIds.map((experimentId, index) => {
            const experiment = experimentsById[experimentId] ?? undefined;
            return (
              <div key={experimentId} role="cell" aria-label={columnLabel(index)} className={cell}>
                <ComparisonSideSummary
                  role={index === 0 ? 'baseline' : 'contender'}
                  experiment={experiment}
                  summary={summaries[index]}
                  metrics={isResultsLoading ? undefined : metrics[index]}
                  baselineMetrics={isResultsLoading ? undefined : metrics[0]}
                  versionMismatch={
                    index > 0 && Boolean(experiment) && Boolean(baselineExperiment)
                      ? experiment?.datasetVersion !== baselineExperiment?.datasetVersion
                      : undefined
                  }
                  showUsage={supportsMetrics}
                />
              </div>
            );
          })}
        </div>

        {rows.map(row => (
          <ComparisonRowView
            key={row.itemId}
            row={row}
            isLoading={isResultsLoading}
            showUsage={supportsMetrics}
            onOpen={() => openItem(row.itemId)}
            onShowTrace={showTrace}
          />
        ))}
      </div>
      <ComparisonItemPanel datasetId={datasetId} itemId={selectedItemId} onClose={() => setSelectedItemId(undefined)} />
      {/* Stays mounted so the drawer animates in and out, like on the traces page. */}
      <ComparisonTracePanel
        traceId={featuredTraceId}
        onClose={() => setFeaturedTraceId(undefined)}
        withQueryTrace={traceQuery.enabled}
        withFeedback={traceQuery.enabled}
      />
    </>
  );
}

type ExpandableSection = 'input' | 'groundTruth' | 'output';

interface ComparisonRowViewProps {
  row: ComparisonRow;
  isLoading: boolean;
  showUsage: boolean;
  onOpen: () => void;
  onShowTrace: (traceId: string) => void;
}

/** One item of the comparison. Expanding a section expands the same section in every column of the row. */
function ComparisonRowView({ row, isLoading, showUsage, onOpen, onShowTrace }: ComparisonRowViewProps) {
  const [expanded, setExpanded] = useState<Record<ExpandableSection, boolean>>({
    input: false,
    groundTruth: false,
    output: false,
  });
  const expandedProps = (section: ExpandableSection) => ({
    expanded: expanded[section],
    onExpandedChange: (value: boolean) => setExpanded(current => ({ ...current, [section]: value })),
  });
  const output = expandedProps('output');

  return (
    <div
      role="row"
      aria-label={row.itemId}
      tabIndex={0}
      onClick={event => {
        if (isFromControl(event) || hasTextSelection()) return;
        onOpen();
      }}
      onKeyDown={event => {
        if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        onOpen();
      }}
      className={cn(
        gridRow,
        'cursor-pointer border-b transition-colors duration-normal ease-out-custom hover:bg-fill-subtle',
        focusRingInset,
      )}
    >
      <div role="cell" className={cn(cell, sectionStackClass)}>
        <ComparisonItemPayload label="Input" value={row.input} {...expandedProps('input')} />
        <ComparisonItemPayload label="Ground truth" value={row.groundTruth} {...expandedProps('groundTruth')} />
      </div>

      {row.sides.map((side, index) => (
        <div key={side.experimentId} role="cell" aria-label={columnLabel(index)} className={cell}>
          <ComparisonSideCell
            column={side}
            isLoading={isLoading}
            showUsage={showUsage}
            outputExpanded={output.expanded}
            onOutputExpandedChange={output.onExpandedChange}
            onShowTrace={onShowTrace}
          />
        </div>
      ))}
    </div>
  );
}
