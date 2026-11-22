'use client';

import type { DatasetExperimentResult } from '@mastra/client-js';
import type { ExperimentStatus } from '@mastra/core/storage';
import { createContext, useContext, useMemo } from 'react';
import { useItemPanelKeyboardNav } from '@/lib/keyboard/use-item-panel-keyboard-nav';

export type ExperimentItemPanelContextValue = {
  experimentId: string;
  datasetId: string;
  experimentStatus?: ExperimentStatus;
  results: DatasetExperimentResult[];
  isLoadingResults: boolean;
  hasNextPage?: boolean;
  currentItemId?: string;
  openItem: (itemId: string) => void;
  close: () => void;
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
  /** Item whose panel is open, e.g. from the host's `items/:itemId` route. */
  currentItemId?: string;
  onOpenItem: (itemId: string) => void;
  onClose: () => void;
  children: React.ReactNode;
};

export function ExperimentItemPanelProvider({
  experimentId,
  datasetId,
  experimentStatus,
  results,
  isLoadingResults,
  hasNextPage,
  currentItemId,
  onOpenItem: openItem,
  onClose: close,
  children,
}: ExperimentItemPanelProviderProps) {
  const currentIndex = useMemo(
    () => (currentItemId ? results.findIndex(r => r.itemId === currentItemId) : -1),
    [results, currentItemId],
  );

  const goToPreviousItem = useMemo(() => {
    const previous = currentIndex > 0 ? results[currentIndex - 1] : undefined;
    if (!previous) return undefined;
    return () => openItem(previous.itemId);
  }, [currentIndex, results, openItem]);

  const goToNextItem = useMemo(() => {
    const next = currentIndex >= 0 ? results[currentIndex + 1] : undefined;
    if (!next) return undefined;
    return () => openItem(next.itemId);
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
