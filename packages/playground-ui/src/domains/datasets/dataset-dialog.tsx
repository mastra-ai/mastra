import {
  SideDialog,
  SideDialogHeader,
  SideDialogContent,
  TextareaField,
  FormActions,
  SideDialogTop,
  InputField,
} from '@/components/ui/elements';
import { DatabaseIcon } from 'lucide-react';
import { useState } from 'react';

type DialogMode = 'view' | 'create' | 'edit' | 'delete';

type DatasetDialogProps = {
  initialMode?: DialogMode;
  traceId?: string;
  isOpen: boolean;
  onClose?: () => void;
  onCreate?: (dataset: any) => void;
  isCreating?: boolean;
};

export function DatasetDialog({
  initialMode = 'view' as DialogMode,
  isOpen,
  onClose,
  onCreate,
  isCreating,
}: DatasetDialogProps) {
  const [mode, setMode] = useState<DialogMode>(initialMode);
  const [dataset, setDataset] = useState<{ name: string; description?: string }>({ name: '', description: '' });
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleCreate = () => {
    setErrorMsg('');

    if (dataset.name.trim() === '') {
      setErrorMsg('Dataset name is required');
      return;
    }

    onCreate?.(dataset);
  };

  const handleCancel = () => {
    onClose?.();
  };

  return (
    <SideDialog dialogTitle="Dataset Details" isOpen={isOpen} onClose={onClose}>
      <SideDialogTop>
        <span className="flex items-center gap-[0.5rem]">
          <DatabaseIcon /> New
        </span>
      </SideDialogTop>
      <SideDialogContent isCentered={mode === 'delete'}>
        <SideDialogHeader>
          <h2>Create a new Dataset</h2>
        </SideDialogHeader>
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
        <FormActions onSubmit={handleCreate} onCancel={handleCancel} isSubmitting={isCreating} cancelLabel="Cancel" />
      </SideDialogContent>
    </SideDialog>
  );
}
