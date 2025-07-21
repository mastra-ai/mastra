import { Button, DataTable, Header, HeaderTitle, MainContentLayout } from '@mastra/playground-ui';
import { datasetsTableColumns } from '@/domains/datasets/table.columns';
import * as Dialog from '@radix-ui/react-dialog';
import { XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

export default function Datasets() {
  const [createDialogIsOpen, setCreateDialogIsOpen] = useState(false);

  //   const { scorers, isLoading } = useDatasets();

  // const datasetListData = Object.entries(dataset || {}).map(([key, dataset]) => ({
  //   id: key,
  //   name: dataset.dataset.name,
  //   description: dataset.dataset.description,
  // }));

  const mockDatasetListData = [
    {
      id: '1',
      name: 'My first Dataset ',
      description: 'This is a sample dataset description.',
    },
    {
      id: '2',
      name: 'My second Dataset',
      description: 'This is another sample dataset description.',
    },
  ];

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
            data={mockDatasetListData || []}
            isLoading={false}
            onClick={props => {
              console.log(props);
            }}
          />
        </div>
      </MainContentLayout>
      <CreateDatasetDialog isOpen={createDialogIsOpen} onClose={() => setCreateDialogIsOpen(false)} />
    </>
  );
}

function CreateDatasetDialog({ isOpen, onClose }: { isOpen: boolean; onClose?: () => void }) {
  const handleCreate = () => {
    // Handle dataset creation logic here
    console.log('Dataset created');
    if (onClose) {
      onClose();
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black top-0 bottom-0 right-0 left-0 fixed z-[10] opacity-[0.1]" />
        <Dialog.Content
          className={cn(
            'fixed top-0 bottom-0 right-0 border-l border-border1 w-[50%] 3xl:min-w-[80ch] max-w-[calc(100vw-15rem)] z-[100] bg-surface4 px-[1rem] overflow-y-scroll',
          )}
        >
          <div className="bg-surface4 border-b-2 border-border1 flex items-center py-[1.5rem] px-[1rem] top-0 sticky">
            <h2 className=" w-full text-[0.875rem] !text-icon5 !font-normal flex items-center gap-[1rem]">
              Create Dataset
            </h2>
            <div className="flex gap-[1rem]">
              <Dialog.Close asChild>
                <button
                  className="inline-flex bg-surface5 appearance-none items-center justify-center rounded-md p-[.2rem] focus:shadow-[0_0_0_2px] focus:outline-none"
                  aria-label="Close"
                >
                  <XIcon />
                </button>
              </Dialog.Close>
            </div>
          </div>

          <div className="max-w-[80ch] mx-auto ">
            <div className="grid px-[1rem] py-[2rem] pb-[4rem] gap-[2rem] ">
              <div className="grid gap-[1rem]">
                <Label htmlFor="name">Dataset Name</Label>
                <Input id="name" placeholder="Enter dataset name" />
              </div>
              <div className="grid gap-[1rem]">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" placeholder="Enter dataset description" />
              </div>
              <div className="grid gap-[1rem]">
                <Label htmlFor="description">Upload file (csv, json)</Label>
                <Input id="rows" type="file" placeholder="Enter dataset name" />
              </div>
              <div className="grid grid-cols-[2fr_1fr] items-center gap-[1rem]">
                <Button variant="light" size="lg" onClick={handleCreate} className="mt-[1rem]">
                  Create Dataset
                </Button>
                <Button variant="light" size="lg" onClick={handleCreate} className="mt-[1rem]">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
