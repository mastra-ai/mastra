'use client';

import type { DatasetExperimentResult } from '@mastra/client-js';
import type { ExperimentStatus } from '@mastra/core/storage';
import { Button } from '@mastra/playground-ui/components/Button';
import { Chip } from '@mastra/playground-ui/components/Chip';
import { Tabs, Tab, TabList, TabContent } from '@mastra/playground-ui/components/Tabs';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { toast } from '@mastra/playground-ui/utils/toast';
import { ClipboardCheck } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router';

import { useExperimentItemPanel } from '../context/experiment-item-panel-context';
import { ExperimentResultsList } from './experiment-results-list';
import { ExperimentScorerSummary } from './experiment-scorer-summary';
import { useScoresByExperimentId } from '@/domains/datasets/hooks/use-dataset-experiments';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';
import { DatasetReview } from '@/domains/review/components/dataset-review';
import { useDatasetReviewItems } from '@/domains/review/hooks/use-dataset-review-items';

export type ExperimentPageTabsProps = {
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
 * Tabbed layout for an experiment. The Results tab shows the results list;
 * clicking a row navigates to the `items/:itemId` sub-route, which renders
 * the detail as an overlay panel (see ExperimentItemPage).
 */
export function ExperimentPageTabs({
  experimentId,
  datasetId,
  experimentStatus,
  results,
  isLoading,
  setEndOfListElement,
  isFetchingNextPage,
  hasNextPage,
}: ExperimentPageTabsProps) {
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

  const selectLoadedFailed = useCallback(() => {
    const failedIds = results.filter(r => Boolean(r.error)).map(r => r.id);
    setSelectedIds(new Set(failedIds));
  }, [results]);

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

  type TabValue = 'summary' | 'results' | 'reviews';
  const [selectedTab, setSelectedTab] = useState<TabValue>('summary');
  // Result id to auto-feature on the Reviews tab, driven by the `?review=` search
  // param (set when clicking "Review" in the item panel, and deep-linkable).
  const [searchParams, setSearchParams] = useSearchParams();
  const reviewFeaturedItemId = searchParams.get('review');

  // The displayed tab derives from the URL during render — no effect syncing:
  // an active `items/:itemId` route forces Results, a `?review=` param forces Reviews.
  const activeTab: TabValue = currentItemId ? 'results' : reviewFeaturedItemId ? 'reviews' : selectedTab;

  const handleTabChange = (next: TabValue) => {
    setSelectedTab(next);
    // Leaving a URL-forced tab clears the forcing state via navigation.
    if (next !== 'results' && currentItemId) close();
    if (next !== 'reviews' && reviewFeaturedItemId) {
      setSearchParams(
        prev => {
          const params = new URLSearchParams(prev);
          params.delete('review');
          return params;
        },
        { replace: true },
      );
    }
  };

  const { data: reviewItemsForExperiment } = useDatasetReviewItems(datasetId);
  const reviewCount = (reviewItemsForExperiment ?? []).filter(item => item.experimentId === experimentId).length;

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
      { name: 'status', label: 'Status', size: '5rem' },
      { name: 'input', label: 'Input', size: 'minmax(15rem,1fr)' },
      ...scorerIds.map(id => ({ name: id, label: id, size: '12rem' })),
    ],
    [scorerIds],
  );

  return (
    <Tabs
      defaultTab="summary"
      value={activeTab}
      onValueChange={handleTabChange}
      className="grid h-full grid-rows-[auto_1fr] overflow-hidden"
    >
      <TabList>
        <Tab value="summary">Summary</Tab>
        <Tab value="results">Results</Tab>
        <Tab value="reviews">
          Reviews
          {reviewCount > 0 && <Chip color="orange">{reviewCount}</Chip>}
        </Tab>
      </TabList>

      <TabContent value="summary" className="mt-5 overflow-y-auto">
        <ExperimentScorerSummary scoresByItemId={scoresByExperimentId} experimentStatus={experimentStatus} />
      </TabContent>

      <TabContent value="reviews" className="mt-2 overflow-auto pb-0">
        <DatasetReview datasetId={datasetId} experimentId={experimentId} featuredItemId={reviewFeaturedItemId} />
      </TabContent>

      <TabContent value="results" className="mt-2 grid grid-rows-[auto_1fr] overflow-hidden">
        <div className="mb-4">
          {selectedIds.size > 0 && (
            <div className="bg-surface3 flex items-center gap-2 px-4 py-2">
              <Txt variant="ui-xs" className="text-neutral5 font-medium">
                {selectedIds.size} selected
              </Txt>
              <div className="flex-1" />
              <Button variant="outline" size="sm" disabled={isFlagging} onClick={() => flagForReview([...selectedIds])}>
                <Icon size="sm">
                  <ClipboardCheck />
                </Icon>
                Flag for Review
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Clear
              </Button>
            </div>
          )}
          {results.length > 0 && selectedIds.size === 0 && !isLoading && (
            <div className="flex items-center gap-2 px-4 py-2">
              <Button variant="ghost" size="sm" onClick={selectLoadedFailed}>
                Select loaded failures
              </Button>
            </div>
          )}
        </div>
        <div className="flex w-full overflow-y-auto">
          <div className="grid w-full content-start gap-8 overflow-y-auto">
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
      </TabContent>
    </Tabs>
  );
}
