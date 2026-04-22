import { IconButton, Textarea, Txt, cn } from '@mastra/playground-ui';
import { ArrowLeftIcon, ArrowUpIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { buildInitialConversation } from '../../fixtures';
import type { BuilderMessage } from '../../fixtures';

interface ConversationPanelProps {
  initialUserMessage?: string;
}

export const ConversationPanel = ({ initialUserMessage }: ConversationPanelProps) => {
  const [messages, setMessages] = useState<BuilderMessage[]>(() => buildInitialConversation(initialUserMessage));
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const trimmed = draft.trim();

  const sendMessage = (content: string) => {
    const text = content.trim();
    if (text.length === 0) return;

    const userId = `user-${Date.now()}`;
    const assistantId = `assistant-${Date.now()}`;

    setMessages(prev => [
      ...prev,
      { id: userId, role: 'user', content: text },
      {
        id: assistantId,
        role: 'assistant',
        content: "Done — I've updated the agent. Want to tune anything else?",
      },
    ]);
    setDraft('');
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    sendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface1 pt-6">
      <IconButton onClick={() => navigate('/agent-builder/agents')} className="rounded-full" tooltip="Agents list">
        <ArrowLeftIcon />
      </IconButton>

      <div className="flex shrink-0 items-center py-3">
        <Txt variant="ui-xs" className="font-medium uppercase tracking-wider text-neutral3">
          Builder
        </Txt>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto pb-4">
        <div className="flex flex-col gap-3">
          {messages.map(message => (
            <MessageRow key={message.id} message={message} />
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="shrink-0 pb-6">
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
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[44px] resize-none px-3 py-2.5 outline-none focus:outline-none focus-visible:outline-none"
            rows={1}
          />
          <div className="flex items-center justify-end px-2 pb-2">
            <IconButton
              type="submit"
              variant="default"
              size="sm"
              tooltip="Send"
              disabled={trimmed.length === 0}
              data-testid="agent-builder-conversation-submit"
              className="rounded-full"
            >
              <ArrowUpIcon />
            </IconButton>
          </div>
        </div>
      </form>
    </div>
  );
};

const MessageRow = ({ message }: { message: BuilderMessage }) => {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="rounded-md bg-surface3 px-3 py-2">
        <Txt variant="ui-sm" className="whitespace-pre-wrap leading-relaxed text-neutral6">
          {message.content}
        </Txt>
      </div>
    );
  }

  return (
    <div className="px-1">
      <Txt variant="ui-sm" className={cn('whitespace-pre-wrap leading-relaxed text-neutral4')}>
        {message.content}
      </Txt>
    </div>
  );
};
