import { Notice } from '@mastra/playground-ui/components/Notice';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useMemo } from 'react';
import { buildComparisonRows } from './build-comparison-rows';
import { ComparisonItemPayload } from './comparison-item-payload';
import { ComparisonSideCell } from './comparison-side-cell';
import { ComparisonSideHeader } from './comparison-side-header';
import { ScoreDelta } from './score-delta';
import { useCompareExperiments } from '@/domains/datasets/hooks/use-compare-experiments';
import {
  useDatasetExperiment,
  useDatasetExperimentResults,
  useScoresByExperimentId,
} from '@/domains/datasets/hooks/use-dataset-experiments';
import { useLinkComponent } from '@/lib/framework';

interface ExperimentsComparisonProps {
  datasetId: string;
  experimentIdA: string;
  experimentIdB: string;
}

const cell = 'min-w-0 px-4 py-3';

/**
 * Three-column comparison table of two dataset experiments. Every item is a
 * row, with the baseline and contender side by side so a change reads as a diff.
 */
export function ExperimentsComparison({ datasetId, experimentIdA, experimentIdB }: ExperimentsComparisonProps) {
  const { Link, paths } = useLinkComponent();
  const { data: comparison, isLoading, error } = useCompareExperiments(datasetId, experimentIdA, experimentIdB);

  const { data: expA } = useDatasetExperiment(datasetId, experimentIdA);
  const { data: expB } = useDatasetExperiment(datasetId, experimentIdB);

  const versionMismatch = expA && expB && expA.datasetVersion !== expB.datasetVersion;

  const baselineId = comparison?.baselineId ?? experimentIdA;
  const contenderId = experimentIdA === baselineId ? experimentIdB : experimentIdA;

  const baselineExperiment = expA?.id === baselineId ? expA : expB;
  const contenderExperiment = expA?.id === contenderId ? expA : expB;

  const { data: baselineResults, isLoading: isBaselineLoading } = useDatasetExperimentResults({
    datasetId,
    experimentId: baselineId,
    experimentStatus: baselineExperiment?.status,
  });
  const { data: contenderResults, isLoading: isContenderLoading } = useDatasetExperimentResults({
    datasetId,
    experimentId: contenderId,
    experimentStatus: contenderExperiment?.status,
  });

  // Scorer reasons live in the scores store, not on the result rows.
  const { data: baselineScores } = useScoresByExperimentId(baselineId, baselineExperiment?.status);
  const { data: contenderScores } = useScoresByExperimentId(contenderId, contenderExperiment?.status);

  const rows = useMemo(
    () =>
      buildComparisonRows({
        comparison,
        baselineId,
        contenderId,
        baselineResults,
        contenderResults,
        baselineScores,
        contenderScores,
      }),
    [comparison, baselineId, contenderId, baselineResults, contenderResults, baselineScores, contenderScores],
  );

  const scorerIds = useMemo(() => [...new Set(rows.flatMap(row => Object.keys(row.deltas)))].sort(), [rows]);

  /** Per-scorer averages for each side, rendered in its own header cell. */
  const summaries = useMemo(() => {
    const average = (side: 'baseline' | 'contender', scorerId: string) => {
      const values = rows
        .map(row => row[side].scores.find(score => score.scorerId === scorerId)?.value)
        .filter((value): value is number => value != null);
      return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    };

    const baseline = scorerIds.map(scorerId => ({
      scorerId,
      average: average('baseline', scorerId),
      delta: null,
    }));

    const contender = scorerIds.map(scorerId => {
      const avgA = average('baseline', scorerId);
      const avgB = average('contender', scorerId);
      return { scorerId, average: avgB, delta: avgA != null && avgB != null ? avgB - avgA : null };
    });

    return { baseline, contender };
  }, [rows, scorerIds]);

  if (isLoading) {
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
    return <div className="text-neutral4 py-8 text-center text-sm">No comparison data</div>;
  }

  return (
    <div className="grid gap-4">
      <div role="table" aria-label="Experiments comparison" className="grid">
        {/* Header row: Items / Baseline / Contender */}
        <div
          role="row"
          className="border-border1 grid border-y xl:grid-cols-[minmax(20rem,24rem)_1fr_1fr] xl:divide-x xl:divide-[var(--border1)]"
        >
          <div role="columnheader" aria-label="Items" className={`${cell} text-neutral3 text-ui-sm uppercase`}>
            Items
          </div>
          <div role="columnheader" aria-label="Baseline" className={cell}>
            <ComparisonSideHeader
              side="baseline"
              experiment={baselineExperiment}
              summary={summaries.baseline}
              versionMismatch={versionMismatch}
            />
          </div>
          <div role="columnheader" aria-label="Contender" className={cell}>
            <ComparisonSideHeader
              side="contender"
              experiment={contenderExperiment}
              summary={summaries.contender}
              versionMismatch={versionMismatch}
              showDeltas
            />
          </div>
        </div>

        {rows.map(row => {
          const deltas = Object.entries(row.deltas).filter(([, delta]) => delta != null && delta !== 0);

          return (
            <div
              key={row.itemId}
              role="row"
              aria-label={row.itemId}
              className="border-border1 grid border-b xl:grid-cols-[minmax(20rem,24rem)_1fr_1fr] xl:divide-x xl:divide-[var(--border1)]"
            >
              <div role="cell" className={`${cell} grid content-start gap-1`}>
                <Link
                  href={paths.datasetItemLink(datasetId, row.itemId)}
                  aria-label={`Open item ${row.itemId}`}
                  className={cn(
                    'text-ui-sm flex items-start gap-1.5 font-mono break-all hover:underline [&>svg]:mt-0.5 [&>svg]:size-3.5 [&>svg]:shrink-0',
                    row.baseline.present && row.contender.present ? 'text-neutral4' : 'text-neutral1',
                  )}
                >
                  <span className="min-w-0">{row.itemId}</span>
                </Link>
                {deltas.length > 0 && (
                  <span className="flex flex-wrap items-center gap-2">
                    {deltas.map(([scorerId, delta]) => (
                      <ScoreDelta key={scorerId} delta={delta as number} />
                    ))}
                  </span>
                )}
                <div className="grid pt-3">
                  <ComparisonItemPayload label="Input" value={row.input} />
                  <ComparisonItemPayload label="Ground truth" value={row.groundTruth} />
                </div>
              </div>

              <div role="cell" aria-label="Baseline" className={cell}>
                <ComparisonSideCell side="baseline" row={row} isLoading={isBaselineLoading} />
              </div>
              <div role="cell" aria-label="Contender" className={cell}>
                <ComparisonSideCell side="contender" row={row} isLoading={isContenderLoading} showDeltas />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
