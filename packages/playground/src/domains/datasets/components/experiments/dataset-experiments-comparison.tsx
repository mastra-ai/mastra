import { Button } from '@mastra/playground-ui/components/Button';
import { Chip, ChipsGroup } from '@mastra/playground-ui/components/Chip';
import { ItemList } from '@mastra/playground-ui/components/ItemList';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useState, useMemo } from 'react';
import { useCompareExperiments } from '../../hooks/use-compare-experiments';
import {
  useDatasetExperiment,
  useDatasetExperimentResults,
  useScoresByExperimentId,
} from '../../hooks/use-dataset-experiments';
import { buildComparisonRows } from './build-comparison-rows';
import { ComparisonItemsList } from './comparison-items-list';
import { ComparisonSideColumn } from './comparison-side-column';
import { ExperimentInComparisonInfo } from './experiment-in-comparison-info';
import { ScoreDelta } from './score-delta';

interface DatasetExperimentsComparisonProps {
  datasetId: string;
  experimentIdA: string;
  experimentIdB: string;
  onSwap?: () => void;
}

/**
 * Three-column comparison of two dataset experiments: items on the left, then
 * the baseline and contender side by side so a change can be read as a diff.
 */
export function DatasetExperimentsComparison({
  datasetId,
  experimentIdA,
  experimentIdB,
  onSwap,
}: DatasetExperimentsComparisonProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

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

  const scorerSummaries = useMemo(
    () =>
      scorerIds.map(scorerId => {
        const average = (side: 'baseline' | 'contender') => {
          const values = rows
            .map(row => row[side].scores.find(score => score.scorerId === scorerId)?.value)
            .filter((value): value is number => value != null);
          return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
        };

        const avgA = average('baseline');
        const avgB = average('contender');
        return { scorerId, avgA, avgB, delta: avgA != null && avgB != null ? avgB - avgA : null };
      }),
    [rows, scorerIds],
  );

  const scorerSummaryColumns = [
    { name: 'scorer', label: 'Scorer', size: '1fr' },
    { name: 'baselineAvg', label: 'Baseline Avg', size: '1fr' },
    { name: 'comparisonAvg', label: 'Comparison Avg', size: '1fr' },
    { name: 'delta', label: 'Delta', size: '1fr' },
  ];

  const featuredItemId = selectedItemId ?? rows[0]?.itemId ?? null;
  const featuredRow = rows.find(row => row.itemId === featuredItemId) ?? null;

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
    <div className="grid gap-10">
      {/* Experiment infos */}
      {expA && expB && (
        <div className={cn('relative grid xl:grid-cols-[1fr_auto_1fr] gap-4 xl:gap-0')}>
          <ExperimentInComparisonInfo experiment={expA} type="baseline" />

          <div className="before:bg-border1 relative flex items-center justify-center px-[2vw] before:absolute before:inset-y-0 before:left-1/2 before:w-[2px] before:-translate-x-1/2">
            <div className="bg-surface2 relative z-1 rounded-lg p-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={onSwap}>VS</Button>
                </TooltipTrigger>
                <TooltipContent>Switch the order</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <ExperimentInComparisonInfo experiment={expB} type="contender" />
        </div>
      )}

      {versionMismatch && (
        <Notice variant="warning" title="Version mismatch">
          <Notice.Message>
            These experiments used different dataset versions (v{expA.datasetVersion} vs v{expB.datasetVersion}).
            Results may not be directly comparable.
          </Notice.Message>
        </Notice>
      )}

      {/* Per-scorer summary */}
      {scorerSummaries.length > 0 && (
        <ItemList>
          <ItemList.Header columns={scorerSummaryColumns}>
            <ItemList.HeaderCol>Scorer</ItemList.HeaderCol>
            <ItemList.HeaderCol className="flex justify-center">
              <ChipsGroup>
                <Chip color="purple" size="small" intensity="muted">
                  Baseline
                </Chip>
                <Chip color="purple" size="small">
                  Avg
                </Chip>
              </ChipsGroup>
            </ItemList.HeaderCol>
            <ItemList.HeaderCol className="flex justify-center">
              <ChipsGroup>
                <Chip color="cyan" size="small" intensity="muted">
                  Contender
                </Chip>
                <Chip color="cyan" size="small">
                  Avg
                </Chip>
              </ChipsGroup>
            </ItemList.HeaderCol>
            <ItemList.HeaderCol className="flex justify-center">Delta</ItemList.HeaderCol>
          </ItemList.Header>

          <ItemList.Scroller>
            <ItemList.Items>
              {scorerSummaries.map(({ scorerId, avgA, avgB, delta }) => (
                <ItemList.Row key={scorerId} columns={scorerSummaryColumns}>
                  <ItemList.TextCell>{scorerId}</ItemList.TextCell>
                  <ItemList.TextCell className="text-center font-mono">
                    {avgA != null ? avgA.toFixed(3) : '-'}
                  </ItemList.TextCell>
                  <ItemList.TextCell className="text-center font-mono">
                    {avgB != null ? avgB.toFixed(3) : '-'}
                  </ItemList.TextCell>
                  <ItemList.TextCell className="flex justify-center">
                    {delta != null ? <ScoreDelta delta={delta} /> : '-'}
                  </ItemList.TextCell>
                </ItemList.Row>
              ))}
            </ItemList.Items>
          </ItemList.Scroller>
        </ItemList>
      )}

      {/* Items / Baseline / Contender */}
      <div className="border-border1 grid gap-4 rounded-lg border xl:grid-cols-[minmax(14rem,18rem)_1fr_1fr] xl:gap-0 xl:divide-x xl:divide-[var(--border1)]">
        <ComparisonItemsList rows={rows} featuredItemId={featuredItemId} onItemClick={setSelectedItemId} />

        <ComparisonSideColumn
          side="baseline"
          row={featuredRow}
          experiment={baselineExperiment}
          isLoading={isBaselineLoading}
        />
        <ComparisonSideColumn
          side="contender"
          row={featuredRow}
          experiment={contenderExperiment}
          isLoading={isContenderLoading}
          showDeltas
        />
      </div>
    </div>
  );
}
