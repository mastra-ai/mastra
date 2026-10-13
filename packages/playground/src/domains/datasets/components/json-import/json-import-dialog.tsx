import { Dialog, DialogContent } from '@mastra/playground-ui/components/Dialog';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useDatasetMutations } from '@mastra/react/hooks/datasets';

import type { ImportableItem } from '../../utils/json-validation';
import { JSONImportFlow } from './json-import-flow';

export interface JSONImportDialogProps {
  datasetId: string;
  datasetName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Dialog shell around JSONImportFlow. The flow unmounts with the dialog content on close, which resets its state.
 */
export function JSONImportDialog({ datasetId, datasetName, open, onOpenChange, onSuccess }: JSONImportDialogProps) {
  const { batchInsertItems } = useDatasetMutations();

  const handleImport = async (items: ImportableItem[]) => {
    try {
      await batchInsertItems.mutateAsync({ datasetId, items });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to import items');
      throw err;
    }
    toast.success(`Imported ${items.length} item${items.length !== 1 ? 's' : ''}`);
    onSuccess?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} pending={batchInsertItems.isPending}>
      <DialogContent size="xl">
        <JSONImportFlow
          title="Import into dataset"
          description={
            <>
              Add items to {datasetName ? <span className="text-foreground">{datasetName}</span> : 'this dataset'} from
              a JSON file or paste them directly.
            </>
          }
          onImport={handleImport}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
