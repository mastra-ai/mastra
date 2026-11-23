import { useDatasetItem } from '@mastra/react/hooks/datasets';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useDatasetItemPanel } from '../../context/dataset-item-panel-context';
import { DatasetItemPanel } from './dataset-item-panel';
import { DataPanel } from '@/ds/components/DataPanel';
import { useIsMobile } from '@/hooks/use-is-mobile';

export interface DatasetItemSidePanelProps {
  /** Places the desktop panel; defaults to an aside beside the page. Mobile always uses the drawer. */
  renderInline?: (panel: ReactNode) => ReactNode;
}

const defaultInline = (panel: ReactNode) => (
  <aside className="border-border1 min-h-0 w-md shrink-0 overflow-y-auto border-l">{panel}</aside>
);

/** Shows the item of the `items/:itemId` route: inline on desktop, as a drawer on mobile. */
export function DatasetItemSidePanel({ renderInline = defaultInline }: DatasetItemSidePanelProps) {
  const { datasetId, items, isLoadingItems, currentItemId: itemId, openItem, close } = useDatasetItemPanel();
  const isMobile = useIsMobile();

  const listItem = useMemo(() => (itemId ? items.find(i => i.id === itemId) : undefined), [items, itemId]);

  // Deep links can target items beyond the pages loaded by the infinite list,
  // so fall back to fetching the item by id when it is absent from the list.
  const fetchById = !listItem && Boolean(itemId);
  const { data: fetchedItem, isLoading: isFetchingItem } = useDatasetItem({
    datasetId: fetchById ? datasetId : '',
    itemId: fetchById && itemId ? itemId : '',
    queryOptions: { enabled: fetchById && Boolean(datasetId) },
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
  return renderInline(panel);
}
