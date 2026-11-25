import type { DatasetItem } from '@mastra/client-js';
import { createContext, useCallback, useContext, useMemo } from 'react';
import { useLinkComponent } from '@/lib/framework';
import { useItemPanelKeyboardNav } from '@/lib/keyboard/use-item-panel-keyboard-nav';

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
  /** Item id from the app's `items/:itemId` route, if one is open. */
  currentItemId?: string;
  children: React.ReactNode;
};

export function DatasetItemPanelProvider({
  datasetId,
  items,
  isLoadingItems,
  currentItemId,
  children,
}: DatasetItemPanelProviderProps) {
  const { navigate, paths } = useLinkComponent();

  const openItem = useCallback(
    (itemId: string) => {
      navigate(paths.datasetItemLink(datasetId, itemId));
    },
    [navigate, paths, datasetId],
  );

  const close = useCallback(() => {
    navigate(paths.datasetLink(datasetId));
  }, [navigate, paths, datasetId]);

  const currentIndex = useMemo(
    () => (currentItemId ? items.findIndex(i => i.id === currentItemId) : -1),
    [items, currentItemId],
  );

  const goToPreviousItem = useMemo(() => {
    const previousItemId = currentIndex > 0 ? items[currentIndex - 1]?.id : undefined;
    if (!previousItemId) return undefined;
    return () => openItem(previousItemId);
  }, [currentIndex, items, openItem]);

  const goToNextItem = useMemo(() => {
    const nextItemId = currentIndex >= 0 ? items[currentIndex + 1]?.id : undefined;
    if (!nextItemId) return undefined;
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
