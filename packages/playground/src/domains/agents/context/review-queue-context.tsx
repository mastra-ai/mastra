import { useMastraClient } from '@mastra/react';
import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';

export interface ReviewItem {
  id: string;
  input: unknown;
  output: unknown;
  error: unknown;
  itemId: string;
  /** Dataset ID for API calls */
  datasetId?: string;
  /** Scores from experiment scorers */
  scores?: Record<string, number>;
  /** Freeform tags (like GitHub labels) */
  tags: string[];
  /** Quality rating */
  rating?: 'positive' | 'negative';
  /** User comment */
  comment?: string;
  /** Which failure cluster this belongs to */
  clusterId?: string;
  /** Source experiment */
  experimentId?: string;
  /** Trace ID for linking to feedback API */
  traceId?: string;
}

export interface FailureCluster {
  id: string;
  label: string;
  description: string;
  count: number;
}

interface ReviewQueueState {
  items: ReviewItem[];
  clusters: FailureCluster[];
  activeClusterId: string | null;
  addItems: (
    items: Array<{
      id?: string;
      input: unknown;
      output: unknown;
      error: unknown;
      itemId: string;
      datasetId?: string;
      scores?: Record<string, number>;
      experimentId?: string;
      traceId?: string;
      tags?: string[];
      rating?: 'positive' | 'negative';
      comment?: string;
    }>,
  ) => void;
  removeItem: (id: string) => void;
  completeItem: (id: string) => Promise<void>;
  setItemTags: (id: string, tags: string[]) => void;
  rateItem: (id: string, rating: 'positive' | 'negative' | undefined) => void;
  commentItem: (id: string, comment: string) => void;
  setClusters: (clusters: FailureCluster[]) => void;
  setActiveClusterId: (id: string | null) => void;
  assignCluster: (itemId: string, clusterId: string) => void;
  clearAll: () => void;
  /** Load persisted items (replaces all items) */
  loadPersistedItems: (items: ReviewItem[]) => void;
}

const ReviewQueueContext = createContext<ReviewQueueState | null>(null);

export function ReviewQueueProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [clusters, setClusters] = useState<FailureCluster[]>([]);
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const { updateExperimentResult } = useDatasetMutations();
  const client = useMastraClient();

  const addItems = useCallback(
    (
      newItems: Array<{
        id?: string;
        input: unknown;
        output: unknown;
        error: unknown;
        itemId: string;
        datasetId?: string;
        scores?: Record<string, number>;
        experimentId?: string;
        traceId?: string;
        tags?: string[];
        rating?: 'positive' | 'negative';
        comment?: string;
      }>,
    ) => {
      setItems(prev => {
        const existingIds = new Set(prev.map(i => i.itemId));
        const deduped = newItems.filter(i => !existingIds.has(i.itemId));
        return [
          ...prev,
          ...deduped.map((item, idx) => ({
            ...item,
            id: item.id || `review-${Date.now()}-${idx}`,
            tags: item.tags ?? [],
          })),
        ];
      });
    },
    [],
  );

  const loadPersistedItems = useCallback((persistedItems: ReviewItem[]) => {
    setItems(prev => {
      // Merge: persisted items take priority, add any local-only items too
      const persistedById = new Map(persistedItems.map(i => [i.id, i]));
      const localOnly = prev.filter(i => !persistedById.has(i.id));
      return [...persistedItems, ...localOnly];
    });
  }, []);

  const removeItem = useCallback(
    (id: string) => {
      const item = items.find(i => i.id === id);
      if (item?.experimentId && item?.datasetId) {
        // Delete: revert status to null (no longer in review)
        updateExperimentResult.mutate({
          datasetId: item.datasetId,
          experimentId: item.experimentId,
          resultId: item.id,
          status: null,
        });
      }
      setItems(prev => prev.filter(i => i.id !== id));
    },
    [items, updateExperimentResult],
  );

  const completeItem = useCallback(
    async (id: string) => {
      const item = items.find(i => i.id === id);
      if (item?.experimentId && item?.datasetId) {
        // Mark as complete for auditing
        await updateExperimentResult.mutateAsync({
          datasetId: item.datasetId,
          experimentId: item.experimentId,
          resultId: item.id,
          status: 'complete',
        });
      }
      setItems(prev => prev.filter(i => i.id !== id));
    },
    [items, updateExperimentResult],
  );

  const setItemTags = useCallback(
    (id: string, tags: string[]) => {
      const item = items.find(i => i.id === id);
      if (item?.experimentId && item?.datasetId) {
        // Persist tags via API
        updateExperimentResult.mutate({
          datasetId: item.datasetId,
          experimentId: item.experimentId,
          resultId: item.id,
          tags,
        });
      }
      setItems(prev => prev.map(i => (i.id === id ? { ...i, tags } : i)));
    },
    [items, updateExperimentResult],
  );

  const rateItem = useCallback(
    (id: string, rating: 'positive' | 'negative' | undefined) => {
      const item = items.find(i => i.id === id);
      // Persist rating via feedback API (skip when rating is cleared)
      if (item?.traceId && rating !== undefined) {
        client
          .createFeedback({
            feedback: {
              traceId: item.traceId,
              source: 'studio',
              feedbackSource: 'studio',
              feedbackType: 'rating',
              value: rating === 'positive' ? 1 : -1,
              experimentId: item.experimentId ?? undefined,
              sourceId: item.id,
            },
          })
          .catch(() => {
            // Silently fail
          });
      }
      setItems(prev => prev.map(i => (i.id === id ? { ...i, rating } : i)));
    },
    [items, client],
  );

  const commentItem = useCallback(
    (id: string, comment: string) => {
      const item = items.find(i => i.id === id);
      // Persist comment via feedback API if we have a traceId
      if (item?.traceId) {
        client
          .createFeedback({
            feedback: {
              traceId: item.traceId,
              source: 'studio',
              feedbackSource: 'studio',
              feedbackType: 'comment',
              value: comment,
              comment,
              experimentId: item.experimentId ?? undefined,
              sourceId: item.id, // experiment result ID
            },
          })
          .catch(() => {
            // Silently fail — local state is still updated
          });
      }
      setItems(prev => prev.map(i => (i.id === id ? { ...i, comment } : i)));
    },
    [items, client],
  );

  const assignCluster = useCallback((itemId: string, clusterId: string) => {
    setItems(prev => prev.map(i => (i.id === itemId ? { ...i, clusterId } : i)));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
    setClusters([]);
    setActiveClusterId(null);
  }, []);

  return (
    <ReviewQueueContext.Provider
      value={{
        items,
        clusters,
        activeClusterId,
        addItems,
        removeItem,
        completeItem,
        setItemTags,
        rateItem,
        commentItem,
        setClusters,
        setActiveClusterId,
        assignCluster,
        clearAll,
        loadPersistedItems,
      }}
    >
      {children}
    </ReviewQueueContext.Provider>
  );
}

export function useReviewQueue() {
  const ctx = useContext(ReviewQueueContext);
  if (!ctx) throw new Error('useReviewQueue must be used within ReviewQueueProvider');
  return ctx;
}
