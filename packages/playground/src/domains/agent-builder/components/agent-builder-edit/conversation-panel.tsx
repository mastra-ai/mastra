import { toAISdkV5Messages } from '@mastra/ai-sdk/ui';
import { useChat } from '@mastra/react';
import type { MastraUIMessage } from '@mastra/react';
import { useMemo } from 'react';

import type { useBuilderAgentFeatures } from '../../hooks/use-builder-agent-features';
import { ChatComposer } from '../chat-primitives/chat-composer';
import { MessageRow, MessagesSkeleton } from '../chat-primitives/messages';
import { useAgentBuilderTool } from './hooks/use-agent-builder-tool';
import type { AvailableTool, AvailableWorkspace } from './hooks/use-agent-builder-tool';
import { useAutoScroll } from './hooks/use-auto-scroll';
import { useChatDraft } from './hooks/use-chat-draft';
import { useInitialMessage } from './hooks/use-initial-message';
import { useAgentMessages } from '@/hooks/use-agent-messages';

interface ConversationPanelProps {
  initialUserMessage?: string;
  features: ReturnType<typeof useBuilderAgentFeatures>;
  availableTools?: AvailableTool[];
  availableWorkspaces?: AvailableWorkspace[];
  toolsReady?: boolean;
  agentId: string;
}

const BUILDER_AGENT_ID = 'builder-agent';

export const ConversationPanel = ({
  initialUserMessage,
  features,
  availableTools = [],
  availableWorkspaces = [],
  toolsReady = true,
  agentId,
}: ConversationPanelProps) => {
  const { data, isLoading: isConversationLoading } = useAgentMessages({
    agentId: BUILDER_AGENT_ID,
    threadId: agentId,
    memory: true,
  });

  // Stable empty array per agentId: stays the same reference across re-renders
  // (preventing useChat from wiping streamed messages), but changes when agentId
  // changes (allowing useChat to reset when switching agents).
  const emptyMessages = useMemo(() => [] as never[], [agentId]);
  const storedMessages = data?.messages ?? emptyMessages;
  const v5Messages = useMemo(() => toAISdkV5Messages(storedMessages) as MastraUIMessage[], [storedMessages]);
  const hasExistingConversation = (data?.messages?.length ?? 0) > 0;

  const {
    messages: chatMessages,
    sendMessage,
    isRunning,
  } = useChat({
    agentId: BUILDER_AGENT_ID,
    initialMessages: v5Messages,
  });

  const agentBuilderTool = useAgentBuilderTool({ features, availableTools, availableWorkspaces });

  const send = (message: string) => {
    void sendMessage({ message, threadId: agentId, clientTools: { agentBuilderTool } });
  };

  useInitialMessage({
    initialUserMessage,
    toolsReady,
    isConversationLoading,
    hasExistingConversation,
    onSend: send,
  });
  const scrollRef = useAutoScroll(chatMessages);
  const { draft, setDraft, trimmed, handleFormSubmit, handleKeyDown } = useChatDraft({ onSubmit: send });

  return (
    <div className="flex h-full min-h-0 flex-col px-6 pt-6">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto pb-4">
        {isConversationLoading && chatMessages.length === 0 ? (
          <MessagesSkeleton testId="agent-builder-conversation-messages-skeleton" />
        ) : (
          <div className="flex flex-col gap-6">
            {chatMessages.map(message => (
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
        placeholder="Ask a follow-up…"
        inputTestId="agent-builder-conversation-input"
        submitTestId="agent-builder-conversation-submit"
        viewTransitionName="agent-builder-prompt"
      />
    </div>
  );
};
