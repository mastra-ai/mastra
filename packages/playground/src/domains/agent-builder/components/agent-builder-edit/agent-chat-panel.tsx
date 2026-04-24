import { toAISdkV5Messages } from '@mastra/ai-sdk/ui';
import { Txt } from '@mastra/playground-ui';
import { useChat } from '@mastra/react';
import type { MastraUIMessage } from '@mastra/react';
import { useMemo } from 'react';

import { ChatComposer } from '../chat-primitives/chat-composer';
import { MessageRow, MessagesSkeleton } from '../chat-primitives/messages';
import { useAutoScroll } from './hooks/use-auto-scroll';
import { useChatDraft } from './hooks/use-chat-draft';
import { useAgentMessages } from '@/hooks/use-agent-messages';

interface AgentChatPanelProps {
  agentId: string;
}

export const AgentChatPanel = ({ agentId }: AgentChatPanelProps) => {
  const { data, isLoading: isConversationLoading } = useAgentMessages({
    agentId,
    threadId: agentId,
    memory: true,
  });

  const emptyMessages = useMemo(() => [] as never[], [agentId]);
  const storedMessages = data?.messages ?? emptyMessages;
  const v5Messages = useMemo(() => toAISdkV5Messages(storedMessages) as MastraUIMessage[], [storedMessages]);

  const { messages, sendMessage, isRunning } = useChat({
    agentId,
    initialMessages: v5Messages,
  });

  const send = (message: string) => {
    void sendMessage({ message, threadId: agentId });
  };

  const scrollRef = useAutoScroll(messages);
  const { draft, setDraft, trimmed, handleFormSubmit, handleKeyDown } = useChatDraft({ onSubmit: send });

  const showEmptyState = messages.length === 0 && !isConversationLoading;

  return (
    <div className="flex h-full min-h-0 flex-col px-6 pt-6">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto pb-6 px-6">
        {isConversationLoading && messages.length === 0 ? (
          <MessagesSkeleton testId="agent-builder-agent-chat-messages-skeleton" />
        ) : showEmptyState ? (
          <div
            className="flex h-full flex-col items-center justify-center gap-1 text-center"
            data-testid="agent-builder-agent-chat-empty-state"
          >
            <Txt variant="ui-md" className="text-neutral4">
              Start chatting with this agent
            </Txt>
            <Txt variant="ui-sm" className="text-neutral3">
              Your messages will appear here.
            </Txt>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {messages.map(message => (
              <MessageRow key={message.id} message={message} />
            ))}
          </div>
        )}
      </div>

      <ChatComposer
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={handleFormSubmit}
        onKeyDown={handleKeyDown}
        disabled={isRunning}
        canSubmit={trimmed.length > 0 && !isRunning}
        placeholder="Message the agent…"
        inputTestId="agent-builder-agent-chat-input"
        submitTestId="agent-builder-agent-chat-submit"
      />
    </div>
  );
};
