'use client';

import { AlertTriangleIcon, CheckCircleIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
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
      <div className={cn('flex items-center gap-2 text-sm text-success', className)}>
        <CheckCircleIcon className="w-4 h-4" />
        All {totalRows} row{totalRows !== 1 ? 's' : ''} valid
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Summary warning */}
      <div className="flex items-center gap-2 text-sm text-warning">
        <AlertTriangleIcon className="w-4 h-4" />
        {invalidCount} of {totalRows} rows will be skipped (validation failed)
      </div>

      {validCount > 0 && <div className="text-sm text-muted-foreground">{validCount} rows will be imported</div>}

      {/* Failing rows table */}
      <div className="max-h-48 overflow-y-auto border rounded-md">
        <table className="w-full text-xs">
          <thead className="bg-muted sticky top-0">
            <tr>
              <th className="px-2 py-1 text-left font-medium">Row</th>
              <th className="px-2 py-1 text-left font-medium">Field</th>
              <th className="px-2 py-1 text-left font-medium">Error</th>
            </tr>
          </thead>
          <tbody>
            {invalidRows.map((row: RowValidationResult, idx: number) => (
              <ValidationRow key={idx} row={row} />
            ))}
            {invalidCount > invalidRows.length && (
              <tr>
                <td colSpan={3} className="px-2 py-1 text-muted-foreground italic">
                  ... and {invalidCount - invalidRows.length} more
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
        <code className="text-xs bg-muted px-1 rounded">
          {row.field}
          {errorPath !== '/' ? errorPath : ''}
        </code>
      </td>
      <td className="px-2 py-1 text-destructive">{errorMessage}</td>
    </tr>
  );
}
