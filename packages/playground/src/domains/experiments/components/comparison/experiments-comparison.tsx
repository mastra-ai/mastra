import { Notice } from '@mastra/playground-ui/components/Notice';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import {
  useAllDatasetExperimentResultsQueries,
  useCompareExperiments,
  useDatasetExperimentsQueries,
  useScoresByExperimentIdsQueries,
} from '@mastra/react/hooks/datasets';
import { useExperimentsItemUsage } from '@mastra/react/hooks/experiments';
import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { buildComparisonRows, sideDurationMs } from './build-comparison-rows';
import type { ComparisonRow } from './build-comparison-rows';
import { ComparisonItemPayload } from './comparison-item-payload';
import { totalTokens } from './comparison-metric-format';
import { sectionStackClass } from './comparison-section';
import { ComparisonSideCell } from './comparison-side-cell';
import { ComparisonSideHeader } from './comparison-side-header';
import type { ComparisonSideMetrics, ScorerSummary } from './comparison-side-header';
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

/** Items column plus one column per experiment. N is dynamic, so it goes through a CSS variable. */
const gridRow =
  'grid border-border xl:grid-cols-[minmax(22rem,26rem)_repeat(var(--compare-cols),minmax(32rem,1fr))] xl:divide-x xl:divide-border';

const columnLabel = (index: number) => (index === 0 ? 'Baseline' : `Contender ${index}`);

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
          cost: summary ? { value: summary.estimatedCost, unit: summary.costUnit } : undefined,
          tokens: summary ? totalTokens(summary) : undefined,
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
    <ScrollArea orientation="horizontal" mask={{ x: '6rem' }}>
      <div
        role="table"
        aria-label="Experiments comparison"
        className="grid"
        style={{ '--compare-cols': experimentIds.length } as CSSProperties}
      >
        <div role="row" className={cn(gridRow, 'border-b')}>
          <div role="columnheader" aria-label="Items" className={cn('text-muted-foreground', `${cell} uppercase`)}>
            <Txt as="span" variant="caption" className="block">
              Items
            </Txt>
          </div>
          {experimentIds.map((experimentId, index) => {
            const experiment = experimentsById[experimentId] ?? undefined;
            return (
              <div key={experimentId} role="columnheader" aria-label={columnLabel(index)} className={cell}>
                <ComparisonSideHeader
                  role={index === 0 ? 'baseline' : 'contender'}
                  label={columnLabel(index)}
                  experiment={experiment}
                  summary={summaries[index]}
                  metrics={isResultsLoading ? undefined : metrics[index]}
                  baselineMetrics={isResultsLoading ? undefined : metrics[0]}
                  versionMismatch={
                    index > 0 && Boolean(experiment) && Boolean(baselineExperiment)
                      ? experiment?.datasetVersion !== baselineExperiment?.datasetVersion
                      : undefined
                  }
                  onSetBaseline={index > 0 && onSetBaseline ? () => onSetBaseline(experimentId) : undefined}
                />
              </div>
            );
          })}
        </div>

        {rows.map(row => (
          <div key={row.itemId} role="row" aria-label={row.itemId} className={cn(gridRow, 'border-b')}>
            <div role="cell" className={cn(cell, sectionStackClass)}>
              <ComparisonItemPayload label="Input" value={row.input} />
              <ComparisonItemPayload label="Ground truth" value={row.groundTruth} />
            </div>

            {row.sides.map((side, index) => (
              <div key={side.experimentId} role="cell" aria-label={columnLabel(index)} className={cell}>
                <ComparisonSideCell column={side} isLoading={isResultsLoading} showUsage={supportsMetrics} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
