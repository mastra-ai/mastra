import type { DatasetExperimentResult } from '@mastra/client-js';
import type { ExperimentStatus } from '@mastra/core/storage';
import { createContext, useCallback, useContext, useMemo } from 'react';
import { useMatch, useNavigate } from 'react-router';

import { experimentReviewQueueLink } from '@/lib/app-routing';
import { useItemPanelKeyboardNav } from '@/lib/use-item-panel-keyboard-nav';

export type ExperimentItemPanelContextValue = {
  experimentId: string;
  datasetId: string;
  experimentStatus?: ExperimentStatus;
  results: DatasetExperimentResult[];
  isLoadingResults: boolean;
  hasNextPage?: boolean;
  /** Item id from the active `items/:itemId` child route, if any. */
  currentItemId?: string;
  openItem: (itemId: string) => void;
  close: () => void;
  /** Close the panel and feature the result on the Review Queue page (via `?review=` search param). */
  openInReview: (resultId: string) => void;
  /** Undefined at the list boundaries so callers can disable navigation. */
  goToPreviousItem?: () => void;
  goToNextItem?: () => void;
};

const ExperimentItemPanelContext = createContext<ExperimentItemPanelContextValue | null>(null);

export type ExperimentItemPanelProviderProps = {
  experimentId: string;
  datasetId: string;
  experimentStatus?: ExperimentStatus;
  results: DatasetExperimentResult[];
  isLoadingResults: boolean;
  hasNextPage?: boolean;
  children: React.ReactNode;
};

export function ExperimentItemPanelProvider({
  experimentId,
  datasetId,
  experimentStatus,
  results,
  isLoadingResults,
  hasNextPage,
  children,
}: ExperimentItemPanelProviderProps) {
  const navigate = useNavigate();
  const match = useMatch('/experiments/:experimentId/items/:itemId');
  const currentItemId = match?.params.itemId;

  const openItem = useCallback(
    (itemId: string) => {
      void navigate(`/experiments/${experimentId}/items/${encodeURIComponent(itemId)}`);
    },
    [navigate, experimentId],
  );

  const close = useCallback(() => {
    void navigate(`/experiments/${experimentId}`);
  }, [navigate, experimentId]);

  const openInReview = useCallback(
    (resultId: string) => {
      void navigate(experimentReviewQueueLink(experimentId, resultId));
    },
    [navigate, experimentId],
  );

  const currentIndex = useMemo(
    () => (currentItemId ? results.findIndex(r => r.itemId === currentItemId) : -1),
    [results, currentItemId],
  );

  const goToPreviousItem = useMemo(() => {
    if (currentIndex <= 0) return undefined;
    const previousItemId = results[currentIndex - 1].itemId;
    return () => openItem(previousItemId);
  }, [currentIndex, results, openItem]);

  const goToNextItem = useMemo(() => {
    if (currentIndex < 0 || currentIndex >= results.length - 1) return undefined;
    const nextItemId = results[currentIndex + 1].itemId;
    return () => openItem(nextItemId);
  }, [currentIndex, results, openItem]);

  // Shared prev/next/close keyboard nav, active while an item is open, focus-independent.
  useItemPanelKeyboardNav({
    active: Boolean(currentItemId),
    onPrevious: goToPreviousItem,
    onNext: goToNextItem,
    onClose: close,
  });

  const value = useMemo<ExperimentItemPanelContextValue>(
    () => ({
      experimentId,
      datasetId,
      experimentStatus,
      results,
      isLoadingResults,
      hasNextPage,
      currentItemId,
      openItem,
      close,
      openInReview,
      goToPreviousItem,
      goToNextItem,
    }),
    [
      experimentId,
      datasetId,
      experimentStatus,
      results,
      isLoadingResults,
      hasNextPage,
      currentItemId,
      openItem,
      close,
      openInReview,
      goToPreviousItem,
      goToNextItem,
    ],
  );

  return <ExperimentItemPanelContext.Provider value={value}>{children}</ExperimentItemPanelContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- context hook intentionally co-located with its provider
export function useExperimentItemPanel() {
  const context = useContext(ExperimentItemPanelContext);
  if (!context) {
    throw new Error('useExperimentItemPanel must be used within an ExperimentItemPanelProvider');
  }
  return context;
}
