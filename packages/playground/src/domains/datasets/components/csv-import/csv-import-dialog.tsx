import { Dialog, DialogContent } from '@mastra/playground-ui/components/Dialog';
import { useDataset, useDatasetMutations } from '@mastra/react/hooks/datasets';
import { useState } from 'react';
import type { CSVImportItem } from './csv-import-flow';
import { CSVImportFlow } from './csv-import-flow';

export interface CSVImportDialogProps {
  datasetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Dialog shell around CSVImportFlow. The flow unmounts with the dialog content on close, which resets its state.
 */
export function CSVImportDialog({ datasetId, open, onOpenChange, onSuccess }: CSVImportDialogProps) {
  const [isImporting, setIsImporting] = useState(false);
  const { data: dataset } = useDataset({ datasetId, queryOptions: { enabled: open && Boolean(datasetId) } });
  const { batchInsertItems } = useDatasetMutations();

  const close = () => onOpenChange(false);

  const handleComplete = () => {
    close();
    onSuccess?.();
  };

  const handleImport = async (items: CSVImportItem[]) => {
    await batchInsertItems.mutateAsync({ datasetId, items });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} pending={isImporting}>
      <DialogContent size="lg">
        <CSVImportFlow
          inputSchema={dataset?.inputSchema}
          groundTruthSchema={dataset?.groundTruthSchema}
          onImport={handleImport}
          onImportingChange={setIsImporting}
          onComplete={handleComplete}
          onCancel={close}
        />
      </DialogContent>
    </Dialog>
  );
}
