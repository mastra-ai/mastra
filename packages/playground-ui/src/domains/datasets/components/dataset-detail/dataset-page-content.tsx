import { useState } from 'react';
import { useDebounce } from 'use-debounce';
import { DatasetItem } from '@mastra/client-js';
import { useDataset } from '../../hooks/use-datasets';
import { useDatasetItems } from '../../hooks/use-dataset-items';
import { useDatasetExperiments, type DatasetExperimentsFilters } from '../../hooks/use-dataset-experiments';
import { useDatasetMutations } from '../../hooks/use-dataset-mutations';
import type { DatasetVersion } from '../../hooks/use-dataset-versions';
import { DatasetItems } from '../items/dataset-items';
import { DatasetExperiments } from '../experiments/dataset-experiments';
import { DatasetHeader } from './dataset-header';
import { CSVImportDialog } from '../csv-import';
import { JSONImportDialog } from '../json-import';
import { CreateDatasetFromItemsDialog } from '../create-dataset-from-items-dialog';
import { AddItemsToDatasetDialog } from '../add-items-to-dataset-dialog';
import { DuplicateDatasetDialog } from '../duplicate-dataset-dialog';
import { Tabs, Tab, TabList, TabContent } from '@/ds/components/Tabs';
import { AlertDialog } from '@/ds/components/AlertDialog';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { useLinkComponent } from '@/lib/framework';
import { Chip } from '@/ds/components/Chip';

export interface DatasetPageContentProps {
  datasetId: string;
  onExperimentClick?: () => void;
  onEditClick?: () => void;
  onDeleteClick?: () => void;
  onAddItemClick?: () => void;
  experimentTriggerSlot?: React.ReactNode;
  onNavigateToDataset?: (datasetId: string) => void;
  // Controlled mode: parent manages version state
  activeDatasetVersion?: number | null;
  onVersionSelect?: (version: DatasetVersion | null) => void;
}

type TabValue = 'items' | 'experiments';

