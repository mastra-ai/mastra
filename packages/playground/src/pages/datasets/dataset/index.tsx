import {
  Breadcrumb,
  Crumb,
  Header,
  MainContentLayout,
  DatasetItemDialog,
  DatasetItemsTools,
  EntityMainHeader,
  Tabs,
  EntryList,
  DatasetSettings,
} from '@mastra/playground-ui';
import { useParams, Link, useNavigate } from 'react-router';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import { cn } from '@/lib/utils';

import { useDataset } from '@/domains/datasets/use-dataset';
import { useDatasetItems } from '@/domains/datasets/use-dataset-items';
import { DatabaseIcon } from 'lucide-react';

export default function Dataset() {
  const navigate = useNavigate();
  const { datasetId } = useParams()! as { datasetId: string };
  const { dataset, isLoading: isDatasetLoading, removeDataset, updateDataset } = useDataset(datasetId!);
  const { items, isLoading, removeItem } = useDatasetItems(datasetId!);

  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [dialogIsOpen, setDialogIsOpen] = useState<boolean>(false);
  const [currentVersion, setCurrentVersion] = useState<string>('0');
  const [currentTab, setCurrentTab] = useState<string>('items');

  const handleOnListItem = (id: string) => {
    if (id === selectedItem?.id) {
      setSelectedItem(null);
    } else {
      const item = items.find(item => item.id === id);

      if (!item) {
        console.warn('Item not found for id:', id);
        return;
      }

      setSelectedItem(item);
      setDialogIsOpen(true);
    }
  };

  const handleOnAdd = () => {
    setSelectedItem(null);
    setDialogIsOpen(true);
  };

  const toPreviousItem = (currentScore: any) => {
    const currentIndex = items?.findIndex(score => score?.id === currentScore?.id);
    if (currentIndex === -1 || currentIndex === (items?.length || 0) - 1) {
      return null; // No next score
    }
    return () => setSelectedItem(items[(currentIndex || 0) + 1]);
  };
  const toNextItem = (currentScore: any) => {
    const currentIndex = items?.findIndex(score => score?.id === currentScore?.id);
    if ((currentIndex || 0) <= 0) {
      return null; // No previous score
    }
    return () => setSelectedItem(items[(currentIndex || 0) - 1]);
  };

  const handleVersionChange = (value: string) => {
    console.log('Version change requested:', value);

    setCurrentVersion(value);
    console.log('Version changed to:', value);
  };

  const handleUpdate = (dataset: any) => {
    updateDataset(dataset);
    setCurrentTab('items');
  };

  const handleRemove = () => {
    removeDataset();
    navigate('/datasets');
  };

  const itemsListColumns = [
    { name: 'input', label: 'Input', size: '2fr' },
    { name: 'output', label: 'Output', size: '3fr' },
    { name: 'source', label: 'Source', size: '7rem' },
    { name: 'updatedAtStr', label: 'Updated at', size: '9rem' },
  ];

  const experimentsListColumns = [
    { name: 'name', label: 'Name', size: '1fr' },
    { name: 'data-version', label: 'Dataset ver.', size: '10rem' },
    { name: 'entity', label: 'Entity', size: '1fr' },
    { name: 'entity-version', label: 'Entity ver.', size: '10rem' },
    { name: 'runAt', label: 'Ran at', size: '7rem' },
  ];

  return (
    <MainContentLayout>
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to={`/datasets`}>
            Datasets
          </Crumb>
          <Crumb as={Link} to={`/datasets/${datasetId}`} isCurrent>
            {isDatasetLoading ? <Skeleton className="w-20 h-4" /> : dataset?.name || 'Not found'}
          </Crumb>
        </Breadcrumb>
      </Header>

      {dataset ? (
        <>
          <div className={cn(`h-full overflow-y-scroll `)}>
            <div className={cn('max-w-[100rem] px-[3rem] mx-auto grid')}>
              <EntityMainHeader title={dataset.name} description={dataset.description} icon={<DatabaseIcon />} />
              <Tabs value={currentTab} defaultTab="items" onValueChange={setCurrentTab}>
                <Tabs.List>
                  <Tabs.Tab value="items">Data items</Tabs.Tab>
                  <Tabs.Tab value="experiments">Experiments</Tabs.Tab>
                  <Tabs.Tab value="settings">Settings</Tabs.Tab>
                </Tabs.List>
                <Tabs.Content value="items">
                  <DatasetItemsTools
                    onAdd={handleOnAdd}
                    currentVersion={currentVersion}
                    onVersionChange={handleVersionChange}
                    versionOptions={['ver. 07/23 10:30 AM', 'ver. 07/23 9:35 AM', 'ver. 07/23 9:30 AM']}
                  />
                  <EntryList
                    items={items || []}
                    selectedItem={selectedItem}
                    onItemClick={handleOnListItem}
                    columns={itemsListColumns}
                    isLoading={isLoading}
                  />
                </Tabs.Content>
                <Tabs.Content value="experiments">
                  <EntryList
                    items={[]}
                    selectedItem={null}
                    onItemClick={() => {}}
                    columns={experimentsListColumns}
                    isLoading={false}
                  />
                </Tabs.Content>
                <Tabs.Content value="settings">
                  <DatasetSettings
                    dataset={dataset}
                    onUpdate={handleUpdate}
                    onRemove={handleRemove}
                    onCancel={() => setCurrentTab('items')}
                  />
                </Tabs.Content>
              </Tabs>
            </div>
          </div>
          <DatasetItemDialog
            dataset={dataset}
            isOpen={dialogIsOpen}
            item={selectedItem}
            onClose={() => setDialogIsOpen(false)}
            onNext={toNextItem(selectedItem)}
            onPrevious={toPreviousItem(selectedItem)}
            removeItem={removeItem}
          />
        </>
      ) : null}
    </MainContentLayout>
  );
}
