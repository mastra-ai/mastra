import { FormActions, PageHeader, InputField, TextareaField } from '@/components/ui/elements';
import { cn } from '@/lib/utils';
import { DatabaseIcon } from 'lucide-react';
import { useState } from 'react';
import { useLinkComponent } from '@/lib/framework';
import { useDatasetCreate } from '@/domains/datasets/hooks/use-dataset';

export function DatasetCreation() {
  const { navigate, paths } = useLinkComponent();
  const { mutateAsync: createDataset } = useDatasetCreate();

  const [dataset, setDataset] = useState<{ name: string; description?: string; metadata?: string }>({
    name: '',
    description: '',
    metadata: '',
  });
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isLoading, setLoading] = useState<boolean>(false);

  const handleCreate = async () => {
    try {
      const result = await createDataset({
        name: dataset.name,
        description: dataset.description,
        metadata: dataset.metadata ? JSON.parse(dataset.metadata) : undefined,
      });
      console.log('Dataset created:', result);
      navigate(paths.datasetsLink());
    } catch (error) {
      console.error('Failed to create dataset:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate(paths.datasetsLink());
  };

  return (
    <div className={cn(`grid overflow-y-auto h-full`)}>
      <div className={cn('max-w-[40rem] w-full px-[3rem] mx-auto grid content-start gap-[2rem] h-full')}>
        <PageHeader title={'New Dataset'} icon={<DatabaseIcon />} />

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
          onSubmit={handleCreate}
          onCancel={handleCancel}
          isSubmitting={false}
          submitLabel="Create"
          cancelLabel="Cancel"
        />
      </div>
    </div>
  );
}
