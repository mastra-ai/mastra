'use client';

import type { DatasetExperimentResult } from '@mastra/client-js';
import type { ExperimentStatus } from '@mastra/core/storage';
import { useScoresByExperimentId } from '@mastra/react/hooks/datasets';
import { useExperimentsItemUsage } from '@mastra/react/hooks/experiments';
import { useMemo, useCallback } from 'react';

import { useExperimentItemPanel } from '../context/experiment-item-panel-context';
import { getOptionalResultColumns } from '../utils/result-output';
import { ExperimentResultsList } from './experiment-results-list';

export type ExperimentResultsSectionProps = {
  experimentId: string;
  experimentStatus?: ExperimentStatus;
  results: DatasetExperimentResult[];
  isLoading: boolean;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (resultId: string) => void;
  onToggleSelectAll: () => void;
  /** Fetches per-item usage and shows the Cost and Tokens columns. */
  supportsMetrics?: boolean;
};

/**
 * Results section of an experiment. Clicking a row navigates to the
 * `items/:itemId` sub-route, which renders the detail as an overlay panel
 * (see ExperimentItemPage). Selection is owned by the page so the bulk
 * actions can render in the top area next to the page actions.
 */
export function ExperimentResultsSection({
  experimentId,
  experimentStatus,
  results,
  isLoading,
  setEndOfListElement,
  isFetchingNextPage,
  hasNextPage,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  supportsMetrics = false,
}: ExperimentResultsSectionProps) {
  const { currentItemId, openItem, close } = useExperimentItemPanel();

  // Row highlight derives from the active `items/:itemId` route.
  const featuredResultId = useMemo(
    () => (currentItemId ? (results.find(r => r.itemId === currentItemId)?.id ?? null) : null),
    [results, currentItemId],
  );

  const { data: scoresByExperimentId } = useScoresByExperimentId({
    experimentId: experimentId,
    experimentStatus: experimentStatus,
    queryOptions: { enabled: Boolean(experimentId) },
  });

  const experimentRefs = useMemo(
    () => [{ id: experimentId, status: experimentStatus }],
    [experimentId, experimentStatus],
  );
  const { data: usageById } = useExperimentsItemUsage({ experiments: experimentRefs, supportsMetrics });
  const usageByTraceId = usageById[experimentId]?.traces;

  const rows = useMemo(
    () =>
      usageByTraceId
        ? results.map(result => ({
            ...result,
            usage: result.traceId ? usageByTraceId[result.traceId] : undefined,
          }))
        : results,
    [results, usageByTraceId],
  );

  const scorerIds = useMemo(() => {
    if (!scoresByExperimentId) return [];
    const ids = new Set<string>();
    for (const scores of Object.values(scoresByExperimentId)) {
      for (const score of scores) {
        ids.add(score.scorerId);
      }
    }
    return [...ids].sort();
  }, [scoresByExperimentId]);

  const handleResultClick = useCallback(
    (resultId: string) => {
      const result = results.find(r => r.id === resultId);
      if (!result) return;
      if (result.itemId === currentItemId) {
        close();
      } else {
        openItem(result.itemId);
      }
    },
    [results, currentItemId, close, openItem],
  );

  const resultsListColumns = useMemo(
    () => [
      { name: 'itemId', label: 'Item ID', size: 'auto' },
      { name: 'input', label: 'Input', size: '20rem' },
      ...getOptionalResultColumns(results),
      ...(supportsMetrics
        ? [
            { name: 'cost', label: 'Cost', size: 'auto' },
            { name: 'tokens', label: 'Tokens', size: 'auto' },
          ]
        : []),
      { name: 'duration', label: 'Duration', size: 'auto' },
      ...scorerIds.map(id => ({ name: id, label: id, size: 'auto' })),
    ],
    [results, scorerIds, supportsMetrics],
  );

  return (
    <div className="h-full min-h-0 min-w-0 overflow-y-auto">
      <ExperimentResultsList
        results={rows}
        isLoading={isLoading}
        featuredResultId={featuredResultId}
        onResultClick={handleResultClick}
        columns={resultsListColumns}
        scoresByItemId={scoresByExperimentId}
        scorerIds={scorerIds}
        setEndOfListElement={setEndOfListElement}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        onToggleSelectAll={onToggleSelectAll}
      />
    </div>
  );
}
