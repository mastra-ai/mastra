'use client';

import { Icon } from '@mastra/playground-ui/icons/Icon';
import { AlertTriangle } from 'lucide-react';
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
    <div className="rounded-md border border-accent2/30 bg-accent2/10 p-3">
      <div className="mb-2 flex items-center gap-2 text-accent2">
        <Icon>
          <AlertTriangle className="size-4" />
        </Icon>
        <span className="text-sm font-medium">
          {errors.length} validation error{errors.length !== 1 ? 's' : ''}
        </span>
      </div>

      <ul className="space-y-1 text-sm text-accent2/80">
        {displayErrors.map((error: JSONValidationError, index: number) => (
          <li key={index} className="flex gap-2">
            <span className="shrink-0">•</span>
            <span>{error.message}</span>
          </li>
        ))}
      </ul>

      {hiddenCount > 0 && (
        <div className="mt-2 text-xs text-accent2/60">
          +{hiddenCount} more error{hiddenCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
