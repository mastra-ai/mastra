import type { DatasetItem } from '@mastra/client-js';
import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Chip } from '@mastra/playground-ui/components/Chip';
import { Tabs, Tab, TabList, TabContent } from '@mastra/playground-ui/components/Tabs';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useDebounce } from 'use-debounce';
import { useDatasetExperiments } from '../../hooks/use-dataset-experiments';
import type { DatasetExperimentsFilters } from '../../hooks/use-dataset-experiments';
import { useDatasetItems } from '../../hooks/use-dataset-items';
import { useDatasetItemsUrlState } from '../../hooks/use-dataset-items-url-state';
import { useDatasetMutations } from '../../hooks/use-dataset-mutations';
import { useDataset } from '../../hooks/use-datasets';
import { getItemsTabCount } from '../../utils/tab-counts';
import { AddItemsToDatasetDialog } from '../add-items-to-dataset-dialog';
import { CreateDatasetFromItemsDialog } from '../create-dataset-from-items-dialog';
import { CSVImportDialog } from '../csv-import';
import { DatasetExperiments } from '../experiments/dataset-experiments';
import { DatasetItems } from '../items/dataset-items';
import { JSONImportDialog } from '../json-import';
import { DatasetReview } from '@/domains/review/components/dataset-review';
import { useDatasetReviewItems } from '@/domains/review/hooks/use-dataset-review-items';
import { useLinkComponent } from '@/lib/framework';

export interface DatasetPageTabsProps {
  datasetId: string;
  onAddItemClick?: () => void;
  onNavigateToDataset?: (datasetId: string) => void;
}

export type TabValue = 'items' | 'experiments' | 'review';

export function DatasetPageTabs({ datasetId, onAddItemClick, onNavigateToDataset }: DatasetPageTabsProps) {
  const { navigate } = useLinkComponent();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    tab: activeTab,
    activeVersion: activeDatasetVersion,
    handleTabChange,
  } = useDatasetItemsUrlState(searchParams, setSearchParams);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importJsonDialogOpen, setImportJsonDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [itemsForCreate, setItemsForCreate] = useState<DatasetItem[]>([]);
  const [addToDatasetDialogOpen, setAddToDatasetDialogOpen] = useState(false);
  const [itemsForAddToDataset, setItemsForAddToDataset] = useState<DatasetItem[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemIdsToDelete, setItemIdsToDelete] = useState<string[]>([]);
  const [clearSelectionTrigger, setClearSelectionTrigger] = useState(0);
  const [featuredItemId, setSelectedItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch] = useDebounce(searchQuery, 300);

  const { data: dataset } = useDataset(datasetId);
  const {
    data: items = [],
    total: itemsTotal,
    isLoading: isItemsLoading,
    setEndOfListElement,
    isFetchingNextPage,
    hasNextPage,
  } = useDatasetItems(datasetId, debouncedSearch || undefined, activeDatasetVersion);
  // Unfiltered items count — used for the Items tab count when a search is
  // active so the count reflects total dataset size, not just matches.
  const { total: unfilteredItemsTotal } = useDatasetItems(datasetId, undefined, activeDatasetVersion);
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
  const itemsTabCount = getItemsTabCount({
    hasSearchQuery: Boolean(debouncedSearch),
    filteredItemsLength: items.length,
    unfilteredItemsTotal,
    itemsTotal,
  });
  const { data: reviewItems } = useDatasetReviewItems(datasetId);
  const reviewCount = reviewItems?.length ?? 0;

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
      <Tabs
        defaultTab="items"
        value={activeTab}
        onValueChange={handleTabChange}
        className="grid h-full grid-rows-[auto_1fr]"
      >
        <TabList>
          <Tab value="items">
            Items <Chip color="gray">{itemsTabCount}</Chip>
          </Tab>
          <Tab value="experiments">
            Experiments
            <Chip color="gray">{experiments.length}</Chip>
          </Tab>
          <Tab value="review">
            Review
            {reviewCount > 0 && <Chip color="orange">{reviewCount}</Chip>}
          </Tab>
        </TabList>

        <TabContent value="items" className="mt-5 grid overflow-auto pb-0">
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
            activeSearchQuery={debouncedSearch}
            onSearchChange={setSearchQuery}
            currentDatasetVersion={dataset?.version}
            onCompareVersionsClick={handleCompareVersionsClick}
          />
        </TabContent>

        <TabContent value="experiments" className="mt-5 grid overflow-auto pb-0">
          <DatasetExperiments
            experiments={experiments}
            allExperiments={allExperiments}
            isLoading={isExperimentsLoading}
            datasetId={datasetId}
            filters={experimentsFilters}
            onFiltersChange={setExperimentsFilters}
          />
        </TabContent>

        <TabContent value="review" className="mt-2 overflow-auto pb-0">
          <DatasetReview datasetId={datasetId} />
        </TabContent>
      </Tabs>
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
