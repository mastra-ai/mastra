'use client';
import { Button } from '@mastra/playground-ui/components/Button';
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
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useDatasetMutations, useDataset } from '@mastra/react/hooks/datasets';
import { useCallback, useState } from 'react';
import type { ColumnMapping, FieldType } from '../../hooks/use-column-mapping';
import { useColumnMapping } from '../../hooks/use-column-mapping';
import type { ParsedCSV } from '../../hooks/use-csv-parser';
import { useCSVParser } from '../../hooks/use-csv-parser';
import type { CsvValidationResult } from '../../utils/csv-validation';
import { validateCsvRows } from '../../utils/csv-validation';
import { ColumnMappingStep } from './column-mapping-step';
import { CSVPreviewTable } from './csv-preview-table';
import { CSVUploadStep } from './csv-upload-step';
import { ValidationReport } from './validation-report';
import type { ValidationError } from './validation-summary';
import { ValidationSummary } from './validation-summary';

export interface CSVImportDialogProps {
  datasetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type ImportStep = 'upload' | 'preview' | 'mapping' | 'validation' | 'importing' | 'complete';

interface ImportResult {
  success: number;
  errors: number;
}

/**
 * Multi-step dialog for importing CSV data into a dataset.
 * Flow: upload -> preview -> mapping -> import -> complete
 */
export function CSVImportDialog({ datasetId, open, onOpenChange, onSuccess }: CSVImportDialogProps) {
  const [step, setStep] = useState<ImportStep>('upload');

  const [parsedCSV, setParsedCSV] = useState<ParsedCSV | null>(null);

  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [schemaValidation, setSchemaValidation] = useState<CsvValidationResult | null>(null);

  const { parseFile, isParsing, error: parseError } = useCSVParser();
  const { batchInsertItems } = useDatasetMutations();
  const { data: dataset } = useDataset({ datasetId: datasetId, queryOptions: { enabled: Boolean(datasetId) } });

  const columnMapping = useColumnMapping(parsedCSV?.headers ?? []);

  const handleFileSelect = useCallback(
    async (file: File) => {
      try {
        const result = await parseFile(file);
        setParsedCSV(result);
        columnMapping.resetMapping();
        setStep('preview');
      } catch {}
    },
    [parseFile, columnMapping],
  );

  const validateMappedData = useCallback((): ValidationError[] => {
    if (!parsedCSV) return [];

    const errors: ValidationError[] = [];
    const { data, headers } = parsedCSV;
    const { mapping } = columnMapping;

    const inputColumns = headers.filter(h => mapping[h] === 'input');

    if (inputColumns.length === 0) {
      errors.push({
        row: 0,
        column: 'Input',
        message: 'At least one column must be mapped to Input',
      });
      return errors;
    }

    data.forEach((row: Record<string, unknown>, index: number) => {
      const rowNum = index + 2;

      inputColumns.forEach((col: string) => {
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

  const buildItemFromRow = useCallback((row: Record<string, unknown>, mapping: ColumnMapping, headers: string[]) => {
    const inputColumns = headers.filter(h => mapping[h] === 'input');
    const input =
      inputColumns.length === 1
        ? row[inputColumns[0]]
        : inputColumns.reduce<Record<string, unknown>>((acc, col) => {
            acc[col] = row[col];
            return acc;
          }, {});

    const groundTruthColumns = headers.filter(h => mapping[h] === 'groundTruth');
    let groundTruth: unknown | undefined;
    if (groundTruthColumns.length === 1) {
      groundTruth = row[groundTruthColumns[0]];
    } else if (groundTruthColumns.length > 1) {
      groundTruth = groundTruthColumns.reduce<Record<string, unknown>>((acc, col) => {
        acc[col] = row[col];
        return acc;
      }, {});
    }

    const metadataColumns = headers.filter(h => mapping[h] === 'metadata');
    let metadata: Record<string, unknown> | undefined;
    if (metadataColumns.length > 0) {
      metadata = metadataColumns.reduce<Record<string, unknown>>((acc, col) => {
        acc[col] = row[col];
        return acc;
      }, {});
    }

    return { input, groundTruth, metadata };
  }, []);

  const handleValidateMapping = useCallback(() => {
    const errors = validateMappedData();
    setValidationErrors(errors);

    if (errors.length > 0) {
      return;
    }

    if (!parsedCSV) return;

    const { data, headers } = parsedCSV;
    const { mapping } = columnMapping;

    const mappedRows = data.map((row: Record<string, unknown>) => buildItemFromRow(row, mapping, headers));

    const hasSchemas = dataset?.inputSchema || dataset?.groundTruthSchema;

    if (hasSchemas) {
      const result = validateCsvRows(
        mappedRows,
        dataset?.inputSchema as Record<string, unknown> | null | undefined,
        dataset?.groundTruthSchema as Record<string, unknown> | null | undefined,
        10,
      );
      setSchemaValidation(result);

      if (result.validCount === 0) {
        setValidationErrors([
          {
            row: 0,
            column: '',
            message: 'All rows failed schema validation. Please check your data.',
          },
        ]);
        return;
      }

      setStep('validation');
    } else {
      setSchemaValidation({
        validCount: mappedRows.length,
        invalidCount: 0,
        validRows: mappedRows.map(
          (row: { input: unknown; groundTruth?: unknown; metadata?: Record<string, unknown> }, i: number) => ({
            rowNumber: i + 2,
            ...row,
          }),
        ),
        invalidRows: [],
        totalRows: mappedRows.length,
      });
      setStep('validation');
    }
  }, [validateMappedData, parsedCSV, columnMapping, buildItemFromRow, dataset]);

  const handleImport = useCallback(async () => {
    if (!schemaValidation || schemaValidation.validCount === 0) return;

    setStep('importing');
    setIsImporting(true);

    const rowsToImport = schemaValidation.validRows;

    setImportProgress({ current: 0, total: rowsToImport.length });

    const items = rowsToImport.map(row => {
      const { input, groundTruth } = row;

      let metadata: Record<string, unknown> | undefined;
      if (parsedCSV) {
        const originalRowIndex = row.rowNumber - 2;
        const { headers } = parsedCSV;
        const { mapping } = columnMapping;
        const originalRow = parsedCSV.data[originalRowIndex];
        if (originalRow) {
          const metadataColumns = headers.filter(h => mapping[h] === 'metadata');
          if (metadataColumns.length > 0) {
            metadata = metadataColumns.reduce<Record<string, unknown>>((acc, col) => {
              acc[col] = originalRow[col];
              return acc;
            }, {});
          }
        }
      }

      return { input, groundTruth, metadata };
    });

    try {
      await batchInsertItems.mutateAsync({ datasetId, items });
      setImportResult({ success: items.length, errors: 0 });
    } catch {
      setImportResult({ success: 0, errors: items.length });
    }

    setImportProgress({ current: rowsToImport.length, total: rowsToImport.length });
    setIsImporting(false);
    setStep('complete');
  }, [schemaValidation, batchInsertItems, datasetId, parsedCSV, columnMapping]);

  const handleDone = useCallback(() => {
    if (importResult) {
      const skipped = schemaValidation?.invalidCount ?? 0;
      if (skipped > 0) {
        toast.success(
          `Imported ${importResult.success} row${importResult.success !== 1 ? 's' : ''} (${skipped} skipped)`,
        );
      } else {
        toast.success(`Imported ${importResult.success} row${importResult.success !== 1 ? 's' : ''}`);
      }
    }

    onOpenChange(false);
    onSuccess?.();

    setTimeout(() => {
      setStep('upload');
      setParsedCSV(null);
      setValidationErrors([]);
      setSchemaValidation(null);
      setImportProgress({ current: 0, total: 0 });
      setImportResult(null);
    }, 150);
  }, [onOpenChange, onSuccess, importResult, schemaValidation]);

  const handleClose = useCallback(() => {
    onOpenChange(false);

    setTimeout(() => {
      setStep('upload');
      setParsedCSV(null);
      setValidationErrors([]);
      setSchemaValidation(null);
      setImportProgress({ current: 0, total: 0 });
      setImportResult(null);
    }, 150);
  }, [onOpenChange]);

  const handleMappingChange = useCallback(
    (column: string, field: FieldType) => {
      columnMapping.setColumnField(column, field);
      setValidationErrors([]);
    },
    [columnMapping],
  );

  const renderStepContent = () => {
    switch (step) {
      case 'upload':
        return <CSVUploadStep onFileSelect={handleFileSelect} isParsing={isParsing} error={parseError?.message} />;

      case 'preview':
        return parsedCSV ? (
          <>
            <div className="text-body text-muted-foreground">Preview of your CSV data. Click Next to map columns.</div>
            <CSVPreviewTable headers={parsedCSV.headers} data={parsedCSV.data} maxRows={5} />
          </>
        ) : null;

      case 'mapping':
        return parsedCSV ? (
          <>
            <ColumnMappingStep
              headers={parsedCSV.headers}
              mapping={columnMapping.mapping}
              onMappingChange={handleMappingChange}
            />

            {validationErrors.length > 0 && <ValidationSummary errors={validationErrors} />}

            <div className="border-t border-border pt-4">
              <div className="mb-2 text-caption text-muted-foreground">Data Preview</div>
              <CSVPreviewTable headers={parsedCSV.headers} data={parsedCSV.data} maxRows={3} />
            </div>
          </>
        ) : null;

      case 'validation':
        return schemaValidation ? (
          <>
            <div className="text-body text-muted-foreground">
              {dataset?.inputSchema || dataset?.groundTruthSchema
                ? 'Rows have been validated against the dataset schema.'
                : 'Ready to import. No schema validation required.'}
            </div>

            {schemaValidation.invalidCount > 0 ? (
              <div className="rounded-md border border-warning-edge bg-warning-subtle p-3">
                <div className="flex items-center gap-2 font-medium text-warning-subtle-foreground">
                  <Txt as="span" variant="heading">
                    ⚠
                  </Txt>
                  {schemaValidation.invalidCount} row{schemaValidation.invalidCount !== 1 ? 's' : ''} will be skipped
                </div>
                <Txt tone="muted" className="mt-1">
                  {schemaValidation.validCount} of {schemaValidation.totalRows} rows will be imported
                </Txt>
              </div>
            ) : (
              <div className="rounded-md border border-success-edge bg-success-subtle p-3">
                <div className="flex items-center gap-2 font-medium text-success-subtle-foreground">
                  <Txt as="span" variant="heading">
                    ✓
                  </Txt>
                  All {schemaValidation.totalRows} row{schemaValidation.totalRows !== 1 ? 's are' : ' is'} valid
                </div>
              </div>
            )}

            {schemaValidation.validCount === 0 && (
              <div role="alert">
                <Notice variant="destructive">
                  No valid rows to import. Please fix the data or adjust the schema.
                </Notice>
              </div>
            )}

            {schemaValidation.invalidCount > 0 && <ValidationReport result={schemaValidation} />}
          </>
        ) : null;

      case 'importing':
        return (
          <div className="flex flex-col items-center gap-4 py-5">
            <Spinner />
            <div className="text-center">
              <div className="text-heading text-placeholder">Importing items...</div>
              <div className="mt-1 text-body text-muted-foreground">
                {importProgress.current} of {importProgress.total}
              </div>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="flex flex-col items-center gap-4 py-5">
            <div className="text-display">{importResult && importResult.errors === 0 ? '✓' : '⚠'}</div>
            <div className="text-center">
              <div className="text-heading text-placeholder">Import Complete</div>
              <div className="mt-1 text-body text-muted-foreground">
                {importResult?.success ?? 0} item{importResult?.success !== 1 ? 's' : ''} imported
                {importResult && importResult.errors > 0 && (
                  <span className="text-destructive-foreground">
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

  const renderFooter = () => {
    switch (step) {
      case 'upload':
        return <DialogCancel>Cancel</DialogCancel>;

      case 'preview':
        return (
          <>
            <Button onClick={() => setStep('upload')}>Back</Button>
            <DialogAction onConfirm={() => setStep('mapping')}>Next</DialogAction>
          </>
        );

      case 'mapping':
        return (
          <>
            <Button onClick={() => setStep('preview')}>Back</Button>
            <DialogAction onConfirm={handleValidateMapping} disabled={!columnMapping.isInputMapped}>
              {dataset?.inputSchema || dataset?.groundTruthSchema ? 'Validate' : 'Next'}
            </DialogAction>
          </>
        );

      case 'validation':
        return (
          <>
            <Button onClick={() => setStep('mapping')}>Back</Button>
            <DialogAction onConfirm={handleImport} disabled={!schemaValidation || schemaValidation.validCount === 0}>
              {schemaValidation?.invalidCount
                ? `Import ${schemaValidation.validCount} Valid Row${schemaValidation.validCount !== 1 ? 's' : ''}`
                : `Import ${schemaValidation?.totalRows ?? 0} Row${schemaValidation?.totalRows !== 1 ? 's' : ''}`}
            </DialogAction>
          </>
        );

      case 'importing':
        return null;

      case 'complete':
        return <DialogAction onConfirm={handleDone}>Done</DialogAction>;
    }
  };

  const stepTitles: Record<ImportStep, string> = {
    upload: 'Import CSV',
    preview: 'Preview Data',
    mapping: 'Map Columns',
    validation: 'Review Validation',
    importing: 'Importing',
    complete: 'Import Complete',
  };

  const footer = renderFooter();

  return (
    <Dialog open={open} onOpenChange={handleClose} pending={isImporting}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{stepTitles[step]}</DialogTitle>
          <DialogDescription>Import dataset items from a CSV file.</DialogDescription>
        </DialogHeader>

        <DialogBody>{renderStepContent()}</DialogBody>

        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
