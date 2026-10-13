import { Button } from '@mastra/playground-ui/components/Button';
import {
  DialogAction,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { FileDropBackdrop } from '@mastra/playground-ui/components/FileDropBackdrop';
import { AddItemsChoices } from '../add-items-choices';
import type { ImportFormat } from '../add-items-choices';

export interface AddItemsStepProps {
  onAddManually: () => void;
  /** Opens the import in the given format, with the file when one was dropped. */
  onImport: (format: ImportFormat, file?: File) => void;
  onBack: () => void;
  /** Creates the dataset without items. */
  onCreate: () => void;
  pending: boolean;
}

const formatOf = (file: File): ImportFormat => (file.name.toLowerCase().endsWith('.json') ? 'json' : 'csv');

export function AddItemsStep({ onAddManually, onImport, onBack, onCreate, pending }: AddItemsStepProps) {
  return (
    <FileDropBackdrop
      disabled={pending}
      accept=".csv,text/csv,.json,application/json"
      label="Drop a CSV or JSON file to import"
      description="The file opens in the import"
      onFilesDrop={([file]) => onImport(formatOf(file), file)}
    >
      <DialogHeader>
        <DialogTitle>Add items</DialogTitle>
        <DialogDescription>Add the first items now, or create the dataset empty and add them later.</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <AddItemsChoices
          onAddManually={onAddManually}
          onImport={onImport}
          importHint="Or drop it anywhere on this window."
          disabled={pending}
        />
      </DialogBody>
      <DialogFooter>
        <Button onClick={onBack} disabled={pending}>
          Back
        </Button>
        <DialogAction onConfirm={onCreate}>{pending ? 'Creating...' : 'Create dataset'}</DialogAction>
      </DialogFooter>
    </FileDropBackdrop>
  );
}
