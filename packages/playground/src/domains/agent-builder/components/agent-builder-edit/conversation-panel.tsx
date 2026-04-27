import { toAISdkV5Messages } from '@mastra/ai-sdk/ui';

import { useChat } from '@mastra/react';
import type { MastraUIMessage } from '@mastra/react';
import { useMemo } from 'react';

import type { useBuilderAgentFeatures } from '../../hooks/use-builder-agent-features';
import { ChatComposer } from '../chat-primitives/chat-composer';
import { MessageList } from '../chat-primitives/message-list';
import { useAgentBuilderTool } from './hooks/use-agent-builder-tool';
import type { AvailableWorkspace } from './hooks/use-agent-builder-tool';
import { useChatDraft } from './hooks/use-chat-draft';
import { useInitialMessage } from './hooks/use-initial-message';
import type { AgentTool } from '@/domains/agent-builder/types/agent-tool';
import { useAgentMessages } from '@/hooks/use-agent-messages';

interface ConversationPanelProps {
  initialUserMessage?: string;
  isFreshThread?: boolean;
  features: ReturnType<typeof useBuilderAgentFeatures>;
  availableAgentTools?: AgentTool[];
  availableWorkspaces?: AvailableWorkspace[];
  toolsReady?: boolean;
  agentId: string;
}

const BUILDER_AGENT_ID = 'builder-agent';

export const ConversationPanel = ({
  initialUserMessage,
  isFreshThread = false,
  features,
  availableAgentTools = [],
  availableWorkspaces = [],
  toolsReady = true,
  agentId,
}: ConversationPanelProps) => {
  const { data, isLoading: isConversationLoading } = useAgentMessages({
    agentId: BUILDER_AGENT_ID,
    threadId: agentId,
    memory: !isFreshThread,
  });

  // Stable empty array per agentId: stays the same reference across re-renders
  // (preventing useChat from wiping streamed messages), but changes when agentId
  // changes (allowing useChat to reset when switching agents).
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const agentBuilderTool = useAgentBuilderTool({ features, availableAgentTools, availableWorkspaces });

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
  const { draft, setDraft, trimmed, handleFormSubmit, handleKeyDown } = useChatDraft({ onSubmit: send });

  return (
    <div className="flex h-full min-h-0 flex-col px-6 pt-6">
      <MessageList
        messages={chatMessages}
        isLoading={isConversationLoading}
        skeletonTestId="agent-builder-conversation-messages-skeleton"
      />

      <ChatComposer
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={handleFormSubmit}
        onKeyDown={handleKeyDown}
        disabled={isRunning}
        canSubmit={trimmed.length > 0 && !isRunning}
        placeholder="Tell the builder what to change…"
        inputTestId="agent-builder-conversation-input"
        submitTestId="agent-builder-conversation-submit"
        viewTransitionName="agent-builder-prompt"
      />
    </div>
  );
};
