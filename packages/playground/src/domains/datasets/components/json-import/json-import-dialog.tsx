import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { InlineCode } from '@mastra/playground-ui/components/InlineCode';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useDatasetMutations } from '@mastra/react/hooks/datasets';
import { useCallback, useMemo, useRef, useState } from 'react';

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
    onOpenChange(false);
    setTimeout(resetState, 150);
  }, [onOpenChange, resetState]);

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
    <Dialog open={open} onOpenChange={handleClose} pending={isImporting}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Import into dataset</DialogTitle>
          <DialogDescription>
            Add items to {datasetName ? <span className="text-foreground">{datasetName}</span> : 'this dataset'} from a
            JSON file or paste them directly.
          </DialogDescription>
        </DialogHeader>

        <DialogBody flush>
          <div className="grid divide-y divide-border md:grid-cols-[1.15fr_1fr] md:divide-x md:divide-y-0">
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

        <DialogFooter>
          <JSONImportStatus validation={validation} />
          <DialogCancel>Cancel</DialogCancel>
          <DialogAction onConfirm={handleImport} disabled={validation.status !== 'ready'}>
            {isImporting && <Spinner />}
            {validation.status === 'ready'
              ? `Import ${validation.total} item${validation.total !== 1 ? 's' : ''}`
              : 'Import'}
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JSONImportStatus({ validation }: { validation: JSONImportValidation }) {
  const dotClassName = cn(
    'size-1.5 shrink-0 rounded-full',
    validation.status === 'idle' && 'bg-muted-foreground',
    validation.status === 'ready' && 'bg-success-indicator',
    validation.status === 'error' && 'bg-destructive-indicator',
  );

  let message: React.ReactNode;
  switch (validation.status) {
    case 'idle':
      message = 'No items yet';
      break;
    case 'ready':
      message = (
        <>
          <Txt as="b" variant="label" tone="ink">
            {validation.total}
          </Txt>{' '}
          item{validation.total !== 1 ? 's' : ''} ready
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
              <Txt as="b" variant="label" tone="ink">
                {validation.missingInputCount}
              </Txt>{' '}
              of {validation.total} item
              {validation.total !== 1 ? 's' : ''} {validation.missingInputCount !== 1 ? 'have' : 'has'} no{' '}
              <InlineCode>input</InlineCode>
            </>
          );
          break;
      }
      break;
  }

  return (
    <div role="status" className="mr-auto flex min-w-0 items-center gap-2">
      <span className={dotClassName} />
      <Txt tone="muted" as="span" variant="caption" className="truncate">
        {message}
      </Txt>
    </div>
  );
}
