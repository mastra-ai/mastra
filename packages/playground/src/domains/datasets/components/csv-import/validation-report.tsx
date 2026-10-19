'use client';

import { InlineCode } from '@mastra/playground-ui/components/InlineCode';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { cn } from '@mastra/playground-ui/utils/cn';
import { AlertTriangleIcon, CheckCircleIcon } from 'lucide-react';
import type { CsvValidationResult, RowValidationResult } from '../../utils/csv-validation';

interface ValidationReportProps {
  result: CsvValidationResult;
  className?: string;
}

/**
 * Shows validation results after schema validation of CSV rows.
 * Displays count of valid/invalid rows and a table of failures.
 */
export function ValidationReport({ result, className }: ValidationReportProps) {
  const { validCount, invalidCount, totalRows, invalidRows } = result;

  // All rows valid
  if (invalidCount === 0) {
    return (
      <div className={cn('flex items-center gap-2 text-success-indicator', className)}>
        <CheckCircleIcon className="h-4 w-4" />
        <Txt as="span" variant="body" className="block">
          All {totalRows} row{totalRows !== 1 ? 's' : ''} valid
        </Txt>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Summary warning */}
      <div className="flex items-center gap-2 text-warning-foreground">
        <AlertTriangleIcon className="h-4 w-4" />
        <Txt as="span" variant="body" className="block">
          {invalidCount} of {totalRows} rows will be skipped (validation failed)
        </Txt>
      </div>

      {validCount > 0 && (
        <Txt as="p" variant="body" tone="muted">
          {validCount} rows will be imported
        </Txt>
      )}

      {/* Failing rows table */}
      <div className="max-h-48 overflow-y-auto rounded-md border">
        <table className="w-full">
          <thead className="sticky top-0 bg-muted">
            <tr>
              <th className="px-2 py-1 text-left">
                <Txt as="span" variant="column" className="block">
                  Row
                </Txt>
              </th>
              <th className="px-2 py-1 text-left">
                <Txt as="span" variant="column" className="block">
                  Field
                </Txt>
              </th>
              <th className="px-2 py-1 text-left">
                <Txt as="span" variant="column" className="block">
                  Error
                </Txt>
              </th>
            </tr>
          </thead>
          <tbody>
            {invalidRows.map((row: RowValidationResult, idx: number) => (
              <ValidationRow key={idx} row={row} />
            ))}
            {invalidCount > invalidRows.length && (
              <tr>
                <td colSpan={3} className="px-2 py-1 text-muted-foreground italic">
                  <Txt as="span" variant="caption" className="block">
                    ... and {invalidCount - invalidRows.length} more
                  </Txt>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Single row in the validation failure table.
 */
function ValidationRow({ row }: { row: RowValidationResult }) {
  const errorMessage = row.errors[0]?.message || 'Validation failed';
  const errorPath = row.errors[0]?.path || '/';

  return (
    <tr className="border-t">
      <td className="px-2 py-1 text-muted-foreground">{row.rowNumber}</td>
      <td className="px-2 py-1">
        <InlineCode className="rounded bg-muted px-1 text-caption">
          {row.field}
          {errorPath !== '/' ? errorPath : ''}
        </InlineCode>
      </td>
      <td className="px-2 py-1 text-destructive-foreground">{errorMessage}</td>
    </tr>
  );
}
