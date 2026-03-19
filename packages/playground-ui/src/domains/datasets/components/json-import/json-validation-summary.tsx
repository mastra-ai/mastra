'use client';

import { AlertTriangle } from 'lucide-react';
import { Icon } from '@/ds/icons';
import type { JSONValidationError } from '../../utils/json-validation';

export interface JSONValidationSummaryProps {
  errors: JSONValidationError[];
  maxErrors?: number;
}

/**
 * Summary of JSON validation errors
 */
export function JSONValidationSummary({ errors, maxErrors = 5 }: JSONValidationSummaryProps) {
  if (errors.length === 0) return null;

  const displayErrors = errors.slice(0, maxErrors);
  const hiddenCount = errors.length - maxErrors;

  return (
    <div className="bg-accent2/10 border border-accent2/30 rounded-md p-3">
      <div className="flex items-center gap-2 text-accent2 mb-2">
        <Icon>
          <AlertTriangle className="w-4 h-4" />
        </Icon>
        <span className="font-medium text-sm">
          {errors.length} validation error{errors.length !== 1 ? 's' : ''}
        </span>
      </div>

      <ul className="text-sm text-accent2/80 space-y-1">
        {displayErrors.map((error: JSONValidationError, index: number) => (
          <li key={index} className="flex gap-2">
            <span className="shrink-0">•</span>
            <span>{error.message}</span>
          </li>
        ))}
      </ul>

      {hiddenCount > 0 && (
        <div className="text-xs text-accent2/60 mt-2">
          +{hiddenCount} more error{hiddenCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
