'use client';

import type { DatasetItem } from '@mastra/client-js';
import { cn } from '@/lib/utils';
import { transitions } from '@/ds/primitives/transitions';
import { DatasetItemList } from './items-list';
import { ItemDetailPanel } from './item-detail-panel';

export interface ItemsMasterDetailProps {
  datasetId: string;
  items: DatasetItem[];
  isLoading: boolean;
  featuredItemId: string | null;
  onItemSelect: (itemId: string) => void;
  onItemClose: () => void;
  // Pass-through props for ItemsList
  onAddClick: () => void;
  onImportClick?: () => void;
  onBulkDeleteClick?: (itemIds: string[]) => void;
  onCreateDatasetClick?: (items: DatasetItem[]) => void;
  datasetName?: string;
  clearSelectionTrigger?: number;
  // Infinite scroll props
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
}

/**
 * Master-detail layout container for dataset items.
 * Shows item list on left, item detail panel on right when an item is selected.
 */
export function ItemsMasterDetail({
  datasetId,
  items,
  isLoading,
  featuredItemId,
  onItemSelect,
  onItemClose,
  ...listProps
}: ItemsMasterDetailProps) {
  const selectedItem = items.find(i => i.id === featuredItemId) ?? null;

  const handleItemClick = (itemId: string) => {
    if (itemId === featuredItemId) {
      onItemClose();
    } else {
      onItemSelect(itemId);
    }
  };

  return (
    <div
      className={cn(
        'grid h-full overflow-hidden gap-10',
        transitions.allSlow, // 300ms transition
        featuredItemId ? 'grid-cols-[1fr_auto]' : 'grid-cols-1',
      )}
    >
      {/* List column - always visible */}
      <div className={cn('flex flex-col h-full overflow-hidden')}>
        <DatasetItemList
          items={items}
          isLoading={isLoading}
          onItemClick={handleItemClick}
          featuredItemId={featuredItemId}
          {...listProps}
        />
      </div>

      {/* Detail column - conditional */}
      {selectedItem && (
        <div className="flex flex-col h-full overflow-hidden w-[20rem] xl:w-[30rem] 2xl:w-[40rem]">
          <ItemDetailPanel
            datasetId={datasetId}
            item={selectedItem}
            items={items}
            onItemChange={onItemSelect}
            onClose={onItemClose}
          />
        </div>
      )}
    </div>
  );
}
