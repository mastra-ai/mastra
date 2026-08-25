import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { DatabaseIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useParams } from 'react-router';

import { RouteItemOverlay } from '@/components/route-item-overlay';
import { DatasetItemPanel } from '@/domains/datasets/components/items/dataset-item-panel';
import { useDatasetItemPanel } from '@/domains/datasets/context/dataset-item-panel-context';

function DatasetItemPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const { datasetId, items, isLoadingItems, openItem, close } = useDatasetItemPanel();

  const item = useMemo(() => items.find(i => i.id === itemId) ?? null, [items, itemId]);

  if (!itemId) return null;

  return (
    <RouteItemOverlay label={`Dataset item ${itemId}`}>
      {item ? (
        <div className="[&>section]:bg-surface3 flex min-h-full flex-col p-3 [&>section]:min-h-0 [&>section]:flex-1 [&>section]:rounded-lg [&>section]:shadow-lg">
          <DatasetItemPanel datasetId={datasetId} item={item} items={items} onItemChange={openItem} onClose={close} />
        </div>
      ) : isLoadingItems ? (
        <div className="h-full p-3">
          <div className="border-border1 bg-surface3 flex h-full items-center justify-center rounded-lg border shadow-lg">
            <Spinner />
          </div>
        </div>
      ) : (
        <div className="h-full p-3">
          <div className="border-border1 bg-surface3 flex h-full items-center justify-center rounded-lg border shadow-lg">
            <EmptyState
              iconSlot={<DatabaseIcon />}
              titleSlot="Item not found"
              descriptionSlot={`No loaded item "${itemId}".`}
              actionSlot={<Button onClick={close}>Close</Button>}
            />
          </div>
        </div>
      )}
    </RouteItemOverlay>
  );
}

export { DatasetItemPage };
export default DatasetItemPage;
