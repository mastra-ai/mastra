import { Button } from '@mastra/playground-ui/components/Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@mastra/playground-ui/components/Dialog';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { cn } from '@mastra/playground-ui/utils/cn';
import { toast } from '@mastra/playground-ui/utils/toast';
import { X } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useDatasetMutations } from '../../hooks/use-dataset-mutations';
import { MAX_IMPORT_BYTES, MAX_IMPORT_LABEL, validateImportJSON } from '../../utils/json-validation';
import type { JSONImportValidation } from '../../utils/json-validation';
import { JSONFormatPanel } from './json-format-panel';
import { JSONSourcePanel } from './json-source-panel';
import type { JSONSourceFile, JSONSourceTab } from './json-source-panel';

export interface JSONImportDialogProps {
  datasetId: string;
  datasetName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const readFileText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

export function JSONImportDialog({ datasetId, datasetName, open, onOpenChange, onSuccess }: JSONImportDialogProps) {
  const [tab, setTab] = useState<JSONSourceTab>('upload');
  const [file, setFile] = useState<JSONSourceFile | null>(null);
  const [fileText, setFileText] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  // Incremented whenever the selection changes so a slow file read can't restore a discarded file.
  const readIdRef = useRef(0);

  const { batchInsertItems } = useDatasetMutations();

  const sourceText = tab === 'upload' ? fileText : pastedText;
  const validation = useMemo<JSONImportValidation>(() => {
    if (tab === 'upload' && fileError) {
      return { status: 'error', kind: 'parse', message: fileError };
    }
    return validateImportJSON(sourceText);
  }, [tab, fileError, sourceText]);

  const handleFileSelect = useCallback(async (selected: File) => {
    const readId = ++readIdRef.current;

    if (!selected.name.toLowerCase().endsWith('.json')) {
      setFileError('Only .json files are supported');
      return;
    }
    if (selected.size > MAX_IMPORT_BYTES) {
      setFileError(`File is larger than ${MAX_IMPORT_LABEL}`);
      return;
    }

    try {
      const text = await readFileText(selected);
      if (readId !== readIdRef.current) return;
      setFile({ name: selected.name, size: selected.size });
      setFileText(text);
      setFileError(null);
    } catch {
      if (readId !== readIdRef.current) return;
      setFileError('Could not read the file');
    }
  }, []);

  const handleReplace = useCallback(() => {
    readIdRef.current++;
    setFile(null);
    setFileText('');
    setFileError(null);
  }, []);

  const resetState = useCallback(() => {
    readIdRef.current++;
    setTab('upload');
    setFile(null);
    setFileText('');
    setFileError(null);
    setPastedText('');
  }, []);

  const handleClose = useCallback(() => {
    if (isImporting) return;
    onOpenChange(false);
    // Reset after the close animation
    setTimeout(resetState, 150);
  }, [isImporting, onOpenChange, resetState]);

  const handleImport = useCallback(async () => {
    if (validation.status !== 'ready') return;

    setIsImporting(true);
    try {
      await batchInsertItems.mutateAsync({ datasetId, items: validation.items });
      toast.success(`Imported ${validation.total} item${validation.total !== 1 ? 's' : ''}`);
      onSuccess?.();
      onOpenChange(false);
      setTimeout(resetState, 150);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to import items');
    } finally {
      setIsImporting(false);
    }
  }, [validation, batchInsertItems, datasetId, onSuccess, onOpenChange, resetState]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[90vh] w-[960px] max-w-[calc(100vw-2rem)] flex-col gap-0 p-0">
        <DialogHeader className="border-border1 border-b px-4 py-4">
          <DialogTitle>Import into dataset</DialogTitle>
          <DialogDescription className="text-ui-sm text-neutral3 not-sr-only">
            Add items to{' '}
            {datasetName ? (
              <code className="bg-surface3 text-ui-xs text-neutral6 rounded px-1 font-mono">{datasetName}</code>
            ) : (
              'this dataset'
            )}{' '}
            from a JSON file or paste them directly.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="max-h-none min-h-0 flex-1 overflow-y-auto p-0">
          <div className="divide-border1 grid divide-y md:grid-cols-[1.15fr_1fr] md:divide-x md:divide-y-0">
            <div className="flex min-h-[360px] flex-col p-4">
              <JSONSourcePanel
                tab={tab}
                onTabChange={setTab}
                file={file}
                onFileSelect={handleFileSelect}
                onReplace={handleReplace}
                pastedText={pastedText}
                onPastedTextChange={setPastedText}
                validation={validation}
                isImporting={isImporting}
              />
            </div>
            <div className="p-4">
              <JSONFormatPanel />
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="border-border1 items-center border-t px-4 py-3 sm:justify-between">
          <JSONImportStatus validation={validation} />
          <div className="flex gap-2">
            <Button icon={<X />} onClick={handleClose} disabled={isImporting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleImport} disabled={validation.status !== 'ready' || isImporting}>
              {isImporting && <Spinner />}
              {validation.status === 'ready'
                ? `Import ${validation.total} item${validation.total !== 1 ? 's' : ''}`
                : 'Import'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JSONImportStatus({ validation }: { validation: JSONImportValidation }) {
  const dotClassName = cn(
    'size-1.5 shrink-0 rounded-full',
    validation.status === 'idle' && 'bg-neutral3',
    validation.status === 'ready' && 'bg-accent1',
    validation.status === 'error' && 'bg-accent2',
  );

  let message: React.ReactNode;
  switch (validation.status) {
    case 'idle':
      message = 'No items yet';
      break;
    case 'ready':
      message = (
        <>
          <b className="text-neutral6 font-medium">{validation.total}</b> item{validation.total !== 1 ? 's' : ''} ready
          {validation.missingGroundTruthCount > 0 && ` · ${validation.missingGroundTruthCount} without groundTruth`}
        </>
      );
      break;
    case 'error':
      switch (validation.kind) {
        case 'parse':
          message = `Not valid JSON — ${validation.message}`;
          break;
        case 'not-array':
          message = 'Top level must be an array of items';
          break;
        case 'empty':
          message = 'The array has no items';
          break;
        case 'too-large':
          message = `JSON is larger than ${MAX_IMPORT_LABEL}`;
          break;
        case 'missing-input':
          message = (
            <>
              <b className="text-neutral6 font-medium">{validation.missingInputCount}</b> of {validation.total} item
              {validation.total !== 1 ? 's' : ''} {validation.missingInputCount !== 1 ? 'have' : 'has'} no{' '}
              <code className="font-mono">input</code>
            </>
          );
          break;
      }
      break;
  }

  return (
    <div role="status" className="text-ui-sm text-neutral4 flex min-w-0 items-center gap-2">
      <span className={dotClassName} />
      <span className="truncate">{message}</span>
    </div>
  );
}
