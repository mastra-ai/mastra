import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { useMemo } from 'react';

import { DatasetItemPanel } from '@/domains/datasets/components/items/dataset-item-panel';
import { useDatasetItemPanel } from '@/domains/datasets/context/dataset-item-panel-context';
import { useDatasetItem } from '@/domains/datasets/hooks/use-dataset-items';

/**
 * Item drawer for the `items/:itemId` child route. Always mounted by the
 * dataset page so the drawer animates in and out; `currentItemId` drives `open`.
 */
export function DatasetItemDrawer() {
  const { datasetId, items, isLoadingItems, currentItemId: itemId, openItem, close } = useDatasetItemPanel();

  const listItem = useMemo(() => (itemId ? items.find(i => i.id === itemId) : undefined), [items, itemId]);

  // Deep links can target items beyond the pages loaded by the infinite list,
  // so fall back to fetching the item by id when it is absent from the list.
  const { data: fetchedItem, isLoading: isFetchingItem } = useDatasetItem(
    !listItem ? datasetId : '',
    !listItem && itemId ? itemId : '',
  );
  const item = listItem ?? fetchedItem ?? undefined;

  return (
    <DatasetItemPanel
      datasetId={datasetId}
      item={item}
      itemId={itemId}
      fallback={
        isLoadingItems || isFetchingItem ? (
          <DataPanel.LoadingData />
        ) : (
          <DataPanel.NoData>No loaded item "{itemId}".</DataPanel.NoData>
        )
      }
      items={items}
      onItemChange={openItem}
      onClose={close}
    />
  );
}
