'use client';

import type { DatasetExperimentResult } from '@mastra/client-js';
import type { ExperimentStatus } from '@mastra/core/storage';
import { useMemo, useCallback } from 'react';

import { useExperimentItemPanel } from '../context/experiment-item-panel-context';
import { ExperimentResultsList } from './experiment-results-list';
import { useScoresByExperimentId } from '@/domains/datasets/hooks/use-dataset-experiments';

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
}: ExperimentResultsSectionProps) {
  const { currentItemId, openItem, close } = useExperimentItemPanel();

  // Row highlight derives from the active `items/:itemId` route.
  const featuredResultId = useMemo(
    () => (currentItemId ? (results.find(r => r.itemId === currentItemId)?.id ?? null) : null),
    [results, currentItemId],
  );

  const { data: scoresByExperimentId } = useScoresByExperimentId(experimentId, experimentStatus);

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
      { name: 'status', label: 'Status', size: 'auto' },
      { name: 'input', label: 'Input', size: '1fr' },
      { name: 'tags', label: 'Tags', size: 'auto' },
      ...scorerIds.map(id => ({ name: id, label: id, size: 'auto' })),
    ],
    [scorerIds],
  );

  return (
    <div className="h-full min-h-0 min-w-0 overflow-y-auto">
      <ExperimentResultsList
        results={results}
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
      />
    </div>
  );
}
