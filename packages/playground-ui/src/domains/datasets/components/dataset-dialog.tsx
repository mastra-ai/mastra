import { InputField, SideDialog, TextareaField } from '@/components/ui/elements';
import { DatabaseIcon } from 'lucide-react';

import { useLinkComponent } from '@/lib/framework';
import { Sections } from '@/index';

import { useState } from 'react';
import { Button } from '@/components/ui/elements/buttons';

type DialogMode = 'view' | 'create' | 'edit' | 'delete';

type DatasetDialogProps = {
  initialMode?: DialogMode;
  dataset?: any;
  isOpen: boolean;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onCreate?: (dataset: any) => void;
};

export function DatasetDialog({ dataset, isOpen, onClose, onNext, onPrevious, onCreate }: DatasetDialogProps) {
  const { Link } = useLinkComponent();
  const [newDataset, setNewDataset] = useState<any>(dataset || { name: '', description: '', metadata: '' });

  const handleCreate = () => {
    // Call the onCreate prop with the new dataset details
    if (onCreate) {
      console.log(newDataset);

      onCreate(newDataset);
    }
    onClose();
  };

  return (
    <SideDialog
      dialogTitle="Dataset details"
      dialogDescription="View and analyze dataset details"
      isOpen={isOpen}
      onClose={onClose}
    >
      <SideDialog.Top>
        <SideDialog.Nav onNext={onNext} onPrevious={onPrevious} />
      </SideDialog.Top>

      <SideDialog.Content>
        <SideDialog.Header>
          <SideDialog.Heading>
            <DatabaseIcon /> New Dataset
          </SideDialog.Heading>
        </SideDialog.Header>

        <Sections>
          <InputField
            label="Name"
            value={newDataset.name}
            onChange={e => setNewDataset({ ...newDataset, name: e.target.value })}
            required
          />
          <TextareaField
            label="Description"
            value={newDataset.description}
            onChange={e => setNewDataset({ ...newDataset, description: e.target.value })}
          />
          <TextareaField
            label="Metadata (JSON)"
            value={newDataset.metadata}
            onChange={e => setNewDataset({ ...newDataset, metadata: e.target.value })}
          />

          <Button onClick={handleCreate}>Create Dataset</Button>
        </Sections>
      </SideDialog.Content>
    </SideDialog>
  );
}
