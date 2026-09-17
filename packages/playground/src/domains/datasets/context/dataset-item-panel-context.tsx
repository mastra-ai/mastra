import type { DatasetItem } from '@mastra/client-js';
import { createContext, useCallback, useContext, useMemo } from 'react';
import { useMatch, useNavigate } from 'react-router';

import { useItemPanelKeyboardNav } from '@/lib/use-item-panel-keyboard-nav';

export type DatasetItemPanelContextValue = {
  datasetId: string;
  items: DatasetItem[];
  isLoadingItems: boolean;
  /** Item id from the active `items/:itemId` child route, if any. */
  currentItemId?: string;
  openItem: (itemId: string) => void;
  close: () => void;
  /** Undefined at the list boundaries so callers can disable navigation. */
  goToPreviousItem?: () => void;
  goToNextItem?: () => void;
};

const DatasetItemPanelContext = createContext<DatasetItemPanelContextValue | null>(null);

export type DatasetItemPanelProviderProps = {
  datasetId: string;
  items: DatasetItem[];
  isLoadingItems: boolean;
  children: React.ReactNode;
};

export function DatasetItemPanelProvider({
  datasetId,
  items,
  isLoadingItems,
  children,
}: DatasetItemPanelProviderProps) {
  const navigate = useNavigate();
  const match = useMatch('/datasets/:datasetId/items/:itemId');
  const currentItemId = match?.params.itemId;

  const openItem = useCallback(
    (itemId: string) => {
      void navigate(`/datasets/${datasetId}/items/${encodeURIComponent(itemId)}`);
    },
    [navigate, datasetId],
  );

  const close = useCallback(() => {
    void navigate(`/datasets/${datasetId}`);
  }, [navigate, datasetId]);

  const currentIndex = useMemo(
    () => (currentItemId ? items.findIndex(i => i.id === currentItemId) : -1),
    [items, currentItemId],
  );

  const goToPreviousItem = useMemo(() => {
    if (currentIndex <= 0) return undefined;
    const previousItemId = items[currentIndex - 1].id;
    return () => openItem(previousItemId);
  }, [currentIndex, items, openItem]);

  const goToNextItem = useMemo(() => {
    if (currentIndex < 0 || currentIndex >= items.length - 1) return undefined;
    const nextItemId = items[currentIndex + 1].id;
    return () => openItem(nextItemId);
  }, [currentIndex, items, openItem]);

  // Shared prev/next/close keyboard nav, active while an item is open, focus-independent.
  useItemPanelKeyboardNav({
    active: Boolean(currentItemId),
    onPrevious: goToPreviousItem,
    onNext: goToNextItem,
    onClose: close,
  });

  const value = useMemo<DatasetItemPanelContextValue>(
    () => ({
      datasetId,
      items,
      isLoadingItems,
      currentItemId,
      openItem,
      close,
      goToPreviousItem,
      goToNextItem,
    }),
    [datasetId, items, isLoadingItems, currentItemId, openItem, close, goToPreviousItem, goToNextItem],
  );

  return <DatasetItemPanelContext.Provider value={value}>{children}</DatasetItemPanelContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- context hook intentionally co-located with its provider
export function useDatasetItemPanel() {
  const context = useContext(DatasetItemPanelContext);
  if (!context) {
    throw new Error('useDatasetItemPanel must be used within a DatasetItemPanelProvider');
  }
  return context;
}
