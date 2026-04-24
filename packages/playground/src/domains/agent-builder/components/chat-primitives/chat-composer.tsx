import { IconButton } from '@mastra/playground-ui';
import { ArrowUpIcon } from 'lucide-react';
import { ChatTextarea } from './chat-textarea';

interface ChatComposerProps {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled: boolean;
  canSubmit: boolean;
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
  placeholder = 'Ask a follow-up…',
  inputTestId,
  submitTestId,
  viewTransitionName,
}: ChatComposerProps) => {
  return (
    <form onSubmit={onSubmit} className="shrink-0">
      <div
        className="rounded-xl border border-border1 bg-surface2 px-3 pt-2.5 transition-colors focus-within:border-neutral3"
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
        <div className="flex items-center justify-end px-2 pb-2">
          <IconButton
            type="submit"
            variant="default"
            size="sm"
            tooltip="Send"
            disabled={!canSubmit}
            data-testid={submitTestId}
            className="rounded-full"
          >
            <ArrowUpIcon />
          </IconButton>
        </div>
      </div>
    </form>
  );
};
