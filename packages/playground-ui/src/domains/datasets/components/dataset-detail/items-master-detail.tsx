'use client';

import type { DatasetItem } from '@mastra/client-js';
import { cn } from '@/lib/utils';
import { transitions } from '@/ds/primitives/transitions';
import { ItemsList } from './items-list';
import { ItemDetailPanel } from './item-detail-panel';

export interface ItemsMasterDetailProps {
  datasetId: string;
  items: DatasetItem[];
  isLoading: boolean;
  selectedItemId: string | null;
  onItemSelect: (itemId: string) => void;
  onItemClose: () => void;
  // Pass-through props for ItemsList
  onAddClick: () => void;
  onImportClick?: () => void;
  onBulkDeleteClick?: (itemIds: string[]) => void;
  onCreateDatasetClick?: (items: DatasetItem[]) => void;
  datasetName?: string;
  clearSelectionTrigger?: number;
}

/**
 * Master-detail layout container for dataset items.
 * Shows item list on left, item detail panel on right when an item is selected.
 */
export function ItemsMasterDetail({
  datasetId,
  items,
  isLoading,
  selectedItemId,
  onItemSelect,
  onItemClose,
  ...listProps
}: ItemsMasterDetailProps) {
  const selectedItem = items.find(i => i.id === selectedItemId) ?? null;

  return (
    <div
      className={cn(
        'grid h-full overflow-hidden',
        transitions.allSlow, // 300ms transition
        selectedItemId ? 'grid-cols-[minmax(300px,45%)_minmax(400px,55%)]' : 'grid-cols-1',
      )}
    >
      {/* List column - always visible */}
      <div className={cn('flex flex-col h-full overflow-hidden', selectedItemId && 'border-r border-border1')}>
        <ItemsList
          items={items}
          isLoading={isLoading}
          onItemClick={onItemSelect}
          selectedItemId={selectedItemId}
          {...listProps}
        />
      </div>

      {/* Detail column - conditional */}
      {selectedItem && (
        <div className="flex flex-col h-full overflow-hidden">
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
