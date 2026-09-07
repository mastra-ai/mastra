import type { DatasetItem } from '@mastra/client-js';
import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useDebounce } from 'use-debounce';
import { useDatasetItems } from '../../hooks/use-dataset-items';
import { useDatasetItemsUrlState } from '../../hooks/use-dataset-items-url-state';
import { useDatasetMutations } from '../../hooks/use-dataset-mutations';
import { useDataset } from '../../hooks/use-datasets';
import { AddItemsToDatasetDialog } from '../add-items-to-dataset-dialog';
import { CreateDatasetFromItemsDialog } from '../create-dataset-from-items-dialog';
import { CSVImportDialog } from '../csv-import';
import { DatasetItems } from '../items/dataset-items';
import { JSONImportDialog } from '../json-import';
import { useDatasetItemPanel } from '@/domains/datasets/context/dataset-item-panel-context';

export interface DatasetItemsViewProps {
  datasetId: string;
  onAddItemClick?: () => void;
  onNavigateToDataset?: (datasetId: string) => void;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export function DatasetItemsView({
  datasetId,
  onAddItemClick,
  onNavigateToDataset,
  leftSlot,
  rightSlot,
}: DatasetItemsViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeVersion: activeDatasetVersion } = useDatasetItemsUrlState(searchParams, setSearchParams);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importJsonDialogOpen, setImportJsonDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [itemsForCreate, setItemsForCreate] = useState<DatasetItem[]>([]);
  const [addToDatasetDialogOpen, setAddToDatasetDialogOpen] = useState(false);
  const [itemsForAddToDataset, setItemsForAddToDataset] = useState<DatasetItem[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemIdsToDelete, setItemIdsToDelete] = useState<string[]>([]);
  const [clearSelectionTrigger, setClearSelectionTrigger] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch] = useDebounce(searchQuery, 300);

  const { data: dataset } = useDataset(datasetId);
  const {
    data: items = [],
    isLoading: isItemsLoading,
    setEndOfListElement,
    isFetchingNextPage,
    hasNextPage,
  } = useDatasetItems(datasetId, debouncedSearch || undefined, activeDatasetVersion);
  const { deleteItems } = useDatasetMutations();

  // Clicking the already-open item closes the URL-driven panel.
  const { currentItemId, openItem, close: closeItemPanel } = useDatasetItemPanel();
  const handleItemClick = (itemId: string) => {
    if (currentItemId === itemId) {
      closeItemPanel();
    } else {
      openItem(itemId);
    }
  };

  const handleCreateDatasetClick = (selectedItems: DatasetItem[]) => {
    setItemsForCreate(selectedItems);
    setCreateDialogOpen(true);
  };

  const handleAddToDatasetClick = (selectedItems: DatasetItem[]) => {
    setItemsForAddToDataset(selectedItems);
    setAddToDatasetDialogOpen(true);
  };

  const handleAddToDatasetDialogOpenChange = (open: boolean) => {
    setAddToDatasetDialogOpen(open);
    if (!open) {
      setItemsForAddToDataset([]);
      setClearSelectionTrigger(prev => prev + 1);
    }
  };

  const handleBulkDeleteClick = (itemIds: string[]) => {
    setItemIdsToDelete(itemIds);
    setDeleteDialogOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    await deleteItems.mutateAsync({ datasetId, itemIds: itemIdsToDelete });
    toast.success(`Deleted ${itemIdsToDelete.length} items`);
    setDeleteDialogOpen(false);
    setItemIdsToDelete([]);
    setClearSelectionTrigger(prev => prev + 1);
  };

  const handleCreateSuccess = (newDatasetId: string) => {
    setCreateDialogOpen(false);
    setItemsForCreate([]);
    setClearSelectionTrigger(prev => prev + 1);
    onNavigateToDataset?.(newDatasetId);
  };

  const handleCreateDialogOpenChange = (open: boolean) => {
    setCreateDialogOpen(open);
    if (!open) {
      setItemsForCreate([]);
      setClearSelectionTrigger(prev => prev + 1);
    }
  };

  return (
    <>
      <div className="grid h-full overflow-auto">
        <DatasetItems
          items={items}
          leftSlot={leftSlot}
          rightSlot={rightSlot}
          isLoading={isItemsLoading}
          onItemClick={handleItemClick}
          featuredItemId={currentItemId}
          onAddClick={onAddItemClick ?? (() => {})}
          onImportClick={() => setImportDialogOpen(true)}
          onImportJsonClick={() => setImportJsonDialogOpen(true)}
          onBulkDeleteClick={handleBulkDeleteClick}
          onCreateDatasetClick={handleCreateDatasetClick}
          onAddToDatasetClick={handleAddToDatasetClick}
          datasetName={dataset?.name}
          clearSelectionTrigger={clearSelectionTrigger}
          setEndOfListElement={setEndOfListElement}
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={hasNextPage}
          searchQuery={searchQuery}
          activeSearchQuery={debouncedSearch}
          onSearchChange={setSearchQuery}
          currentDatasetVersion={dataset?.version}
        />
      </div>
      <CSVImportDialog datasetId={datasetId} open={importDialogOpen} onOpenChange={setImportDialogOpen} />
      <JSONImportDialog datasetId={datasetId} open={importJsonDialogOpen} onOpenChange={setImportJsonDialogOpen} />
      <CreateDatasetFromItemsDialog
        open={createDialogOpen}
        onOpenChange={handleCreateDialogOpenChange}
        items={itemsForCreate}
        onSuccess={handleCreateSuccess}
      />
      <AddItemsToDatasetDialog
        open={addToDatasetDialogOpen}
        onOpenChange={handleAddToDatasetDialogOpenChange}
        items={itemsForAddToDataset}
        currentDatasetId={datasetId}
      />
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Delete Items</AlertDialog.Title>
            <AlertDialog.Description>
              Are you sure you want to delete {itemIdsToDelete.length} item
              {itemIdsToDelete.length !== 1 ? 's' : ''}? This action cannot be undone.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action onClick={handleBulkDeleteConfirm}>
              {deleteItems.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </>
  );
}
