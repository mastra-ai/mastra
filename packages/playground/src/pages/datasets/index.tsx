import { Button, DataTable, Header, HeaderTitle, MainContentLayout, DatasetDialog } from '@mastra/playground-ui';
import { datasetsTableColumns } from '@/domains/datasets/table.columns';
import { useState } from 'react';
import { useDatasets, type Dataset } from '@/domains/datasets/use-datasets';

export default function Datasets() {
  const { datasets, isLoading, createDataset } = useDatasets();
  const [createDialogIsOpen, setCreateDialogIsOpen] = useState(false);

  const onCreateDataset = (dataset: Dataset) => {
    createDataset(dataset);
    setCreateDialogIsOpen(false);
  };

  return (
    <>
      <MainContentLayout>
        <Header>
          <HeaderTitle>Datasets</HeaderTitle>
          <Button className="ml-auto" onClick={() => setCreateDialogIsOpen(true)}>
            New Dataset
          </Button>
        </Header>
        <div>
          <DataTable
            columns={datasetsTableColumns}
            data={datasets || []}
            isLoading={false}
            onClick={props => {
              console.log(props);
            }}
          />
        </div>
      </MainContentLayout>
      <DatasetDialog
        initialMode="create"
        isOpen={createDialogIsOpen}
        onClose={() => setCreateDialogIsOpen(false)}
        onCreate={onCreateDataset}
      />
    </>
  );
}
