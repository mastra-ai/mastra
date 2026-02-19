'use client';

import { useCallback, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/ds/components/Dialog';
import { Button } from '@/ds/components/Button';
import { Spinner } from '@/ds/components/Spinner';
import { toast } from '@/lib/toast';
import { useJSONParser, type ParsedJSON } from '../../hooks/use-json-parser';
import { useDatasetMutations } from '../../hooks/use-dataset-mutations';
import { JSONUploadStep } from './json-upload-step';
import { JSONPreviewTable } from './json-preview-table';
import { JSONValidationSummary } from './json-validation-summary';

export interface JSONImportDialogProps {
  datasetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'complete';

interface ImportResult {
  success: number;
  errors: number;
}

/**
 * Multi-step dialog for importing JSON data into a dataset.
 * Flow: upload -> preview -> import -> complete
 */
export function JSONImportDialog({ datasetId, open, onOpenChange, onSuccess }: JSONImportDialogProps) {
  // State machine for steps
  const [step, setStep] = useState<ImportStep>('upload');

  // Parsed JSON data
  const [parsedJSON, setParsedJSON] = useState<ParsedJSON | null>(null);

  // Import progress
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Hooks
  const { parseFile, isParsing, error: parseError } = useJSONParser();
  const { batchInsertItems } = useDatasetMutations();

  // Handle file selection
  const handleFileSelect = useCallback(
    async (file: File) => {
      try {
        const result = await parseFile(file);
        setParsedJSON(result);
        setStep('preview');
      } catch {
        // Error is handled in useJSONParser
      }
    },
    [parseFile],
  );

  // Handle import
  const handleImport = useCallback(async () => {
    if (!parsedJSON || parsedJSON.items.length === 0) return;

    setStep('importing');
    setIsImporting(true);

    const { items } = parsedJSON;

    setImportProgress({ current: 0, total: items.length });

    try {
      await batchInsertItems.mutateAsync({
        datasetId,
        items: items.map(item => ({
          input: item.input,
          groundTruth: item.groundTruth,
          metadata: item.metadata,
        })),
      });
      setImportResult({ success: items.length, errors: 0 });
    } catch {
      setImportResult({ success: 0, errors: items.length });
    }

    setImportProgress({ current: items.length, total: items.length });
    setIsImporting(false);
    setStep('complete');
  }, [parsedJSON, batchInsertItems, datasetId]);

  // Handle done - close dialog and notify
  const handleDone = useCallback(() => {
    onOpenChange(false);
    onSuccess?.();

    if (importResult && importResult.success > 0) {
      toast.success(`Imported ${importResult.success} item${importResult.success !== 1 ? 's' : ''}`);
    }

    // Reset state after close animation
    setTimeout(() => {
      setStep('upload');
      setParsedJSON(null);
      setImportProgress({ current: 0, total: 0 });
      setImportResult(null);
    }, 150);
  }, [onOpenChange, onSuccess, importResult]);

  // Handle dialog close
  const handleClose = useCallback(() => {
    if (isImporting) return;

    onOpenChange(false);

    // Reset state after close animation
    setTimeout(() => {
      setStep('upload');
      setParsedJSON(null);
      setImportProgress({ current: 0, total: 0 });
      setImportResult(null);
    }, 150);
  }, [isImporting, onOpenChange]);

  // Check if import is possible (has valid items with no errors)
  const canImport = parsedJSON && parsedJSON.items.length > 0 && parsedJSON.errors.length === 0;

  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case 'upload':
        return <JSONUploadStep onFileSelect={handleFileSelect} isParsing={isParsing} error={parseError?.message} />;

      case 'preview':
        return parsedJSON ? (
          <div className="flex flex-col gap-4">
            {parsedJSON.errors.length > 0 ? (
              <>
                <JSONValidationSummary errors={parsedJSON.errors} />
                <div className="text-sm text-neutral4">Please fix the errors in your JSON file and try again.</div>
              </>
            ) : (
              <>
                <div className="text-sm text-neutral4">
                  Found {parsedJSON.items.length} valid item{parsedJSON.items.length !== 1 ? 's' : ''} to import.
                </div>
                <JSONPreviewTable items={parsedJSON.items} maxRows={5} />
              </>
            )}
          </div>
        ) : null;

      case 'importing':
        return (
          <div className="flex flex-col items-center gap-4 py-8">
            <Spinner size="lg" />
            <div className="text-center">
              <div className="text-lg font-medium text-neutral1">Importing items...</div>
              <div className="text-sm text-neutral4 mt-1">
                {importProgress.current} of {importProgress.total}
              </div>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="text-4xl">{importResult && importResult.errors === 0 ? '✓' : '⚠'}</div>
            <div className="text-center">
              <div className="text-lg font-medium text-neutral1">Import Complete</div>
              <div className="text-sm text-neutral4 mt-1">
                {importResult?.success ?? 0} item{importResult?.success !== 1 ? 's' : ''} imported
                {importResult && importResult.errors > 0 && (
                  <span className="text-accent2">
                    {' '}
                    ({importResult.errors} error{importResult.errors !== 1 ? 's' : ''})
                  </span>
                )}
              </div>
            </div>
          </div>
        );
    }
  };

  // Render footer buttons based on step
  const renderFooter = () => {
    switch (step) {
      case 'upload':
        return (
          <Button variant="standard" size="default" onClick={handleClose}>
            Cancel
          </Button>
        );

      case 'preview':
        return (
          <>
            <Button variant="standard" size="default" onClick={() => setStep('upload')}>
              Back
            </Button>
            <Button variant="cta" size="default" onClick={handleImport} disabled={!canImport}>
              Import {parsedJSON?.items.length ?? 0} Item{parsedJSON?.items.length !== 1 ? 's' : ''}
            </Button>
          </>
        );

      case 'importing':
        return null; // Cancel button is in the content

      case 'complete':
        return (
          <Button variant="cta" size="default" onClick={handleDone}>
            Done
          </Button>
        );
    }
  };

  // Step titles
  const stepTitles: Record<ImportStep, string> = {
    upload: 'Import JSON',
    preview: 'Preview Data',
    importing: 'Importing',
    complete: 'Import Complete',
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{stepTitles[step]}</DialogTitle>
          <DialogDescription>Import dataset items from a JSON file.</DialogDescription>
        </DialogHeader>

        <DialogBody className="min-h-[200px] max-h-[50vh] overflow-y-auto">{renderStepContent()}</DialogBody>

        <DialogFooter className="px-6 pt-4 flex justify-end gap-2">{renderFooter()}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
