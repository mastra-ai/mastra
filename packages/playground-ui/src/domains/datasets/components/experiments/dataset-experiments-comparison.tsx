import { useState, useMemo } from 'react';
import { Spinner } from '@/ds/components/Spinner';
import { ItemList } from '@/ds/components/ItemList';
import { Columns } from '@/ds/components/Columns';
import { ScoreDelta } from './score-delta';
import { ComparisonItemsList } from './comparison-items-list';
import { ComparisonItemPanel } from './comparison-item-panel';
import { useCompareExperiments } from '../../hooks/use-compare-experiments';
import { useDatasetExperiment } from '../../hooks/use-dataset-experiments';
import type { CompareExperimentsResponse } from '@mastra/client-js';
import { Notice } from '@/ds/components/Notice';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { AlertTriangleIcon } from 'lucide-react';
import { ExperimentInComparisonInfo } from './experiment-in-comparison-info';
import { Button } from '@/ds/components/Button';
import { Chip, ChipsGroup } from '@/ds/components/Chip';
import { cn } from '@/lib/utils';

interface DatasetExperimentsComparisonProps {
  datasetId: string;
  experimentIdA: string;
  experimentIdB: string;
  onSwap?: () => void;
}

/**
 * Side-by-side comparison of two dataset experiments.
 * Shows version mismatch warning and per-item score deltas.
 */
export function DatasetExperimentsComparison({
  datasetId,
  experimentIdA,
  experimentIdB,
  onSwap,
}: DatasetExperimentsComparisonProps) {
  const [featuredItemId, setFeaturedItemId] = useState<string | null>(null);

  const { data: comparison, isLoading, error } = useCompareExperiments(datasetId, experimentIdA, experimentIdB);

  const { data: expA } = useDatasetExperiment(datasetId, experimentIdA);
  const { data: expB } = useDatasetExperiment(datasetId, experimentIdB);

  const versionMismatch = expA && expB && expA.datasetVersion !== expB.datasetVersion;

  // Collect all unique scorer IDs across all items
  const scorerIds = useMemo(() => {
    if (!comparison) return [];
    const ids = new Set<string>();
    for (const item of comparison.items) {
      for (const result of Object.values(item.results)) {
        if (result) {
          for (const key of Object.keys(result.scores)) {
            ids.add(key);
          }
        }
      }
    }
    return [...ids].sort();
  }, [comparison]);

  // Compute per-scorer average deltas
  const scorerSummaries = useMemo(() => {
    if (!comparison || scorerIds.length === 0) return [];
    const baselineId = comparison.baselineId;
    const contenderId = experimentIdA === baselineId ? experimentIdB : experimentIdA;

    return scorerIds.map(scorerId => {
      let sumA = 0;
      let sumB = 0;
      let countA = 0;
      let countB = 0;

      for (const item of comparison.items) {
        const scoreA = item.results[baselineId]?.scores[scorerId];
        const scoreB = item.results[contenderId]?.scores[scorerId];
        if (scoreA != null) {
          sumA += scoreA;
          countA++;
        }
        if (scoreB != null) {
          sumB += scoreB;
          countB++;
        }
      }

      const avgA = countA > 0 ? sumA / countA : null;
      const avgB = countB > 0 ? sumB / countB : null;
      const delta = avgA != null && avgB != null ? avgB - avgA : null;

      return { scorerId, avgA, avgB, delta };
    });
  }, [comparison, scorerIds, experimentIdA, experimentIdB]);

  const scorerSummaryColumns = [
    { name: 'scorer', label: 'Scorer', size: '1fr' },
    { name: 'baselineAvg', label: 'Baseline Avg', size: '1fr' },
    { name: 'comparisonAvg', label: 'Comparison Avg', size: '1fr' },
    { name: 'delta', label: 'Delta', size: '1fr' },
  ];

  const comparisonColumns = useMemo(
    () => [
      { name: 'itemId', label: 'Item ID', size: '8rem' },
      ...(!featuredItemId ? scorerIds.map(id => ({ name: id, label: id, size: '1fr' })) : []),
    ],
    [scorerIds, featuredItemId],
  );

  const featuredItem = comparison?.items.find(i => i.itemId === featuredItemId) ?? null;

  const handleItemClick = (itemId: string) => {
    setFeaturedItemId(itemId === featuredItemId ? null : itemId);
  };

  const handleItemClose = () => {
    setFeaturedItemId(null);
  };

  // Navigation handlers
  const toNextItem = (): (() => void) | undefined => {
    if (!comparison || !featuredItemId) return undefined;
    const currentIndex = comparison.items.findIndex(i => i.itemId === featuredItemId);
    if (currentIndex >= 0 && currentIndex < comparison.items.length - 1) {
      return () => setFeaturedItemId(comparison.items[currentIndex + 1].itemId);
    }
    return undefined;
  };

  const toPreviousItem = (): (() => void) | undefined => {
    if (!comparison || !featuredItemId) return undefined;
    const currentIndex = comparison.items.findIndex(i => i.itemId === featuredItemId);
    if (currentIndex > 0) {
      return () => setFeaturedItemId(comparison.items[currentIndex - 1].itemId);
    }
    return undefined;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <Notice variant="warning">
        <AlertTriangleIcon />
        <Notice.Column>
          <Notice.Title>Error loading comparison</Notice.Title>
          <Notice.Message>{error instanceof Error ? error.message : 'Unknown error'}</Notice.Message>
        </Notice.Column>
      </Notice>
    );
  }

  if (!comparison || comparison.items.length === 0) {
    return <div className="text-neutral4 text-sm text-center py-8">No comparison data</div>;
  }

  const baselineId = comparison.baselineId;
  const contenderId = experimentIdA === baselineId ? experimentIdB : experimentIdA;

  return (
    <div className="grid gap-10">
      {/* Experiment infos */}
      {expA && expB && (
        <div className={cn('relative grid xl:grid-cols-[1fr_auto_1fr] gap-4 xl:gap-0')}>
          <ExperimentInComparisonInfo datasetId={datasetId} experiment={expA} type="baseline" />

          <div className="relative flex items-center justify-center px-[2vw] before:absolute before:inset-y-0 before:left-1/2 before:-translate-x-1/2 before:w-[2px] before:bg-border1">
            <div className="relative z-1 bg-surface2 rounded-lg p-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="standard" size="default" onClick={onSwap}>
                    VS
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Switch the order</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <ExperimentInComparisonInfo datasetId={datasetId} experiment={expB} type="contender" />
        </div>
      )}

      {versionMismatch && (
        <Notice variant="warning">
          <AlertTriangleIcon />
          <Notice.Message>
            <strong>Version mismatch!</strong> These experiments used different dataset versions (v
            {expA.datasetVersion} vs v{expB.datasetVersion}). Results may not be directly comparable.
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

      {/* Per-item comparison with detail panel */}
      <Columns
        className={cn({
          'grid-cols-[auto_1fr]': !!featuredItem,
        })}
      >
        <ComparisonItemsList
          items={comparison.items}
          baselineId={baselineId}
          contenderId={contenderId}
          scorerIds={scorerIds}
          featuredItemId={featuredItemId}
          columns={comparisonColumns}
          onItemClick={handleItemClick}
        />

        {!!featuredItem && (
          <ComparisonItemPanel
            item={featuredItem}
            baselineId={baselineId}
            contenderId={contenderId}
            baselineVersion={expA?.datasetVersion}
            contenderVersion={expB?.datasetVersion}
            onPrevious={toPreviousItem()}
            onNext={toNextItem()}
            onClose={handleItemClose}
          />
        )}
      </Columns>
    </div>
  );
}
