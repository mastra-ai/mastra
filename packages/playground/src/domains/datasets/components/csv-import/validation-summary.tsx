import { Notice } from '@mastra/playground-ui/components/Notice';
('use client');

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
    <Notice variant="destructive" title={`${errors.length} validation error${errors.length !== 1 ? 's' : ''} found`}>
      <div className="max-h-[120px] space-y-1 overflow-y-auto text-sm">
        {errors.map((error: ValidationError, index: number) => (
          <div key={index}>
            Row {error.row}: <span className="font-medium">[{error.column}]</span> - {error.message}
          </div>
        ))}
      </div>
    </Notice>
  );
}
