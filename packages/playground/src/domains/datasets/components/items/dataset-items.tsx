'use client';

import type { DatasetItem } from '@mastra/client-js';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { useDatasetItemsUrlState } from '../../hooks/use-dataset-items-url-state';
import { useItemSelection } from '../../hooks/use-item-selection';
import { exportItemsToCSV } from '../../utils/csv-export';
import { exportItemsToJSON } from '../../utils/json-export';
import { DatasetItemsLayout } from './dataset-items-layout';
import { DatasetItemsList } from './dataset-items-list';
import { DatasetItemsToolbar } from './dataset-items-toolbar';

export interface DatasetItemsProps {
  items: DatasetItem[];
  /** Page-level content rendered before the list actions in the toolbar row. */
  leftSlot?: React.ReactNode;
  /** Page-level actions rendered at the end of the toolbar row. */
  rightSlot?: React.ReactNode;
  isLoading: boolean;
  onItemClick: (itemId: string) => void;
  /** Id of the item currently open in the URL-driven item panel, if any. */
  featuredItemId?: string | null;
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
  /** The live value of the search input (controls the toolbar input). */
  searchQuery?: string;
  /** The debounced search the `items` array reflects (controls the list's empty-state branches). */
  activeSearchQuery?: string;
  onSearchChange?: (query: string) => void;
  // Version props
  currentDatasetVersion?: number;
}

/**
 * Container for the dataset items view. Owns the in-memory selection (checkbox)
 * state and delegates layout to <DatasetItemsLayout>. Clicking an item is
 * delegated to the parent via `onItemClick` (which navigates to the item page).
 * Checkboxes are always available on the current dataset version; once at least one
 * item is checked, the toolbar swaps to contextual actions for the selection.
 * Versions-panel open state and active dataset version live in the URL via
 * `useDatasetItemsUrlState` — so refresh and deep links preserve them.
 */
export function DatasetItems({
  items,
  leftSlot,
  rightSlot,
  isLoading,
  onItemClick,
  featuredItemId,
  onAddClick,
  onImportClick,
  onImportJsonClick,
  onBulkDeleteClick,
  onCreateDatasetClick,
  onAddToDatasetClick,
  datasetName,
  clearSelectionTrigger,
  setEndOfListElement,
  isFetchingNextPage,
  hasNextPage,
  searchQuery,
  activeSearchQuery,
  onSearchChange,
  currentDatasetVersion,
}: DatasetItemsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeVersion: activeDatasetVersion, handleVersionChange } = useDatasetItemsUrlState(
    searchParams,
    setSearchParams,
  );

  const selection = useItemSelection();

  // Parent increments this after a dialog closes or an action completes; the
  // in-memory checkbox state needs to reset.
  useEffect(() => {
    if (clearSelectionTrigger !== undefined && clearSelectionTrigger > 0) {
      selection.clearSelection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSelectionTrigger]);

  const isViewingOldVersion =
    activeDatasetVersion != null && currentDatasetVersion != null && activeDatasetVersion !== currentDatasetVersion;

  const getSelectedItems = () => items.filter(i => selection.selectedIds.has(i.id));

  const handleExportCsv = () => {
    try {
      exportItemsToCSV(getSelectedItems(), `${datasetName || 'dataset'}-items.csv`);
      toast.success(`Exported ${selection.selectedCount} items to CSV`);
      selection.clearSelection();
    } catch (error) {
      toast.error('Failed to export items to CSV');
      console.error('CSV export error:', error);
    }
  };

  const handleExportJson = () => {
    try {
      exportItemsToJSON(getSelectedItems(), `${datasetName || 'dataset'}-items.json`);
      toast.success(`Exported ${selection.selectedCount} items to JSON`);
      selection.clearSelection();
    } catch (error) {
      toast.error('Failed to export items to JSON');
      console.error('JSON export error:', error);
    }
  };

  const itemsListColumns = [
    { name: 'id', label: 'ID', size: '7rem' },
    { name: 'input', label: 'Input', size: 'minmax(10rem,1fr)' },
    { name: 'groundTruth', label: 'Ground Truth', size: 'minmax(10rem,1fr)' },
    { name: 'trajectory', label: 'Trajectory', size: '8rem' },
    { name: 'date', label: 'Created', size: '10rem' },
  ];

  // Checkboxes are always available on the current version; older versions are read-only.
  const isSelectionActive = !isViewingOldVersion;

  const listSlot = (
    <>
      <DatasetItemsToolbar
        onAddClick={onAddClick}
        onImportClick={onImportClick ?? (() => {})}
        onImportJsonClick={onImportJsonClick ?? (() => {})}
        hasItems={items.length > 0}
        leftSlot={leftSlot}
        rightSlot={rightSlot}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        selectedCount={selection.selectedCount}
        onExportClick={handleExportCsv}
        onExportJsonClick={handleExportJson}
        onCreateDatasetClick={onCreateDatasetClick ? () => onCreateDatasetClick(getSelectedItems()) : undefined}
        onAddToDatasetClick={onAddToDatasetClick ? () => onAddToDatasetClick(getSelectedItems()) : undefined}
        onDeleteClick={onBulkDeleteClick ? () => onBulkDeleteClick(Array.from(selection.selectedIds)) : undefined}
        isItemPanelOpen={false}
        isViewingOldVersion={isViewingOldVersion}
        activeDatasetVersion={activeDatasetVersion}
        onReturnToLatestVersion={() => handleVersionChange(null)}
      />

      <DatasetItemsList
        items={items}
        isLoading={isLoading}
        onItemClick={onItemClick}
        featuredItemId={featuredItemId ?? null}
        columns={itemsListColumns}
        setEndOfListElement={setEndOfListElement}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        isSelectionActive={isSelectionActive}
        selectedIds={selection.selectedIds}
        onToggleSelection={selection.toggle}
        onSelectAll={selection.selectAll}
        onClearSelection={selection.clearSelection}
        onAddClick={onAddClick}
        onImportClick={onImportClick}
        onImportJsonClick={onImportJsonClick}
        searchQuery={activeSearchQuery ?? searchQuery}
      />
    </>
  );

  return <DatasetItemsLayout listSlot={listSlot} />;
}
