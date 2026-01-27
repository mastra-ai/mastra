import { useState } from 'react';
import { DatasetItem } from '@mastra/client-js';
import { useDataset, useDatasetItems } from '../../hooks/use-datasets';
import { useDatasetRuns } from '../../hooks/use-dataset-runs';
import { useDatasetMutations } from '../../hooks/use-dataset-mutations';
import { ItemsList } from './items-list';
import { RunHistory } from './run-history';
import { CSVImportDialog } from '../csv-import';
import { CreateDatasetFromItemsDialog } from '../create-dataset-from-items-dialog';
import { Tabs, Tab, TabList, TabContent } from '@/ds/components/Tabs';
import { Button } from '@/ds/components/Button';
import { Skeleton } from '@/ds/components/Skeleton';
import { AlertDialog } from '@/ds/components/AlertDialog';
import { Icon } from '@/ds/icons/Icon';
import { Play, Database, Pencil, Trash2 } from 'lucide-react';
import { toast } from '@/lib/toast';

export interface DatasetDetailProps {
  datasetId: string;
  onRunClick?: () => void;
  onEditClick?: () => void;
  onDeleteClick?: () => void;
  onAddItemClick?: () => void;
  onEditItem?: (item: DatasetItem) => void;
  onDeleteItem?: (itemId: string) => void;
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
  onEditItem,
  onDeleteItem,
  runTriggerSlot,
  onNavigateToDataset,
}: DatasetDetailProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('items');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [itemsForCreate, setItemsForCreate] = useState<DatasetItem[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemIdsToDelete, setItemIdsToDelete] = useState<string[]>([]);
  const [clearSelectionTrigger, setClearSelectionTrigger] = useState(0);

  const { data: dataset, isLoading: isDatasetLoading } = useDataset(datasetId);
  const { data: itemsData, isLoading: isItemsLoading } = useDatasetItems(datasetId);
  const { data: runsData, isLoading: isRunsLoading } = useDatasetRuns(datasetId);
  const { deleteItems } = useDatasetMutations();

  const items = itemsData?.items ?? [];
  const runs = runsData?.runs ?? [];

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

  // Format version date for display
  const formatVersion = (version: Date | string | undefined): string => {
    if (!version) return '';
    const d = typeof version === 'string' ? new Date(version) : version;
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="grid grid-rows-[auto_1fr] h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-6 gap-4">
        <div className="flex items-center gap-3">
          <Icon className="text-neutral3">
            <Database />
          </Icon>
          {isDatasetLoading ? (
            <Skeleton className="h-6 w-48" />
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-medium text-neutral6">
                {dataset?.name ?? 'Dataset'}
              </h1>
              {dataset?.version && (
                <span className="text-ui-sm text-neutral3 font-normal">
                  v{formatVersion(dataset.version)}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onEditClick && (
            <Button variant="outline" size="sm" onClick={onEditClick}>
              <Icon>
                <Pencil />
              </Icon>
              Edit
            </Button>
          )}
          {onDeleteClick && (
            <Button variant="outline" size="sm" onClick={onDeleteClick}>
              <Icon>
                <Trash2 />
              </Icon>
              Delete
            </Button>
          )}
          {runTriggerSlot ? (
            runTriggerSlot
          ) : onRunClick ? (
            <Button variant="primary" size="sm" onClick={onRunClick}>
              <Icon>
                <Play />
              </Icon>
              Run
            </Button>
          ) : null}
        </div>
      </header>

      {/* Content with tabs */}
      <div className="flex-1 overflow-hidden border-t border-border1 flex flex-col">
        <Tabs defaultTab="items" value={activeTab} onValueChange={setActiveTab}>
          <TabList>
            <Tab value="items">Items ({items.length})</Tab>
            <Tab value="runs">Run History ({runs.length})</Tab>
          </TabList>

          <TabContent value="items" className="flex-1 overflow-auto">
            <ItemsList
              items={items}
              isLoading={isItemsLoading}
              onAddClick={onAddItemClick ?? (() => {})}
              onEditItem={onEditItem}
              onDeleteItem={onDeleteItem}
              onImportClick={() => setImportDialogOpen(true)}
              onBulkDeleteClick={handleBulkDeleteClick}
              onCreateDatasetClick={handleCreateDatasetClick}
              datasetName={dataset?.name}
              clearSelectionTrigger={clearSelectionTrigger}
            />
          </TabContent>

          <TabContent value="runs" className="flex-1 overflow-auto">
            <RunHistory
              runs={runs}
              isLoading={isRunsLoading}
              datasetId={datasetId}
            />
          </TabContent>
        </Tabs>
      </div>

      {/* CSV Import Dialog */}
      <CSVImportDialog
        datasetId={datasetId}
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />

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