export function DatasetPageContent({
  datasetId,
  onExperimentClick,
  onEditClick,
  onDeleteClick,
  onAddItemClick,
  experimentTriggerSlot,
  onNavigateToDataset,
  activeDatasetVersion: controlledVersion,
  onVersionSelect: onVersionSelectProp,
}: DatasetPageContentProps) {
  const { navigate } = useLinkComponent();
  const [activeTab, setActiveTab] = useState<TabValue>('items');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importJsonDialogOpen, setImportJsonDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [itemsForCreate, setItemsForCreate] = useState<DatasetItem[]>([]);
  const [addToDatasetDialogOpen, setAddToDatasetDialogOpen] = useState(false);
  const [itemsForAddToDataset, setItemsForAddToDataset] = useState<DatasetItem[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemIdsToDelete, setItemIdsToDelete] = useState<string[]>([]);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [clearSelectionTrigger, setClearSelectionTrigger] = useState(0);
  const [featuredItemId, setSelectedItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch] = useDebounce(searchQuery, 300);
  // Internal state only used when not in controlled mode
  const [internalVersion, setInternalVersion] = useState<number | null>(null);
  // Use controlled version if provided, otherwise internal state
  const isControlled = controlledVersion !== undefined;
  const activeDatasetVersion = isControlled ? controlledVersion : internalVersion;

  const { data: dataset, isLoading: isDatasetLoading } = useDataset(datasetId);
  const {
    data: items = [],
    isLoading: isItemsLoading,
    setEndOfListElement,
    isFetchingNextPage,
    hasNextPage,
  } = useDatasetItems(datasetId, debouncedSearch || undefined, activeDatasetVersion);
  const [experimentsFilters, setExperimentsFilters] = useState<DatasetExperimentsFilters>({});
  const { data: experimentsData, isLoading: isExperimentsLoading } = useDatasetExperiments(
    datasetId,
    undefined,
    experimentsFilters,
  );
  // Fetch unfiltered list separately for deriving filter options (uses query cache when no filters active)
  const { data: allExperimentsData } = useDatasetExperiments(datasetId);
  const { deleteItems } = useDatasetMutations();

  const experiments = experimentsData?.experiments ?? [];
  const allExperiments = allExperimentsData?.experiments ?? [];

  // Item selection handlers
  const handleItemSelect = (itemId: string) => {
    setSelectedItemId(itemId);
  };

  const handleItemClose = () => {
    setSelectedItemId(null);
  };

  // Version selection handler - supports both controlled and uncontrolled modes
  const handleVersionSelect = (version: DatasetVersion) => {
    const newValue = version.isCurrent ? null : version;
    // In controlled mode, call parent callback
    if (onVersionSelectProp) {
      onVersionSelectProp(newValue);
    } else {
      // Uncontrolled mode - update internal state
      setInternalVersion(version.isCurrent ? null : version.version);
    }
  };

  // Handler for Create Dataset action from selection
  const handleCreateDatasetClick = (selectedItems: DatasetItem[]) => {
    setItemsForCreate(selectedItems);
    setCreateDialogOpen(true);
  };

  // Handler for Add to Dataset action from selection
  const handleAddToDatasetClick = (selectedItems: DatasetItem[]) => {
    setItemsForAddToDataset(selectedItems);
    setAddToDatasetDialogOpen(true);
  };

  // Clear selection when add to dataset dialog closes
  const handleAddToDatasetDialogOpenChange = (open: boolean) => {
    setAddToDatasetDialogOpen(open);
    if (!open) {
      setItemsForAddToDataset([]);
      setClearSelectionTrigger(prev => prev + 1);
    }
  };

  // Handler for Compare Items action from selection
  const handleCompareItemsClick = (itemIds: string[]) => {
    navigate(`/datasets/${datasetId}/items?items=${itemIds.join(',')}`);
  };

  // Handler for Compare Versions action from versions panel
  const handleCompareVersionsClick = (versionNumbers: string[]) => {
    navigate(`/datasets/${datasetId}/versions?ids=${versionNumbers.join(',')}`);
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
    <>
      <div className="h-full overflow-hidden px-[3vw] pb-4">
        <div className={cn('h-full w-full', transitions.allSlow)}>
          <div
            className={cn(
              'grid grid-rows-[auto_1fr] mx-auto h-full w-full m-auto',
              featuredItemId ? 'max-w-[120rem]' : 'max-w-[90rem]',
            )}
          >
            <DatasetHeader
              dataset={dataset}
              isLoading={isDatasetLoading}
              onEditClick={onEditClick}
              onDuplicateClick={() => setDuplicateDialogOpen(true)}
              onDeleteClick={onDeleteClick}
              experimentTriggerSlot={experimentTriggerSlot}
              onExperimentClick={onExperimentClick}
            />

            <div className="flex-1 overflow-hidden flex flex-col">
              <Tabs
                defaultTab="items"
                value={activeTab}
                onValueChange={setActiveTab}
                className="grid grid-rows-[auto_1fr] h-full"
              >
                <TabList>
                  <Tab value="items">
                    Items <Chip color="gray">{items.length}</Chip>
                  </Tab>
                  <Tab value="experiments">
                    Experiments
                    <Chip color="gray">{experiments.length}</Chip>
                  </Tab>
                </TabList>

                <TabContent value="items" className="grid overflow-auto mt-5">
                  <DatasetItems
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
                    onAddToDatasetClick={handleAddToDatasetClick}
                    onCompareItemsClick={handleCompareItemsClick}
                    datasetName={dataset?.name}
                    clearSelectionTrigger={clearSelectionTrigger}
                    setEndOfListElement={setEndOfListElement}
                    isFetchingNextPage={isFetchingNextPage}
                    hasNextPage={hasNextPage}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    activeDatasetVersion={activeDatasetVersion}
                    currentDatasetVersion={dataset?.version}
                    onVersionSelect={handleVersionSelect}
                    onCompareVersionsClick={handleCompareVersionsClick}
                  />
                </TabContent>

                <TabContent value="experiments" className="grid overflow-auto mt-5">
                  <DatasetExperiments
                    experiments={experiments}
                    allExperiments={allExperiments}
                    isLoading={isExperimentsLoading}
                    datasetId={datasetId}
                    filters={experimentsFilters}
                    onFiltersChange={setExperimentsFilters}
                  />
                </TabContent>
              </Tabs>
            </div>
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
      {/* Add Items to Dataset Dialog */}
      <AddItemsToDatasetDialog
        open={addToDatasetDialogOpen}
        onOpenChange={handleAddToDatasetDialogOpenChange}
        items={itemsForAddToDataset}
        currentDatasetId={datasetId}
      />
      {/* Duplicate Dataset Dialog */}
      <DuplicateDatasetDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
        sourceDatasetId={datasetId}
        sourceDatasetName={dataset?.name || ''}
        sourceDatasetDescription={(dataset as { description?: string } | undefined)?.description}
        onSuccess={onNavigateToDataset}
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
    </>
  );
}
