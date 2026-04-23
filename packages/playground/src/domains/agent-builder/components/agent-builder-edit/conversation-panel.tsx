import { createTool, clientSdkZod } from '@mastra/client-js';
import { IconButton, Textarea, Txt } from '@mastra/playground-ui';
import { useChat } from '@mastra/react';
import { ArrowLeftIcon, ArrowUpIcon } from 'lucide-react';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';

import { useFormContext } from 'react-hook-form';
import { useNavigate } from 'react-router';

import { MessageRow } from '../chat-primitives/messages';
import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';

interface ConversationPanelProps {
  initialUserMessage?: string;
}

export const ConversationPanel = ({ initialUserMessage }: ConversationPanelProps) => {
  const formMethods = useFormContext<AgentBuilderEditFormValues>();
  const hasAlreadySentDevMode = useRef(false);
  const { messages, sendMessage, isRunning } = useChat({
    agentId: 'builder-agent',
  });
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const agentBuilderTool = useMemo(
    () =>
      createTool({
        id: 'builder-agent-tool',
        description: 'Modify the entire agent metadata configuration that you are building from a form in a React app',
        inputSchema: clientSdkZod.object({
          name: clientSdkZod.string().describe('The name of the agent you created'),
        }),
        outputSchema: clientSdkZod.object({
          success: clientSdkZod.boolean(),
        }),
        execute: async inputData => {
          console.log('CALLLED LOL', inputData);
          if (inputData.context.name) {
            formMethods.setValue('name', inputData.context.name);
          }

          return { success: true };
        },
      }),
    [formMethods],
  );

  const effectEvent = useEffectEvent(() => {
    if (!initialUserMessage) return;
    void sendMessage({ message: initialUserMessage, clientTools: { agentBuilderTool } });
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

    void sendMessage({
      message: trimmed,
      clientTools: {
        agentBuilderTool,
      },
    });
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
