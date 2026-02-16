'use client';

import { Alert, AlertTitle } from '@/ds/components/Alert';

export interface ValidationError {
  row: number;
  column: string;
  message: string;
}

export interface ValidationSummaryProps {
  errors: ValidationError[];
}

/**
 * Displays validation errors found during CSV import.
 * Returns null if no errors.
 */
export function ValidationSummary({ errors }: ValidationSummaryProps) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <Alert variant="destructive">
      <AlertTitle>
        {errors.length} validation error{errors.length !== 1 ? 's' : ''} found
      </AlertTitle>
      <div className="mt-2 max-h-[120px] overflow-y-auto space-y-1 text-sm">
        {errors.map((error: ValidationError, index: number) => (
          <div key={index}>
            Row {error.row}: <span className="font-medium">[{error.column}]</span> - {error.message}
          </div>
        ))}
      </div>
    </Alert>
  );
}
