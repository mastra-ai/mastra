import { Spinner } from '@mastra/playground-ui';
import { CheckIcon } from 'lucide-react';
import type { AutosaveStatus } from '@/domains/agent-builder/hooks/use-autosave-agent';

interface AutosaveIndicatorProps {
  status: AutosaveStatus;
  lastError: Error | null;
  onRetry: () => void;
}

export const AutosaveIndicator = ({ status, lastError, onRetry }: AutosaveIndicatorProps) => {
  if (status === 'saving') {
    return (
      <span
        className="flex items-center gap-1.5 text-ui-sm text-neutral3"
        data-testid="agent-builder-autosave-saving"
      >
        <Spinner size="sm" />
        Saving…
      </span>
    );
  }

  if (status === 'saved') {
    return (
      <span
        className="flex items-center gap-1.5 text-ui-sm text-neutral3"
        data-testid="agent-builder-autosave-saved"
      >
        <CheckIcon className="h-3.5 w-3.5" />
        Saved
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-ui-sm text-neutral3" data-testid="agent-builder-autosave-error">
        <span title={lastError?.message}>Failed to save</span>
        <button
          type="button"
          onClick={onRetry}
          data-testid="agent-builder-autosave-retry"
          className="underline underline-offset-2 hover:text-neutral4"
        >
          Retry
        </button>
      </span>
    );
  }

  return null;
};
