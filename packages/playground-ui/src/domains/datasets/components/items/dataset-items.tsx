'use client';

import { useState, useEffect } from 'react';
import type { DatasetItem } from '@mastra/client-js';
import { DatasetItemsList } from './dataset-items-list';
import { DatasetItemsToolbar } from './dataset-items-toolbar';
import { DatasetItemPanel } from './dataset-item-panel';
import { DatasetVersionsPanel } from './dataset-versions-panel';
import type { DatasetVersion } from '../../hooks/use-dataset-versions';
import { AlertTriangleIcon, ArrowRightToLineIcon } from 'lucide-react';
import { useItemSelection } from '../../hooks/use-item-selection';
import { exportItemsToCSV } from '../../utils/csv-export';
import { exportItemsToJSON } from '../../utils/json-export';
import { toast } from '@/lib/toast';
import { cn } from '@/index';
import { Columns, Column } from '@/ds/components/Columns';
import { Notice } from '@/ds/components/Notice';

type SelectionMode =
  | 'idle'
  | 'export'
  | 'export-json'
  | 'create-dataset'
  | 'add-to-dataset'
  | 'delete'
  | 'compare-items';

export interface DatasetItemsProps {
  datasetId: string;
  items: DatasetItem[];
  isLoading: boolean;
  featuredItemId: string | null;
  onItemSelect: (itemId: string) => void;
  onItemClose: () => void;
  onAddClick: () => void;
  onImportClick?: () => void;
  onImportJsonClick?: () => void;
  onBulkDeleteClick?: (itemIds: string[]) => void;
  onCreateDatasetClick?: (items: DatasetItem[]) => void;
  onAddToDatasetClick?: (items: DatasetItem[]) => void;
  onCompareItemsClick?: (itemIds: string[]) => void;
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
  activeDatasetVersion?: number | null;
  currentDatasetVersion?: number;
  onVersionSelect?: (version: DatasetVersion) => void;
  onCompareVersionsClick?: (versionNumbers: string[]) => void;
}

/**
 * Master-detail layout container for dataset items.
 * Shows item list on left, item detail panel on right when an item is selected.
 * Can also show versions panel instead of item detail when versions is toggled.
 */
