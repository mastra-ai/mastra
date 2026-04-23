import { IconButton, Textarea } from '@mastra/playground-ui';
import { ArrowUpIcon } from 'lucide-react';

interface ConversationComposerProps {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled: boolean;
  canSubmit: boolean;
}

export const ConversationComposer = ({
  draft,
  onDraftChange,
  onSubmit,
  onKeyDown,
  disabled,
  canSubmit,
}: ConversationComposerProps) => {
  return (
    <form onSubmit={onSubmit} className="shrink-0 pb-6">
      <div
        className="rounded-xl border border-border1 bg-surface2 transition-colors focus-within:border-neutral3"
        style={{ viewTransitionName: 'agent-builder-prompt' }}
      >
        <Textarea
          testId="agent-builder-conversation-input"
          size="md"
          variant="unstyled"
          placeholder="Ask a follow-up…"
          value={draft}
          onChange={e => onDraftChange(e.target.value)}
          onKeyDown={onKeyDown}
          className="min-h-[44px] resize-none px-3 py-2.5 outline-none focus:outline-none focus-visible:outline-none"
          rows={1}
          disabled={disabled}
        />
        <div className="flex items-center justify-end px-2 pb-2">
          <IconButton
            type="submit"
            variant="default"
            size="sm"
            tooltip="Send"
            disabled={!canSubmit}
            data-testid="agent-builder-conversation-submit"
            className="rounded-full"
          >
            <ArrowUpIcon />
          </IconButton>
        </div>
      </div>
    </form>
  );
};
