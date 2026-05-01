import { Button, cn } from '@mastra/playground-ui';
import { ArrowUpIcon, Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
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
  containerTestId?: string;
  tone?: 'neutral' | 'success' | 'info';
}

const toneClasses = {
  neutral: 'border-border1 focus-within:border-neutral3',
  success: 'border-accent1Dark focus-within:border-accent1',
  info: 'border-accent5Dark focus-within:border-accent5',
};

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
  containerTestId,
  tone = 'neutral',
}: ChatComposerProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <form onSubmit={onSubmit} className="shrink-0">
      <div
        className={cn('rounded-3xl border bg-surface2 px-3 pt-2.5 transition-colors', toneClasses[tone])}
        style={{ viewTransitionName: 'chat-composer' }}
        data-testid={containerTestId}
      >
        <ChatTextarea
          ref={textareaRef}
          testId={inputTestId}
          placeholder={placeholder}
          value={draft}
          onChange={e => onDraftChange(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
        />
        <div className="flex items-center justify-end pb-3">
          <Button
            type="submit"
            variant="default"
            size="icon-sm"
            tooltip={isRunning ? 'Generating…' : 'Send'}
            disabled={!canSubmit}
            data-testid={submitTestId}
            className="rounded-full"
          >
            {isRunning ? <Loader2 className="animate-spin" /> : <ArrowUpIcon />}
          </Button>
        </div>
      </div>
    </form>
  );
};
