import type { DatasetItem } from '@mastra/client-js';
import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Tabs, Tab, TabList, TabContent } from '@mastra/playground-ui/components/Tabs';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { toast } from '@mastra/playground-ui/utils/toast';
import { ClipboardCheck, FlaskConical, List } from 'lucide-react';
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
import { useDatasetItemPanel } from '@/domains/datasets/context/dataset-item-panel-context';
import { DatasetReview } from '@/domains/review/components/dataset-review';
import { useDatasetReviewItems } from '@/domains/review/hooks/use-dataset-review-items';

export interface DatasetPageTabsProps {
  datasetId: string;
  onAddItemClick?: () => void;
  onNavigateToDataset?: (datasetId: string) => void;
  rightSlot?: React.ReactNode;
}

export type TabValue = 'items' | 'experiments' | 'review';

export function DatasetPageTabs({ datasetId, onAddItemClick, onNavigateToDataset, rightSlot }: DatasetPageTabsProps) {
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
  // Unfiltered, so a search narrows the list without shrinking the Items tab count.
  const { total: unfilteredItemsTotal } = useDatasetItems(datasetId, undefined, activeDatasetVersion);
  const [experimentsFilters, setExperimentsFilters] = useState<DatasetExperimentsFilters>({});
  const { data: experimentsData, isLoading: isExperimentsLoading } = useDatasetExperiments(
    datasetId,
    undefined,
    experimentsFilters,
  );
  // Unfiltered, so the filter options stay complete; the query cache serves it when no filter is set.
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
      <Tabs
        defaultTab="items"
        value={activeTab}
        onValueChange={handleTabChange}
        className="grid h-full grid-rows-[auto_1fr]"
      >
        <div className="flex items-center justify-between gap-4 px-6 py-3">
          <TabList variant="pill-ghost">
            <Tab value="items" className="px-3 py-2.5">
              <Icon size="sm">
                <List />
              </Icon>
              <Txt variant="ui-sm" className="text-inherit">
                Items
              </Txt>
              <Badge size="sm">{itemsTabCount}</Badge>
            </Tab>
            <Tab value="experiments" className="px-3 py-2.5">
              <Icon size="sm">
                <FlaskConical />
              </Icon>
              <Txt variant="ui-sm" className="text-inherit">
                Experiments
              </Txt>
              <Badge size="sm">{experiments.length}</Badge>
            </Tab>
            <Tab value="review" className="px-3 py-2.5">
              <Icon size="sm">
                <ClipboardCheck />
              </Icon>
              <Txt variant="ui-sm" className="text-inherit">
                Review
              </Txt>
              {reviewCount > 0 && (
                <Badge variant="yellow" size="sm">
                  {reviewCount}
                </Badge>
              )}
            </Tab>
          </TabList>
          {rightSlot && <div className="shrink-0 whitespace-nowrap">{rightSlot}</div>}
        </div>

        <TabContent value="items" className="border-border1 grid overflow-auto border-t py-0">
          <DatasetItems
            items={items}
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
        </TabContent>

        <TabContent value="experiments" className="border-border1 grid overflow-auto border-t px-6 pt-3 pb-6">
          <DatasetExperiments
            experiments={experiments}
            allExperiments={allExperiments}
            isLoading={isExperimentsLoading}
            datasetId={datasetId}
            filters={experimentsFilters}
            onFiltersChange={setExperimentsFilters}
          />
        </TabContent>

        <TabContent value="review" className="border-border1 overflow-auto border-t px-6 pt-3 pb-6">
          <DatasetReview datasetId={datasetId} />
        </TabContent>
      </Tabs>
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
