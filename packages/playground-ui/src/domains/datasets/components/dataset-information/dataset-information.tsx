import { useState } from 'react';
import type { Dataset, DatasetItem } from '@mastra/client-js';
import { Skeleton } from '@/ds/components/Skeleton';
import { Tabs, TabList, Tab, TabContent } from '@/ds/components/Tabs';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import { Plus, Play } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
  DialogDescription,
} from '@/ds/components/Dialog';

import { useDataset } from '../../hooks/use-dataset';
import { useDatasetItems, useArchiveDatasetItem } from '../../hooks/use-dataset-items';
import { useDatasetRuns } from '../../hooks/use-dataset-runs';
import { DatasetItemsTable } from '../dataset-items-table/dataset-items-table';
import { DatasetRunsTable } from '../dataset-runs-table';
import { AddDatasetItemDialog } from '../add-dataset-item-dialog';
import { EditDatasetItemDialog } from '../edit-dataset-item-dialog';
import { RunDatasetDialog } from '../run-dataset-dialog';
import { useLinkComponent } from '@/lib/framework';

export type DatasetInformationProps = {
  datasetId: string;
};

export function DatasetInformation({ datasetId }: DatasetInformationProps) {
  const { navigate, paths } = useLinkComponent();
  const { data: datasetData, isLoading: isLoadingDataset } = useDataset(datasetId);
  const { data: itemsData, isLoading: isLoadingItems } = useDatasetItems(datasetId);
  const { data: runsData, isLoading: isLoadingRuns } = useDatasetRuns(datasetId);
  const { mutateAsync: archiveItem, isPending: isArchiving } = useArchiveDatasetItem(datasetId);

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [editItem, setEditItem] = useState<DatasetItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<DatasetItem | null>(null);

  const handleDelete = async () => {
    if (!deleteItem) return;
    await archiveItem(deleteItem.id);
    setDeleteItem(null);
  };

  if (isLoadingDataset) {
    return <DatasetInformationSkeleton />;
  }

  const dataset = datasetData?.dataset;

  if (!dataset) {
    return <div className="p-4 text-text-muted">Dataset not found</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <DatasetHeader dataset={dataset} onAddItem={() => setAddItemOpen(true)} onRun={() => setRunOpen(true)} />
      <Tabs defaultTab="items" className="flex-1 flex flex-col">
        <TabList className="border-b border-border1 px-4">
          <Tab value="items">Items ({itemsData?.items?.length ?? 0})</Tab>
          <Tab value="runs">Runs ({runsData?.runs?.length ?? 0})</Tab>
        </TabList>
        <TabContent value="items" className="flex-1 p-4">
          <DatasetItemsTable
            items={itemsData?.items ?? []}
            isLoading={isLoadingItems}
            onEdit={setEditItem}
            onDelete={setDeleteItem}
          />
        </TabContent>
        <TabContent value="runs" className="flex-1 p-4">
          <DatasetRunsTable
            runs={runsData?.runs ?? []}
            isLoading={isLoadingRuns}
            onViewRun={run => navigate(paths.datasetRunLink(datasetId, run.id))}
          />
        </TabContent>
      </Tabs>

      <AddDatasetItemDialog datasetId={datasetId} open={addItemOpen} onOpenChange={setAddItemOpen} />

      <EditDatasetItemDialog
        datasetId={datasetId}
        item={editItem}
        open={!!editItem}
        onOpenChange={open => !open && setEditItem(null)}
      />

      <RunDatasetDialog datasetId={datasetId} open={runOpen} onOpenChange={setRunOpen} />

      <Dialog open={!!deleteItem} onOpenChange={open => !open && setDeleteItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this item? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => setDeleteItem(null)}>
                Cancel
              </Button>
              <Button
                variant="default"
                className="bg-red-600 hover:bg-red-700"
                onClick={handleDelete}
                disabled={isArchiving}
              >
                {isArchiving ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type DatasetHeaderProps = {
  dataset: Dataset;
  onAddItem: () => void;
  onRun: () => void;
};

const formatDate = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

function DatasetHeader({ dataset, onAddItem, onRun }: DatasetHeaderProps) {
  return (
    <div className="p-4 border-b border-border1 flex items-start justify-between">
      <div>
        <h1 className="text-lg font-semibold text-text-default">{dataset.name}</h1>
        {dataset.description && <p className="text-sm text-text-muted mt-1">{dataset.description}</p>}
        <div className="flex gap-4 mt-2 text-xs text-text-muted">
          <span>Created: {formatDate(dataset.createdAt)}</span>
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={onRun} size="sm" variant="outline">
          <Icon>
            <Play className="h-4 w-4" />
          </Icon>
          Run
        </Button>
        <Button onClick={onAddItem} size="sm">
          <Icon>
            <Plus className="h-4 w-4" />
          </Icon>
          Add Item
        </Button>
      </div>
    </div>
  );
}

const DatasetInformationSkeleton = () => (
  <div className="p-4">
    <Skeleton className="h-6 w-48 mb-2" />
    <Skeleton className="h-4 w-64 mb-4" />
    <div className="flex gap-4">
      <Skeleton className="h-3 w-32" />
    </div>
  </div>
);
