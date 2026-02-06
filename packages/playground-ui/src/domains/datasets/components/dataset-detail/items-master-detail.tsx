'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import type { DatasetItem } from '@mastra/client-js';
import { cn } from '@/lib/utils';
import { transitions } from '@/ds/primitives/transitions';
import { Alert, AlertTitle, AlertDescription } from '@/ds/components/Alert';
import { Button } from '@/ds/components/Button';
import { DatasetItemList } from './items-list';
import { ItemDetailPanel } from './item-detail-panel';
import { DatasetVersionsPanel } from '../versions';
import type { DatasetVersion } from '../../hooks/use-dataset-versions';
import { ArrowRightToLineIcon } from 'lucide-react';
import { Columns } from '@/ds/components/Columns/columns';
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
  onImportJsonClick?: () => void;
  onBulkDeleteClick?: (itemIds: string[]) => void;
  onCreateDatasetClick?: (items: DatasetItem[]) => void;
  onAddToDatasetClick?: (items: DatasetItem[]) => void;
  datasetName?: string;
  clearSelectionTrigger?: number;
  // Infinite scroll props
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  // Search props
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  // Version props
  activeDatasetVersion?: Date | string | null;
  currentDatasetVersion?: Date | string;
  onVersionSelect?: (version: DatasetVersion) => void;
}

/**
 * Master-detail layout container for dataset items.
 * Shows item list on left, item detail panel on right when an item is selected.
 * Can also show versions panel instead of item detail when versions is toggled.
 */
export function ItemsMasterDetail({
  datasetId,
  items,
  isLoading,
  featuredItemId,
  onItemSelect,
  onItemClose,
  activeDatasetVersion,
  currentDatasetVersion,
  onVersionSelect,
  ...listProps
}: ItemsMasterDetailProps) {
  const [isVersionsPanelOpen, setIsVersionsPanelOpen] = useState(false);
  const selectedItem = items.find(i => i.id === featuredItemId) ?? null;

  // Check if viewing an old version
  const isViewingOldVersion =
    activeDatasetVersion != null &&
    currentDatasetVersion != null &&
    new Date(activeDatasetVersion).getTime() !== new Date(currentDatasetVersion).getTime();

  const handleItemClick = (itemId: string) => {
    if (itemId === featuredItemId) {
      onItemClose();
    } else {
      onItemSelect(itemId);
    }
  };

  const handleVersionsClick = () => {
    setIsVersionsPanelOpen(prev => !prev);
  };

  const handleVersionsPanelClose = () => {
    setIsVersionsPanelOpen(false);
  };

  // Show side panel if versions is open OR an item is selected
  const isSidePanelActive = Boolean(isVersionsPanelOpen || selectedItem);

  return (
    <Columns isSideColumnVisible={isSidePanelActive}>
      {/* List column - always visible */}
      <div className={cn('flex flex-col h-full overflow-hidden gap-4')}>
        {isViewingOldVersion && activeDatasetVersion && (
          <Alert variant="warning">
            <AlertTitle>
              Viewing version from {format(new Date(activeDatasetVersion), "MMM d, yyyy 'at' h:mm a")}
            </AlertTitle>

            <Button
              variant="default"
              size="sm"
              className="mt-2 mb-1"
              onClick={() => onVersionSelect?.({ version: currentDatasetVersion!, isCurrent: true })}
            >
              <ArrowRightToLineIcon className="inline-block mr-2" /> Return to the latest version
            </Button>
          </Alert>
        )}
        <DatasetItemList
          items={items}
          isLoading={isLoading}
          onItemClick={handleItemClick}
          featuredItemId={featuredItemId}
          onVersionsClick={handleVersionsClick}
          isVersionsPanelOpen={isVersionsPanelOpen}
          hideVersionsButton={!!selectedItem || isVersionsPanelOpen}
          {...listProps}
        />
      </div>

      {/* Detail column - shows versions panel or item detail */}
      {isSidePanelActive && (
        <div
          className={cn('flex flex-col h-full overflow-hidden', {
            'w-[12rem]': isVersionsPanelOpen && !selectedItem,
            'w-[20rem] xl:w-[30rem] 2xl:w-[40rem]': selectedItem,
          })}
        >
          {selectedItem ? (
            <ItemDetailPanel
              datasetId={datasetId}
              item={selectedItem}
              items={items}
              onItemChange={onItemSelect}
              onClose={onItemClose}
            />
          ) : (
            isVersionsPanelOpen && (
              <DatasetVersionsPanel
                datasetId={datasetId}
                onClose={handleVersionsPanelClose}
                onVersionSelect={onVersionSelect}
                activeVersion={activeDatasetVersion}
              />
            )
          )}
        </div>
      )}
    </Columns>
  );
}
