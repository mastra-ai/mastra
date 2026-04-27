import { toAISdkV5Messages } from '@mastra/ai-sdk/ui';
import { Txt } from '@mastra/playground-ui';
import { useChat } from '@mastra/react';
import type { MastraUIMessage } from '@mastra/react';
import { useMemo } from 'react';

import { ChatComposer } from '../chat-primitives/chat-composer';
import { MessageList } from '../chat-primitives/message-list';
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

  // Stable empty array per agentId: stays the same reference across re-renders
  // (preventing useChat from wiping streamed messages), but changes when agentId
  // changes (allowing useChat to reset when switching agents).
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const { draft, setDraft, trimmed, handleFormSubmit, handleKeyDown } = useChatDraft({ onSubmit: send });

  return (
    <div className="flex h-full min-h-0 flex-col px-6 pt-6">
      <MessageList
        messages={messages}
        isLoading={isConversationLoading}
        isRunning={isRunning}
        skeletonTestId="agent-builder-agent-chat-messages-skeleton"
        emptyState={
          <div
            className="flex h-full flex-col items-center justify-center gap-1 text-center"
            data-testid="agent-builder-agent-chat-empty-state"
          >
            <Txt variant="ui-md" className="text-neutral4">
              Start chatting with your agent
            </Txt>
            <Txt variant="ui-sm" className="text-neutral3">
              Your messages will appear here.
            </Txt>
          </div>
        }
      />

      <ChatComposer
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={handleFormSubmit}
        onKeyDown={handleKeyDown}
        disabled={isRunning}
        isRunning={isRunning}
        canSubmit={trimmed.length > 0 && !isRunning}
        placeholder="Message your agent…"
        inputTestId="agent-builder-agent-chat-input"
        submitTestId="agent-builder-agent-chat-submit"
      />
    </div>
  );
};
