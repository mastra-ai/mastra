'use client';

import type { DatasetExperimentResult } from '@mastra/client-js';
import type { ExperimentStatus } from '@mastra/core/storage';
import { Button } from '@mastra/playground-ui/components/Button';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { toast } from '@mastra/playground-ui/utils/toast';
import { ClipboardCheck } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';

import { useExperimentItemPanel } from '../context/experiment-item-panel-context';
import { ExperimentResultsList } from './experiment-results-list';
import { ExperimentScorerSummary } from './experiment-scorer-summary';
import { useScoresByExperimentId } from '@/domains/datasets/hooks/use-dataset-experiments';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';

export type ExperimentResultsSectionProps = {
  experimentId: string;
  datasetId: string;
  experimentStatus?: ExperimentStatus;
  results: DatasetExperimentResult[];
  isLoading: boolean;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
};

/**
 * Results section of an experiment. Clicking a row navigates to the
 * `items/:itemId` sub-route, which renders the detail as an overlay panel
 * (see ExperimentItemPage). Reviews live on the Review Queue page.
 */
export function ExperimentResultsSection({
  experimentId,
  datasetId,
  experimentStatus,
  results,
  isLoading,
  setEndOfListElement,
  isFetchingNextPage,
  hasNextPage,
}: ExperimentResultsSectionProps) {
  const { currentItemId, openItem, close } = useExperimentItemPanel();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isFlagging, setIsFlagging] = useState(false);

  const { updateExperimentResult } = useDatasetMutations();

  const toggleSelect = useCallback((resultId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(resultId)) {
        next.delete(resultId);
      } else {
        next.add(resultId);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const flagForReview = useCallback(
    async (resultIds: string[]) => {
      if (isFlagging || resultIds.length === 0) return;
      setIsFlagging(true);
      let flagged = 0;
      const flaggedIds = new Set<string>();
      try {
        for (const resultId of resultIds) {
          try {
            await updateExperimentResult.mutateAsync({
              datasetId,
              experimentId,
              resultId,
              status: 'needs-review',
            });
            flagged++;
            flaggedIds.add(resultId);
          } catch {
            // continue on individual failures
          }
        }
      } finally {
        setIsFlagging(false);
      }
      if (flaggedIds.size > 0) {
        setSelectedIds(prev => {
          const next = new Set(prev);
          for (const id of flaggedIds) next.delete(id);
          return next;
        });
      }
      if (flagged > 0) {
        toast(`${flagged} result${flagged > 1 ? 's' : ''} flagged for review`);
      }
    },
    [datasetId, experimentId, isFlagging, updateExperimentResult],
  );

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
      { name: 'itemId', label: 'Item ID', size: '7rem' },
      { name: 'input', label: 'Input', size: 'minmax(10rem,20rem)' },
      ...scorerIds.map(id => ({ name: id, label: id, size: '12rem' })),
    ],
    [scorerIds],
  );

  return (
    // The action row only exists while something is selected, so it must not reserve a track otherwise.
    <div
      className={cn(
        'grid h-full gap-3 overflow-hidden',
        selectedIds.size > 0 ? 'grid-rows-[auto_auto_1fr]' : 'grid-rows-[auto_1fr]',
      )}
    >
      <ExperimentScorerSummary scoresByItemId={scoresByExperimentId} experimentStatus={experimentStatus} />

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={isFlagging} onClick={() => flagForReview([...selectedIds])}>
            <Icon size="sm">
              <ClipboardCheck />
            </Icon>
            Flag {selectedIds.size} to review
          </Button>
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            Clear
          </Button>
        </div>
      )}
      <div className="min-h-0 overflow-y-auto">
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
          onToggleSelect={toggleSelect}
        />
      </div>
    </div>
  );
}
