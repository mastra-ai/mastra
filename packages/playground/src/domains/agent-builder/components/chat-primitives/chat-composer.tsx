import { IconButton } from '@mastra/playground-ui';
import { ArrowUpIcon, Loader2 } from 'lucide-react';
import { ChatTextarea } from './chat-textarea';

interface ChatComposerProps {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled: boolean;
  canSubmit: boolean;
  isRunning?: boolean;
  placeholder?: string;
  inputTestId?: string;
  submitTestId?: string;
  viewTransitionName?: string;
}

export const ChatComposer = ({
  draft,
  onDraftChange,
  onSubmit,
  onKeyDown,
  disabled,
  canSubmit,
  isRunning = false,
  placeholder = 'Ask a follow-up…',
  inputTestId,
  submitTestId,
  viewTransitionName,
}: ChatComposerProps) => {
  return (
    <form onSubmit={onSubmit} className="shrink-0">
      <div
        className="rounded-3xl border border-border1 bg-surface2 px-3 pt-2.5 transition-colors focus-within:border-neutral3"
        style={viewTransitionName ? { viewTransitionName } : undefined}
      >
        <ChatTextarea
          testId={inputTestId}
          placeholder={placeholder}
          value={draft}
          onChange={e => onDraftChange(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
        />
        <div className="flex items-center justify-end pb-3">
          <IconButton
            type="submit"
            variant="default"
            size="sm"
            tooltip={isRunning ? 'Generating…' : 'Send'}
            disabled={!canSubmit}
            data-testid={submitTestId}
            className="rounded-full"
          >
            {isRunning ? <Loader2 className="animate-spin" /> : <ArrowUpIcon />}
          </IconButton>
        </div>
      </div>
    </form>
  );
};
