import { Button } from '@/components/ui/elements/buttons';
import { TextareaField, InputField, FormActions } from '@/components/ui/elements';
import { cn } from '@/lib/utils';
import { EditIcon, TrashIcon } from 'lucide-react';
import { type Dataset } from './shared';
import { useState } from 'react';

type DatasetSettingsProps = {
  dataset?: Dataset;
  onUpdate?: (dataset: Dataset) => void;
  onRemove?: () => void;
  onCancel?: () => void;
};

export function DatasetSettings({ dataset: initialDataset, onRemove, onUpdate, onCancel }: DatasetSettingsProps) {
  const [dataset, setDataset] = useState<Dataset | undefined>(initialDataset);

  if (!dataset) {
    return null;
  }

  const handleUpdate = () => {
    onUpdate?.(dataset);
  };

  const handleRemove = () => {
    onRemove?.();
  };

  const handleCancel = () => {
    onCancel?.();
  };

  return (
    <div className="w-full mt-[2rem] max-w-[40rem] mx-auto grid gap-[2rem] pb-[3rem]">
      <div className="grid gap-[2rem]">
        <h3
          className={cn(
            'text-[1rem] m-0 flex items-center gap-[0.75em]',
            '[&>svg]:w-[1.1em] [&>svg]:h-[1.1em] [&>svg]:text-icon3',
          )}
        >
          <EditIcon /> Edit
        </h3>
        <InputField
          label="Name"
          value={dataset.name}
          onChange={e => setDataset({ ...dataset, name: e.target.value })}
          helpMsg="max 256 characters"
          required={true}
        />
        <TextareaField
          label="Description"
          value={dataset.description}
          onChange={e => setDataset({ ...dataset, description: e.target.value })}
        />
        <FormActions
          onSubmit={handleUpdate}
          onCancel={handleCancel}
          isSubmitting={false}
          submitLabel="Save changes"
          cancelLabel="Cancel"
          variant="toRight"
        />
      </div>
      <div className="grid gap-[2rem]">
        <h3
          className={cn(
            'text-[1rem] m-0 flex items-center gap-[0.75em]',
            '[&>svg]:w-[1.1em] [&>svg]:h-[1.1em] [&>svg]:text-icon3',
          )}
        >
          <TrashIcon /> Delete
        </h3>
        <div className="grid justify-items-start  gap-[1rem] border border-red-900 p-[1.75rem] px-[1.5rem] pl-[2rem] rounded-lg">
          <p className="text-[0.875rem] text-icon4">
            Warning: This will permanently delete the dataset and related content (e.g. Experiments). This action is
            irreversible and may result in data loss. Proceed with caution.
          </p>
          <Button onClick={handleRemove} className="ml-auto" variant="primary">
            Delete Dataset and related content
          </Button>
        </div>
      </div>
    </div>
  );
}
