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
import { useCSVParser, ParsedCSV } from '../../hooks/use-csv-parser';
import { useColumnMapping, ColumnMapping, FieldType } from '../../hooks/use-column-mapping';
import { useDatasetMutations } from '../../hooks/use-dataset-mutations';
import { CSVUploadStep } from './csv-upload-step';
import { CSVPreviewTable } from './csv-preview-table';
import { ColumnMappingStep } from './column-mapping-step';
import { ValidationSummary, ValidationError } from './validation-summary';

export interface CSVImportDialogProps {
  datasetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type ImportStep = 'upload' | 'preview' | 'mapping' | 'importing' | 'complete';

interface ImportResult {
  success: number;
  errors: number;
}

/**
 * Multi-step dialog for importing CSV data into a dataset.
 * Flow: upload -> preview -> mapping -> import -> complete
 */
export function CSVImportDialog({
  datasetId,
  open,
  onOpenChange,
  onSuccess,
}: CSVImportDialogProps) {
  // State machine for steps
  const [step, setStep] = useState<ImportStep>('upload');

  // Parsed CSV data
  const [parsedCSV, setParsedCSV] = useState<ParsedCSV | null>(null);

  // Validation errors from mapping
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Import progress
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [shouldCancel, setShouldCancel] = useState(false);

  // Hooks
  const { parseFile, isParsing, error: parseError } = useCSVParser();
  const { addItem } = useDatasetMutations();

  // Column mapping - initialize with empty headers, update when CSV is parsed
  const columnMapping = useColumnMapping(parsedCSV?.headers ?? []);

  // Handle file selection
  const handleFileSelect = useCallback(
    async (file: File) => {
      try {
        const result = await parseFile(file);
        setParsedCSV(result);
        // Reset column mapping when new file is selected
        columnMapping.resetMapping();
        setStep('preview');
      } catch {
        // Error is handled in useCSVParser
      }
    },
    [parseFile, columnMapping],
  );

  // Validate mapped data before import
  const validateMappedData = useCallback((): ValidationError[] => {
    if (!parsedCSV) return [];

    const errors: ValidationError[] = [];
    const { data, headers } = parsedCSV;
    const { mapping } = columnMapping;

    // Find columns mapped to input
    const inputColumns = headers.filter(h => mapping[h] === 'input');

    if (inputColumns.length === 0) {
      errors.push({
        row: 0,
        column: 'Input',
        message: 'At least one column must be mapped to Input',
      });
      return errors;
    }

    // Check each row for missing input values
    data.forEach((row, index) => {
      const rowNum = index + 2; // 1-indexed + header row

      // Check if all input columns have values
      inputColumns.forEach(col => {
        const value = row[col];
        if (value === null || value === undefined || value === '') {
          errors.push({
            row: rowNum,
            column: col,
            message: 'Input value is required',
          });
        }
      });
    });

    return errors;
  }, [parsedCSV, columnMapping]);

  // Build item from row using mapping
  const buildItemFromRow = useCallback(
    (row: Record<string, unknown>, mapping: ColumnMapping, headers: string[]) => {
      // Get input value(s)
      const inputColumns = headers.filter(h => mapping[h] === 'input');
      const input =
        inputColumns.length === 1
          ? row[inputColumns[0]]
          : inputColumns.reduce<Record<string, unknown>>((acc, col) => {
              acc[col] = row[col];
              return acc;
            }, {});

      // Get expected output value(s)
      const expectedOutputColumns = headers.filter(h => mapping[h] === 'expectedOutput');
      let expectedOutput: unknown | undefined;
      if (expectedOutputColumns.length === 1) {
        expectedOutput = row[expectedOutputColumns[0]];
      } else if (expectedOutputColumns.length > 1) {
        expectedOutput = expectedOutputColumns.reduce<Record<string, unknown>>((acc, col) => {
          acc[col] = row[col];
          return acc;
        }, {});
      }

      // Get metadata value(s)
      const metadataColumns = headers.filter(h => mapping[h] === 'metadata');
      let metadata: Record<string, unknown> | undefined;
      if (metadataColumns.length > 0) {
        metadata = metadataColumns.reduce<Record<string, unknown>>((acc, col) => {
          acc[col] = row[col];
          return acc;
        }, {});
      }

      return { input, expectedOutput, metadata };
    },
    [],
  );

  // Handle validate and import
  const handleValidateAndImport = useCallback(async () => {
    const errors = validateMappedData();
    setValidationErrors(errors);

    if (errors.length > 0) {
      return;
    }

    if (!parsedCSV) return;

    setStep('importing');
    setIsImporting(true);
    setShouldCancel(false);

    const { data, headers } = parsedCSV;
    const { mapping } = columnMapping;

    let successCount = 0;
    let errorCount = 0;

    setImportProgress({ current: 0, total: data.length });

    for (let i = 0; i < data.length; i++) {
      // Check for cancellation
      if (shouldCancel) {
        break;
      }

      const row = data[i];
      const { input, expectedOutput, metadata } = buildItemFromRow(row, mapping, headers);

      try {
        await addItem.mutateAsync({
          datasetId,
          input,
          expectedOutput,
          metadata,
        });
        successCount++;
      } catch {
        errorCount++;
      }

      setImportProgress({ current: i + 1, total: data.length });
    }

    setImportResult({ success: successCount, errors: errorCount });
    setIsImporting(false);
    setStep('complete');
  }, [validateMappedData, parsedCSV, columnMapping, buildItemFromRow, addItem, datasetId, shouldCancel]);

  // Handle cancel import
  const handleCancelImport = useCallback(() => {
    setShouldCancel(true);
  }, []);

  // Handle done - close dialog and notify
  const handleDone = useCallback(() => {
    onOpenChange(false);
    onSuccess?.();

    // Reset state after close animation
    setTimeout(() => {
      setStep('upload');
      setParsedCSV(null);
      setValidationErrors([]);
      setImportProgress({ current: 0, total: 0 });
      setImportResult(null);
    }, 150);
  }, [onOpenChange, onSuccess]);

  // Handle dialog close
  const handleClose = useCallback(() => {
    if (isImporting) {
      // Confirm before closing during import
      if (confirm('Import is in progress. Are you sure you want to cancel?')) {
        handleCancelImport();
        onOpenChange(false);
      }
      return;
    }

    onOpenChange(false);

    // Reset state after close animation
    setTimeout(() => {
      setStep('upload');
      setParsedCSV(null);
      setValidationErrors([]);
      setImportProgress({ current: 0, total: 0 });
      setImportResult(null);
    }, 150);
  }, [isImporting, handleCancelImport, onOpenChange]);

  // Handle mapping change
  const handleMappingChange = useCallback(
    (column: string, field: FieldType) => {
      columnMapping.setColumnField(column, field);
      // Clear validation errors when mapping changes
      setValidationErrors([]);
    },
    [columnMapping],
  );

  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case 'upload':
        return (
          <CSVUploadStep
            onFileSelect={handleFileSelect}
            isParsing={isParsing}
            error={parseError?.message}
          />
        );

      case 'preview':
        return parsedCSV ? (
          <div className="flex flex-col gap-4">
            <div className="text-sm text-neutral4">
              Preview of your CSV data. Click Next to map columns.
            </div>
            <CSVPreviewTable headers={parsedCSV.headers} data={parsedCSV.data} maxRows={5} />
          </div>
        ) : null;

      case 'mapping':
        return parsedCSV ? (
          <div className="flex flex-col gap-4">
            <ColumnMappingStep
              headers={parsedCSV.headers}
              mapping={columnMapping.mapping}
              onMappingChange={handleMappingChange}
            />

            {validationErrors.length > 0 && (
              <ValidationSummary errors={validationErrors} />
            )}

            {/* Compact preview */}
            <div className="border-t border-border1 pt-4">
              <div className="text-xs text-neutral4 mb-2">Data Preview</div>
              <CSVPreviewTable headers={parsedCSV.headers} data={parsedCSV.data} maxRows={3} />
            </div>
          </div>
        ) : null;

      case 'importing':
        return (
          <div className="flex flex-col items-center gap-4 py-8">
            <Spinner size="lg" />
            <div className="text-center">
              <div className="text-lg font-medium text-neutral1">
                Importing items...
              </div>
              <div className="text-sm text-neutral4 mt-1">
                {importProgress.current} of {importProgress.total}
              </div>
            </div>
            <Button variant="ghost" onClick={handleCancelImport}>
              Cancel
            </Button>
          </div>
        );

      case 'complete':
        return (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="text-4xl">
              {importResult && importResult.errors === 0 ? '✓' : '⚠'}
            </div>
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
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
        );

      case 'preview':
        return (
          <>
            <Button variant="ghost" onClick={() => setStep('upload')}>
              Back
            </Button>
            <Button variant="primary" onClick={() => setStep('mapping')}>
              Next
            </Button>
          </>
        );

      case 'mapping':
        return (
          <>
            <Button variant="ghost" onClick={() => setStep('preview')}>
              Back
            </Button>
            <Button
              variant="primary"
              onClick={handleValidateAndImport}
              disabled={!columnMapping.isInputMapped}
            >
              Validate &amp; Import
            </Button>
          </>
        );

      case 'importing':
        return null; // Cancel button is in the content

      case 'complete':
        return (
          <Button variant="primary" onClick={handleDone}>
            Done
          </Button>
        );
    }
  };

  // Step titles
  const stepTitles: Record<ImportStep, string> = {
    upload: 'Import CSV',
    preview: 'Preview Data',
    mapping: 'Map Columns',
    importing: 'Importing',
    complete: 'Import Complete',
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{stepTitles[step]}</DialogTitle>
          <DialogDescription>Import dataset items from a CSV file.</DialogDescription>
        </DialogHeader>

        <DialogBody className="min-h-[200px] max-h-[50vh] overflow-y-auto">
          {renderStepContent()}
        </DialogBody>

        <DialogFooter className="px-6 pt-4 flex justify-end gap-2">
          {renderFooter()}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
