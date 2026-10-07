import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { quietTextHover } from '@mastra/playground-ui/primitives/typography';
import { cn } from '@mastra/playground-ui/utils/cn';
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
      <Txt
        as="span"
        variant="caption"
        tone="muted"
        className="flex items-center gap-1.5"
        data-testid="agent-builder-autosave-saving"
      >
        <Spinner size="sm" />
        Saving…
      </Txt>
    );
  }

  if (status === 'saved') {
    return (
      <Txt
        as="span"
        variant="caption"
        tone="muted"
        className="flex items-center gap-1.5"
        data-testid="agent-builder-autosave-saved"
      >
        <CheckIcon className="h-3.5 w-3.5" />
        Saved
      </Txt>
    );
  }

  if (status === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-muted-foreground" data-testid="agent-builder-autosave-error">
        <Txt as="span" variant="caption" title={lastError?.message}>
          Failed to save
        </Txt>
        <button
          type="button"
          onClick={onRetry}
          data-testid="agent-builder-autosave-retry"
          className={cn('underline underline-offset-2', quietTextHover, controlStateColorTransition)}
        >
          <Txt as="span" variant="caption">
            Retry
          </Txt>
        </button>
      </span>
    );
  }

  return null;
};
