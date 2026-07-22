'use client';

import type { DatasetItem } from '@mastra/client-js';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { toast } from '@mastra/playground-ui/utils/toast';
import { ArrowRightToLineIcon } from 'lucide-react';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { useDatasetItemsUrlState } from '../../hooks/use-dataset-items-url-state';
import type { DatasetVersion } from '../../hooks/use-dataset-versions';
import { useItemSelection } from '../../hooks/use-item-selection';
import { exportItemsToCSV } from '../../utils/csv-export';
import { exportItemsToJSON } from '../../utils/json-export';
import { DatasetItemPanel } from './dataset-item-panel';
import { DatasetItemsLayout } from './dataset-items-layout';
import { DatasetItemsList } from './dataset-items-list';
import { DatasetItemsToolbar } from './dataset-items-toolbar';
import { DatasetVersionsPanel } from './dataset-versions-panel';

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
  /** The live value of the search input (controls the toolbar input). */
  searchQuery?: string;
  /** The debounced search the `items` array reflects (controls the list's empty-state branches). */
  activeSearchQuery?: string;
  onSearchChange?: (query: string) => void;
  // Version props
  currentDatasetVersion?: number;
  onCompareVersionsClick?: (versionNumbers: string[]) => void;
}

/**
 * Container for the dataset items view. Owns the in-memory selection (checkbox)
 * state, builds the three layout slots, and delegates layout to <DatasetItemsLayout>.
 * Selection-mode, versions-panel open state, and active dataset version live in the
 * URL via `useDatasetItemsUrlState` — so refresh and deep links preserve them.
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
  activeSearchQuery,
  onSearchChange,
  currentDatasetVersion,
  onCompareVersionsClick,
}: DatasetItemsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    activeVersion: activeDatasetVersion,
    panel,
    selectionMode,
    handleVersionChange,
    handlePanelChange,
    handleSelectionModeChange,
  } = useDatasetItemsUrlState(searchParams, setSearchParams);

  const isVersionsPanelOpen = panel === 'versions';
  const selection = useItemSelection();
  const featuredItem = items.find(i => i.id === featuredItemId) ?? null;

  // Parent increments this after a dialog closes or an action completes; the
  // selection-mode URL param + in-memory checkbox state both need to reset.
  useEffect(() => {
    if (clearSelectionTrigger !== undefined && clearSelectionTrigger > 0) {
      selection.clearSelection();
      handleSelectionModeChange('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSelectionTrigger]);

  const isViewingOldVersion =
    activeDatasetVersion != null && currentDatasetVersion != null && activeDatasetVersion !== currentDatasetVersion;

  const handleItemClick = (itemId: string) => {
    if (itemId === featuredItemId) {
      onItemClose();
    } else {
      onItemSelect(itemId);
    }
  };

  const handleVersionSelect = (version: DatasetVersion) => {
    handleVersionChange(version.isCurrent ? null : version.version);
  };

  const handleCancelSelection = () => {
    handleSelectionModeChange('idle');
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
    { name: 'id', label: 'ID', size: '7rem' },
    { name: 'input', label: 'Input', size: 'minmax(10rem,1fr)' },
    { name: 'groundTruth', label: 'Ground Truth', size: 'minmax(10rem,1fr)' },
    { name: 'trajectory', label: 'Trajectory', size: '8rem' },
    { name: 'date', label: 'Created', size: '10rem' },
  ];

  const listSlot = (
    <>
      <DatasetItemsToolbar
        onAddClick={onAddClick}
        onImportClick={onImportClick ?? (() => {})}
        onImportJsonClick={onImportJsonClick ?? (() => {})}
        onExportClick={() => handleSelectionModeChange('export')}
        onExportJsonClick={() => handleSelectionModeChange('export-json')}
        onCreateDatasetClick={() => handleSelectionModeChange('create-dataset')}
        onAddToDatasetClick={() => handleSelectionModeChange('add-to-dataset')}
        onDeleteClick={() => handleSelectionModeChange('delete')}
        onCompareClick={() => handleSelectionModeChange('compare-items')}
        hasItems={items.length > 0}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        isSelectionActive={isSelectionActive}
        selectedCount={selection.selectedCount}
        onExecuteAction={handleExecuteAction}
        onCancelSelection={handleCancelSelection}
        selectionMode={selectionMode}
        onVersionsClick={() => handlePanelChange('versions')}
        isItemPanelOpen={!!featuredItem}
        isVersionsPanelOpen={isVersionsPanelOpen}
        isViewingOldVersion={isViewingOldVersion}
      />

      {isViewingOldVersion && activeDatasetVersion != null && (
        <Notice
          variant="warning"
          title="Previous version"
          action={
            <Notice.Button onClick={() => handleVersionChange(null)}>
              <ArrowRightToLineIcon /> Return to the latest version
            </Notice.Button>
          }
        >
          <Notice.Message>Viewing version v{activeDatasetVersion}</Notice.Message>
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
        searchQuery={activeSearchQuery ?? searchQuery}
      />
    </>
  );

  const detailPanelSlot = featuredItem ? (
    <DatasetItemPanel
      key={featuredItem.id}
      datasetId={datasetId}
      item={featuredItem}
      items={items}
      onItemChange={onItemSelect}
      onClose={onItemClose}
    />
  ) : null;

  const versionsPanelSlot = isVersionsPanelOpen ? (
    <DatasetVersionsPanel
      datasetId={datasetId}
      onClose={() => handlePanelChange(null)}
      onVersionSelect={handleVersionSelect}
      onCompareVersionsClick={onCompareVersionsClick}
      activeVersion={activeDatasetVersion}
    />
  ) : null;

  return (
    <DatasetItemsLayout listSlot={listSlot} detailPanelSlot={detailPanelSlot} versionsPanelSlot={versionsPanelSlot} />
  );
}
