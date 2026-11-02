import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { useDatasetItem } from '@mastra/react/hooks/datasets';
import { useMemo } from 'react';

import { DatasetItemPanel } from '@/domains/datasets/components/items/dataset-item-panel';
import { useDatasetItemPanel } from '@/domains/datasets/context/dataset-item-panel-context';
import { RouteSidePanel, useSelectedItemSidePanel } from '@/lib/route-side-panel';

/**
 * Shows the item of the `items/:itemId` child route in the route side panel,
 * next to the Studio frame. Mobile keeps the drawer, since the edge drawer
 * can't be opened programmatically.
 */
export function DatasetItemSidePanel() {
  const { datasetId, items, isLoadingItems, currentItemId: itemId, openItem, close } = useDatasetItemPanel();
  const isMobile = useIsMobile();
  useSelectedItemSidePanel(itemId, close);

  const listItem = useMemo(() => (itemId ? items.find(i => i.id === itemId) : undefined), [items, itemId]);

  // Deep links can target items beyond the pages loaded by the infinite list,
  // so fall back to fetching the item by id when it is absent from the list.
  const { data: fetchedItem, isLoading: isFetchingItem } = useDatasetItem({
    datasetId: !listItem ? datasetId : '',
    itemId: !listItem && itemId ? itemId : '',
    queryOptions: { enabled: Boolean(!listItem ? datasetId : '') && Boolean(!listItem && itemId ? itemId : '') },
  });
  const item = listItem ?? fetchedItem ?? undefined;

  const panel = (
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
      variant={isMobile ? 'drawer' : 'inline'}
    />
  );

  // The drawer stays mounted so it animates in and out; `itemId` drives `open`.
  if (isMobile) return panel;
  if (!itemId) return null;

  return <RouteSidePanel owner="dataset-item">{panel}</RouteSidePanel>;
}
