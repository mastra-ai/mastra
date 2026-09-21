import { quietTextHover } from '@mastra/playground-ui/primitives/typography';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
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
        className="text-caption text-muted-foreground flex items-center gap-1.5"
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
        className="text-caption text-muted-foreground flex items-center gap-1.5"
        data-testid="agent-builder-autosave-saved"
      >
        <CheckIcon className="h-3.5 w-3.5" />
        Saved
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span
        className="text-caption text-muted-foreground flex items-center gap-1.5"
        data-testid="agent-builder-autosave-error"
      >
        <span title={lastError?.message}>Failed to save</span>
        <button
          type="button"
          onClick={onRetry}
          data-testid="agent-builder-autosave-retry"
          className={cn('underline underline-offset-2', quietTextHover, controlStateColorTransition)}
        >
          Retry
        </button>
      </span>
    );
  }

  return null;
};
