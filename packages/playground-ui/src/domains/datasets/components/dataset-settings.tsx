import { FormActions, PageHeader, InputField, TextareaField, Section, Separator } from '@/components/ui/elements';
import { Sections } from '@/components/ui/containers';
import { Button } from '@/components/ui/elements/buttons';
import { cn } from '@/lib/utils';
import { EditIcon, SettingsIcon, Trash, Trash2Icon, TriangleAlertIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLinkComponent } from '@/lib/framework';
import { useDataset, useDatasetDelete, useDatasetUpdate } from '../hooks/use-dataset';
import { AlertDialog } from '@/components/ui/alert-dialog';

export type DatasetSettingsProps = {
  datasetId: string;
};

export function DatasetSettings({ datasetId }: DatasetSettingsProps) {
  const { navigate, paths } = useLinkComponent();
  const [deleteRequested, setDeleteRequested] = useState<boolean>(false);

  const { data: datasetData, isLoading: isDatasetLoading } = useDataset(datasetId);
  const { mutateAsync: deleteDataset, isPending: isDeleting } = useDatasetDelete(datasetId);
  const { mutateAsync: updateDataset, isPending: isUpdating } = useDatasetUpdate(datasetId);

  const [dataset, setDataset] = useState<{ name: string; description?: string; metadata?: string }>({
    name: '',
    description: '',
    metadata: '',
  });

  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (datasetData) {
      setDataset({
        name: datasetData.name,
        description: datasetData.description,
        metadata: datasetData.metadata ? JSON.stringify(datasetData.metadata, null, 2) : undefined,
      });
    }
  }, [datasetData]);

  const handleCancel = () => {
    navigate(paths.datasetLink(datasetId));
  };

  const requestDelete = () => {
    setDeleteRequested(true);
  };

  const handleUpdate = async () => {
    try {
      const result = await updateDataset({
        name: dataset.name,
        description: dataset.description,
        metadata: dataset.metadata ? JSON.parse(dataset.metadata) : undefined,
      });
      console.log('Dataset updated:', result);
      navigate(paths.datasetLink(datasetId));
    } catch (error) {
      console.error('Failed to update dataset:', error);
    }
  };

  const handleDelete = async () => {
    try {
      const result = await deleteDataset();
      console.log('Dataset created:', result);
      navigate(paths.datasetsLink());
    } catch (error) {
      console.error('Failed to create dataset:', error);
    }
  };

  return (
    <>
      <div className={cn(`grid overflow-y-auto h-full`)}>
        <div className={cn('max-w-[45rem] w-full px-[3rem] pb-[3rem] mx-auto grid content-start gap-[2rem] h-full')}>
          <PageHeader title={`${dataset.name}`} icon={<SettingsIcon />} />

          <Sections>
            <Section>
              <Section.Header>
                <Section.Heading>
                  <EditIcon /> Edit
                </Section.Heading>
              </Section.Header>
              <InputField
                label="Name"
                value={dataset.name}
                onChange={e => setDataset({ ...dataset, name: e.target.value })}
                required
                errorMsg={errorMsg}
              />

              <TextareaField
                label="Description"
                value={dataset.description}
                onChange={e => setDataset({ ...dataset, description: e.target.value })}
              />

              <TextareaField
                label="Metadata (JSON)"
                value={dataset.metadata}
                onChange={e => setDataset({ ...dataset, metadata: e.target.value })}
              />

              <FormActions
                onSubmit={handleUpdate}
                onCancel={handleCancel}
                isSubmitting={isUpdating}
                submitLabel="Update"
                cancelLabel="Cancel"
              />
            </Section>

            <Separator />

            <Section>
              <Section.Header>
                <Section.Heading>
                  <Trash2Icon /> Delete
                </Section.Heading>
              </Section.Header>
              <div className="text-[0.875rem] text-icon4 grid grid-cols-[auto_1fr] gap-2 ">
                <span
                  className={cn(
                    'flex p-2 px-1 bg-red-900 rounded-md mb-[0.5rem] h-full items-center',
                    '[&>svg]:w-[1em] [&>svg]:h-[1em] ',
                  )}
                >
                  <TriangleAlertIcon />
                </span>
                Deleting this dataset will permanently delete the dataset's data. This action is irreversible and may
                result in data loss. Proceed with caution!
              </div>
              <Button onClick={requestDelete} className="ml-auto" variant="primary" disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete Dataset'} <Trash2Icon />
              </Button>
            </Section>
          </Sections>
        </div>
      </div>
      <AlertDialog open={deleteRequested} onOpenChange={setDeleteRequested}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Are you sure?</AlertDialog.Title>
            <AlertDialog.Description>
              This action cannot be undone. This will permanently delete the dataset <strong>{dataset.name}</strong> and
              its data.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action onClick={handleDelete}>Continue</AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </>
  );
}
