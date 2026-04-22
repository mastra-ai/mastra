import { Avatar, IconButton, Textarea, Txt, cn } from '@mastra/playground-ui';
import { ArrowUpIcon, SparklesIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { buildInitialConversation, type BuilderMessage } from '../../fixtures';

interface ConversationPanelProps {
  initialUserMessage?: string;
}

export const ConversationPanel = ({ initialUserMessage }: ConversationPanelProps) => {
  const [messages, setMessages] = useState<BuilderMessage[]>(() => buildInitialConversation(initialUserMessage));
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const trimmed = draft.trim();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (trimmed.length === 0) return;

    const userId = `user-${Date.now()}`;
    const assistantId = `assistant-${Date.now()}`;

    setMessages(prev => [
      ...prev,
      { id: userId, role: 'user', content: trimmed },
      {
        id: assistantId,
        role: 'assistant',
        content:
          "Thanks — I've updated the agent preview on the right. Tell me what else we should tune and I'll keep iterating.",
      },
    ]);
    setDraft('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-border1 px-6 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent1Dark text-accent1">
          <SparklesIcon className="h-4 w-4" />
        </div>
        <div className="flex flex-col">
          <Txt variant="ui-md" className="font-medium text-neutral6">
            Agent Builder
          </Txt>
          <Txt variant="ui-xs" className="text-neutral3">
            Chat to shape your agent
          </Txt>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
          {messages.map(message => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="border-t border-border1 px-6 py-4">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
          <Textarea
            testId="agent-builder-conversation-input"
            size="default"
            placeholder="Describe what to change, add or remove…"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="flex items-center justify-end">
            <IconButton
              type="submit"
              variant="primary"
              size="md"
              tooltip="Send"
              disabled={trimmed.length === 0}
              data-testid="agent-builder-conversation-submit"
            >
              <ArrowUpIcon />
            </IconButton>
          </div>
        </div>
      </form>
    </div>
  );
};

const MessageBubble = ({ message }: { message: BuilderMessage }) => {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex items-start gap-3', isUser && 'flex-row-reverse')}>
      {isUser ? (
        <Avatar name="You" size="sm" />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border1 bg-accent1Dark text-accent1">
          <SparklesIcon className="h-4 w-4" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[80%] rounded-lg border border-border1 px-4 py-3',
          isUser ? 'bg-surface4 text-neutral6' : 'bg-surface2 text-neutral5',
        )}
      >
        <Txt variant="ui-sm" className="whitespace-pre-wrap leading-relaxed">
          {message.content}
        </Txt>
      </div>
    </div>
  );
};
