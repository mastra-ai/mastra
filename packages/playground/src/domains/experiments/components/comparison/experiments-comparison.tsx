import { Notice } from '@mastra/playground-ui/components/Notice';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { cn } from '@mastra/playground-ui/utils/cn';
import {
  useAllDatasetExperimentResultsQueries,
  useCompareExperiments,
  useDatasetExperimentsQueries,
  useScoresByExperimentIdsQueries,
} from '@mastra/react/hooks/datasets';
import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { buildComparisonRows } from './build-comparison-rows';
import type { ComparisonRow } from './build-comparison-rows';
import { ComparisonItemPayload } from './comparison-item-payload';
import { ComparisonSideCell } from './comparison-side-cell';
import { ComparisonSideHeader } from './comparison-side-header';
import type { ScorerSummary } from './comparison-side-header';

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
  'grid border-border xl:grid-cols-[minmax(20rem,24rem)_repeat(var(--compare-cols),minmax(22rem,1fr))] xl:divide-x xl:divide-border';

const columnLabel = (index: number) => (index === 0 ? 'Baseline' : `Contender ${index}`);

const average = (rows: ComparisonRow[], index: number, scorerId: string) => {
  const values = rows
    .map(row => row.sides[index]?.scores.find(score => score.scorerId === scorerId)?.value)
    .filter((value): value is number => value != null);
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
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
  const { Link, paths } = useLinkComponent();
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

  const rows = useMemo(
    () => buildComparisonRows({ comparison, experimentIds, resultsById, scoresById }),
    [comparison, experimentIds, resultsById, scoresById],
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

  if (isLoading || isExperimentsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
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
    <div className="overflow-x-auto">
      <div
        role="table"
        aria-label="Experiments comparison"
        className="grid"
        style={{ '--compare-cols': experimentIds.length } as CSSProperties}
      >
        <div role="row" className={cn(gridRow, 'border-y')}>
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
            <div role="cell" className={`${cell} grid content-start gap-1`}>
              <Link
                href={paths.datasetItemLink(datasetId, row.itemId)}
                aria-label={`Open item ${row.itemId}`}
                className={cn(
                  row.sides.every(side => side.present) ? 'text-muted-foreground' : 'text-placeholder',
                  'flex items-start gap-1.5 break-all hover:underline [&>svg]:mt-0.5 [&>svg]:size-3.5 [&>svg]:shrink-0',
                )}
              >
                <Txt as="span" variant="caption" font="mono" className="min-w-0">
                  {row.itemId}
                </Txt>
              </Link>
              <div className="grid pt-3">
                <ComparisonItemPayload label="Input" value={row.input} />
                <ComparisonItemPayload label="Ground truth" value={row.groundTruth} />
              </div>
            </div>

            {row.sides.map((side, index) => (
              <div key={side.experimentId} role="cell" aria-label={columnLabel(index)} className={cell}>
                <ComparisonSideCell column={side} isLoading={isResultsLoading} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
