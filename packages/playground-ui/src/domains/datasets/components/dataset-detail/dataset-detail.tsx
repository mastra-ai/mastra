import { useState } from 'react';
import { DatasetItem } from '@mastra/client-js';
import { useDataset, useDatasetItems } from '../../hooks/use-datasets';
import { useDatasetRuns } from '../../hooks/use-dataset-runs';
import { useDatasetMutations } from '../../hooks/use-dataset-mutations';
import { ItemsMasterDetail } from './items-master-detail';
import { RunHistory } from './run-history';
import { DatasetHeader } from './dataset-header';
import { CSVImportDialog } from '../csv-import';
import { JSONImportDialog } from '../json-import';
import { CreateDatasetFromItemsDialog } from '../create-dataset-from-items-dialog';
import { Tabs, Tab, TabList, TabContent } from '@/ds/components/Tabs';
import { AlertDialog } from '@/ds/components/AlertDialog';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';

export interface DatasetDetailProps {
  datasetId: string;
  onRunClick?: () => void;
  onEditClick?: () => void;
  onDeleteClick?: () => void;
  onAddItemClick?: () => void;
  runTriggerSlot?: React.ReactNode;
  onNavigateToDataset?: (datasetId: string) => void;
}

type TabValue = 'items' | 'runs';

export function DatasetDetail({
  datasetId,
  onRunClick,
  onEditClick,
  onDeleteClick,
  onAddItemClick,
  runTriggerSlot,
  onNavigateToDataset,
}: DatasetDetailProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('items');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importJsonDialogOpen, setImportJsonDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [itemsForCreate, setItemsForCreate] = useState<DatasetItem[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemIdsToDelete, setItemIdsToDelete] = useState<string[]>([]);
  const [clearSelectionTrigger, setClearSelectionTrigger] = useState(0);
  const [featuredItemId, setSelectedItemId] = useState<string | null>(null);

  const { data: dataset, isLoading: isDatasetLoading } = useDataset(datasetId);
  const {
    data: items = [],
    isLoading: isItemsLoading,
    setEndOfListElement,
    isFetchingNextPage,
    hasNextPage,
  } = useDatasetItems(datasetId);
  const { data: runsData, isLoading: isRunsLoading } = useDatasetRuns(datasetId);
  const { deleteItems } = useDatasetMutations();

  const runs = runsData?.runs ?? [];

  // Item selection handlers
  const handleItemSelect = (itemId: string) => {
    setSelectedItemId(itemId);
  };

  const handleItemClose = () => {
    setSelectedItemId(null);
  };

  // Handler for Create Dataset action from selection
  const handleCreateDatasetClick = (selectedItems: DatasetItem[]) => {
    setItemsForCreate(selectedItems);
    setCreateDialogOpen(true);
  };

  // Handler for bulk delete action from selection
  const handleBulkDeleteClick = (itemIds: string[]) => {
    setItemIdsToDelete(itemIds);
    setDeleteDialogOpen(true);
  };

  // Confirm bulk delete
  const handleBulkDeleteConfirm = async () => {
    await deleteItems.mutateAsync({ datasetId, itemIds: itemIdsToDelete });
    toast.success(`Deleted ${itemIdsToDelete.length} items`);
    setDeleteDialogOpen(false);
    setItemIdsToDelete([]);
    setClearSelectionTrigger(prev => prev + 1);
  };

  // Success callback for create dataset dialog
  const handleCreateSuccess = (newDatasetId: string) => {
    setCreateDialogOpen(false);
    setItemsForCreate([]);
    setClearSelectionTrigger(prev => prev + 1);
    onNavigateToDataset?.(newDatasetId);
  };

  // Clear selection when create dialog closes (even without success)
  const handleCreateDialogOpenChange = (open: boolean) => {
    setCreateDialogOpen(open);
    if (!open) {
      setItemsForCreate([]);
      setClearSelectionTrigger(prev => prev + 1);
    }
  };

  return (
    <div className="h-full overflow-hidden px-6 pb-4" style={{ border: 'px solid blue' }}>
      <div className={cn('h-full w-full', transitions.allSlow)}>
        <div
          className={cn(
            'grid grid-rows-[auto_1fr] mx-auto h-full w-full m-auto',
            featuredItemId ? 'max-w-[100rem]' : 'max-w-[60rem]',
          )}
        >
          {/* Header */}
          <DatasetHeader
            name={dataset?.name}
            description={(dataset as { description?: string } | undefined)?.description}
            version={dataset?.version}
            isLoading={isDatasetLoading}
            onEditClick={onEditClick}
            onDeleteClick={onDeleteClick}
            runTriggerSlot={runTriggerSlot}
            onRunClick={onRunClick}
          />

          {/* Content with tabs */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <Tabs
              defaultTab="items"
              value={activeTab}
              onValueChange={setActiveTab}
              className="grid grid-rows-[auto_1fr] h-full"
            >
              <TabList>
                <Tab value="items">Items ({items.length})</Tab>
                <Tab value="runs">Run History ({runs.length})</Tab>
              </TabList>

              <TabContent value="items" className="flex-1 overflow-hidden mt-4">
                <ItemsMasterDetail
                  datasetId={datasetId}
                  items={items}
                  isLoading={isItemsLoading}
                  featuredItemId={featuredItemId}
                  onItemSelect={handleItemSelect}
                  onItemClose={handleItemClose}
                  onAddClick={onAddItemClick ?? (() => {})}
                  onImportClick={() => setImportDialogOpen(true)}
                  onImportJsonClick={() => setImportJsonDialogOpen(true)}
                  onBulkDeleteClick={handleBulkDeleteClick}
                  onCreateDatasetClick={handleCreateDatasetClick}
                  datasetName={dataset?.name}
                  clearSelectionTrigger={clearSelectionTrigger}
                  setEndOfListElement={setEndOfListElement}
                  isFetchingNextPage={isFetchingNextPage}
                  hasNextPage={hasNextPage}
                />
              </TabContent>

              <TabContent value="runs" className="flex-1 overflow-auto">
                <RunHistory runs={runs} isLoading={isRunsLoading} datasetId={datasetId} />
              </TabContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* CSV Import Dialog */}
      <CSVImportDialog datasetId={datasetId} open={importDialogOpen} onOpenChange={setImportDialogOpen} />

      {/* JSON Import Dialog */}
      <JSONImportDialog datasetId={datasetId} open={importJsonDialogOpen} onOpenChange={setImportJsonDialogOpen} />

      {/* Create Dataset From Items Dialog */}
      <CreateDatasetFromItemsDialog
        open={createDialogOpen}
        onOpenChange={handleCreateDialogOpenChange}
        items={itemsForCreate}
        onSuccess={handleCreateSuccess}
      />

      {/* Bulk Delete Confirmation Dialog */}
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
    </div>
  );
}
