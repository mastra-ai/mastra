import { IconButton, Textarea, Txt } from '@mastra/playground-ui';
import { useChat } from '@mastra/react';
import { ArrowLeftIcon, ArrowUpIcon } from 'lucide-react';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { MessageRow } from '../chat-primitives/messages';

interface ConversationPanelProps {
  initialUserMessage?: string;
}

export const ConversationPanel = ({ initialUserMessage }: ConversationPanelProps) => {
  const hasAlreadySentDevMode = useRef(false);
  const { messages, sendMessage, isRunning } = useChat({
    agentId: 'agent-builder-agent',
  });
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const effectEvent = useEffectEvent(() => {
    if (!initialUserMessage) return;
    void sendMessage({ message: initialUserMessage });
  });

  useEffect(() => {
    window.history.replaceState({}, '');
    if (hasAlreadySentDevMode.current) return;
    effectEvent();

    hasAlreadySentDevMode.current = true;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const trimmed = draft.trim();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void sendMessage({ message: trimmed });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  console.log('lol', messages);

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
