import { useState } from 'react';
import { useDataset, useDatasetItems } from '../../hooks/use-datasets';
import { useDatasetRuns } from '../../hooks/use-dataset-runs';
import { ItemsList } from './items-list';
import { RunHistory } from './run-history';
import { Tabs, Tab, TabList, TabContent } from '@/ds/components/Tabs';
import { Button } from '@/ds/components/Button';
import { Skeleton } from '@/ds/components/Skeleton';
import { Icon } from '@/ds/icons/Icon';
import { Play, Database, Pencil, Trash2 } from 'lucide-react';

export interface DatasetDetailProps {
  datasetId: string;
  onRunClick?: () => void;
  onEditClick?: () => void;
  onDeleteClick?: () => void;
  onAddItemClick?: () => void;
  runTriggerSlot?: React.ReactNode;
}

type TabValue = 'items' | 'runs';

export function DatasetDetail({
  datasetId,
  onRunClick,
  onEditClick,
  onDeleteClick,
  onAddItemClick,
  runTriggerSlot,
}: DatasetDetailProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('items');

  const { data: dataset, isLoading: isDatasetLoading } = useDataset(datasetId);
  const { data: itemsData, isLoading: isItemsLoading } = useDatasetItems(datasetId);
  const { data: runsData, isLoading: isRunsLoading } = useDatasetRuns(datasetId);

  const items = itemsData?.items ?? [];
  const runs = runsData?.runs ?? [];

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
    </div>
  );
}
