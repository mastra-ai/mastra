import { Button } from '@mastra/playground-ui/components/Button';
import { ArrowUpIcon, Loader2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { useAgentColor } from '../../contexts/agent-color-context';
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
  containerTestId,
}: ChatComposerProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const agentColor = useAgentColor();

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const containerStyle = useMemo<CSSProperties>(
    () => ({
      viewTransitionName: 'chat-composer',
      ['--agent-color-fg' as string]: agentColor.foreground,
      ['--agent-color-bg' as string]: agentColor.background,
    }),
    [agentColor],
  );

  return (
    <form onSubmit={onSubmit} className="shrink-0">
      <div
        className="border-border1 bg-surface2 rounded-3xl border px-3 pt-2.5 transition-colors focus-within:border-[var(--agent-color-bg)]"
        style={containerStyle}
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