export function DatasetItems({
  datasetId,
  items,
  isLoading,
  featuredItemId,
  onItemSelect,
  onItemClose,
  onAddClick,
  onImportClick,
  onImportJsonClick,
  onBulkDeleteClick,
  onCreateDatasetClick,
  onAddToDatasetClick,
  onCompareItemsClick,
  datasetName,
  clearSelectionTrigger,
  setEndOfListElement,
  isFetchingNextPage,
  hasNextPage,
  searchQuery,
  onSearchChange,
  activeDatasetVersion,
  currentDatasetVersion,
  onVersionSelect,
  onCompareVersionsClick,
}: DatasetItemsProps) {
  const [isVersionsPanelOpen, setIsVersionsPanelOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('idle');
  const selection = useItemSelection();
  const featuredItem = items.find(i => i.id === featuredItemId) ?? null;

  // Clear selection when parent increments trigger (after dialog closes or action completes)
  useEffect(() => {
    if (clearSelectionTrigger !== undefined && clearSelectionTrigger > 0) {
      selection.clearSelection();
      setSelectionMode('idle');
    }
  }, [clearSelectionTrigger]);

  // Check if viewing an old version
  const isViewingOldVersion =
    activeDatasetVersion != null && currentDatasetVersion != null && activeDatasetVersion !== currentDatasetVersion;

  const handleItemClick = (itemId: string) => {
    if (itemId === featuredItemId) {
      onItemClose();
    } else {
      onItemSelect(itemId);
    }
  };

  const handleVersionsClick = () => {
    setIsVersionsPanelOpen(true);
  };

  const handleVersionsPanelClose = () => {
    setIsVersionsPanelOpen(false);
  };

  const handleCancelSelection = () => {
    setSelectionMode('idle');
    selection.clearSelection();
  };

  const handleExecuteAction = () => {
    if (selection.selectedCount === 0) return;
    const selectedItems = items.filter(i => selection.selectedIds.has(i.id));

    if (selectionMode === 'export') {
      try {
        exportItemsToCSV(selectedItems, `${datasetName || 'dataset'}-items.csv`);
        toast.success(`Exported ${selection.selectedCount} items to CSV`);
      } catch (error) {
        toast.error('Failed to export items to CSV');
        console.error('CSV export error:', error);
      }
      handleCancelSelection();
    } else if (selectionMode === 'export-json') {
      try {
        exportItemsToJSON(selectedItems, `${datasetName || 'dataset'}-items.json`);
        toast.success(`Exported ${selection.selectedCount} items to JSON`);
      } catch (error) {
        toast.error('Failed to export items to JSON');
        console.error('JSON export error:', error);
      }
      handleCancelSelection();
    } else if (selectionMode === 'create-dataset') {
      onCreateDatasetClick?.(selectedItems);
    } else if (selectionMode === 'add-to-dataset') {
      onAddToDatasetClick?.(selectedItems);
    } else if (selectionMode === 'delete') {
      onBulkDeleteClick?.(Array.from(selection.selectedIds));
    } else if (selectionMode === 'compare-items') {
      onCompareItemsClick?.(Array.from(selection.selectedIds));
    }
  };

  const isSelectionActive = selectionMode !== 'idle';

  const itemsListColumns = [
    { name: 'id', label: 'ID', size: '5rem' },
    { name: 'input', label: 'Input', size: '1fr' },
    ...(!featuredItem ? [{ name: 'groundTruth', label: 'Ground Truth', size: '1fr' }] : []),
    { name: 'date', label: 'Created', size: '10rem' },
  ];

  return (
    <Columns
      className={cn({
        'grid-cols-[1fr_1fr]': !!featuredItem,
        'grid-cols-[1fr_auto]': isVersionsPanelOpen && !featuredItem,
      })}
    >
      <Column>
        <DatasetItemsToolbar
          onAddClick={onAddClick}
          onImportClick={onImportClick ?? (() => {})}
          onImportJsonClick={onImportJsonClick ?? (() => {})}
          onExportClick={() => setSelectionMode('export')}
          onExportJsonClick={() => setSelectionMode('export-json')}
          onCreateDatasetClick={() => setSelectionMode('create-dataset')}
          onAddToDatasetClick={() => setSelectionMode('add-to-dataset')}
          onDeleteClick={() => setSelectionMode('delete')}
          onCompareClick={() => setSelectionMode('compare-items')}
          hasItems={items.length > 0}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          isSelectionActive={isSelectionActive}
          selectedCount={selection.selectedCount}
          onExecuteAction={handleExecuteAction}
          onCancelSelection={handleCancelSelection}
          selectionMode={selectionMode}
          onVersionsClick={handleVersionsClick}
          isItemPanelOpen={!!featuredItem}
          isVersionsPanelOpen={isVersionsPanelOpen}
          isViewingOldVersion={isViewingOldVersion}
        />

        {isViewingOldVersion && activeDatasetVersion != null && (
          <Notice variant="warning">
            <AlertTriangleIcon />
            <Notice.Message>Viewing version v{activeDatasetVersion}</Notice.Message>
            <Notice.Button onClick={() => onVersionSelect?.({ version: currentDatasetVersion!, isCurrent: true })}>
              <ArrowRightToLineIcon /> Return to the latest version
            </Notice.Button>
          </Notice>
        )}

        <DatasetItemsList
          items={items}
          isLoading={isLoading}
          onItemClick={handleItemClick}
          featuredItemId={featuredItemId}
          columns={itemsListColumns}
          setEndOfListElement={setEndOfListElement}
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={hasNextPage}
          isSelectionActive={isSelectionActive}
          selectedIds={selection.selectedIds}
          onToggleSelection={selection.toggle}
          onSelectAll={selection.selectAll}
          onClearSelection={selection.clearSelection}
          maxSelection={selectionMode === 'compare-items' ? 2 : undefined}
          onAddClick={onAddClick}
          onImportClick={onImportClick}
          onImportJsonClick={onImportJsonClick}
          searchQuery={searchQuery}
        />
      </Column>

      {!!featuredItem && (
        <DatasetItemPanel
          datasetId={datasetId}
          item={featuredItem}
          items={items}
          onItemChange={onItemSelect}
          onClose={onItemClose}
        />
      )}

      {!featuredItem && isVersionsPanelOpen && (
        <DatasetVersionsPanel
          datasetId={datasetId}
          onClose={handleVersionsPanelClose}
          onVersionSelect={onVersionSelect}
          onCompareVersionsClick={onCompareVersionsClick}
          activeVersion={activeDatasetVersion}
        />
      )}
    </Columns>
  );
}
