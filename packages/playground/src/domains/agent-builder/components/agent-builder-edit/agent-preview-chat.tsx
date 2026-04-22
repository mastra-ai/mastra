import { Avatar, IconButton, Textarea, Txt, cn } from '@mastra/playground-ui';
import { ArrowUpIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { buildPreviewConversation, buildPreviewReply } from '../../fixtures';
import type { AgentFixture, BuilderMessage } from '../../fixtures';

interface AgentPreviewChatProps {
  agent: AgentFixture;
}

export const AgentPreviewChat = ({ agent }: AgentPreviewChatProps) => {
  const [messages, setMessages] = useState<BuilderMessage[]>(() => buildPreviewConversation());
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

    const userId = `preview-user-${Date.now()}`;
    setMessages(prev => [...prev, { id: userId, role: 'user', content: trimmed }, buildPreviewReply(trimmed)]);
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
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          {messages.map(message => (
            <PreviewBubble key={message.id} message={message} agent={agent} />
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="shrink-0 px-8 pb-6">
        <div className="mx-auto w-full max-w-2xl">
          <div className="rounded-xl border border-border1 bg-surface2 transition-colors focus-within:border-neutral3">
            <Textarea
              testId="agent-preview-chat-input"
              size="md"
              variant="unstyled"
              placeholder={`Ask ${agent.name}…`}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[44px] resize-none px-4 py-3 outline-none focus:outline-none focus-visible:outline-none"
              rows={1}
            />
            <div className="flex items-center justify-end px-2 pb-2">
              <IconButton
                type="submit"
                variant="default"
                size="sm"
                tooltip="Send"
                disabled={trimmed.length === 0}
                data-testid="agent-preview-chat-submit"
                className="rounded-full"
              >
                <ArrowUpIcon />
              </IconButton>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

interface PreviewBubbleProps {
  message: BuilderMessage;
  agent: AgentFixture;
}

const PreviewBubble = ({ message, agent }: PreviewBubbleProps) => {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex items-start gap-3', isUser && 'flex-row-reverse')}>
      {isUser ? <Avatar name="You" size="sm" /> : <Avatar name={agent.name} size="sm" src={agent.avatarUrl} />}
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5',
          isUser ? 'bg-surface3 text-neutral6' : 'bg-surface2 text-neutral5',
        )}
      >
        <Txt variant="ui-sm" className="whitespace-pre-wrap leading-relaxed">
          {message.content}
        </Txt>
      </div>
    </div>
  );
};
