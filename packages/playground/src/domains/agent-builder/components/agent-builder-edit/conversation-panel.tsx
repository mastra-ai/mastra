import { toAISdkV5Messages } from '@mastra/ai-sdk/ui';
import type { StoredSkillResponse } from '@mastra/client-js';
import type { MastraUIMessage } from '@mastra/react';
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

import type { useBuilderAgentFeatures } from '../../hooks/use-builder-agent-features';
import { ChatComposer } from '../chat-primitives/chat-composer';
import { MessageList } from '../chat-primitives/message-list';
import { useAgentBuilderTool } from './hooks/use-agent-builder-tool';
import type { AvailableWorkspace } from './hooks/use-agent-builder-tool';
import { useChatDraft } from './hooks/use-chat-draft';
import { CREATE_SKILL_TOOL_NAME, useCreateSkillTool } from './hooks/use-create-skill-tool';
import { useInitialMessage } from './hooks/use-initial-message';
import { useStreamMessages, useStreamRunning, useStreamSend } from './stream-chat-context';
import { StreamChatProvider } from './stream-chat-provider';
import type { AgentTool } from '@/domains/agent-builder/types/agent-tool';
import { useBuilderFilteredModels, useBuilderModelPolicy } from '@/domains/builder';
import { useAllModels, useLLMProviders } from '@/domains/llm';
import { useAgentMessages } from '@/hooks/use-agent-messages';

interface ConversationPanelProviderProps {
  initialUserMessage?: string;
  isFreshThread?: boolean;
  features: ReturnType<typeof useBuilderAgentFeatures>;
  availableAgentTools?: AgentTool[];
  availableWorkspaces?: AvailableWorkspace[];
  availableSkills?: StoredSkillResponse[];
  toolsReady?: boolean;
  agentId: string;
  children: ReactNode;
}

const BUILDER_AGENT_ID = 'builder-agent';
const getBuilderThreadId = (agentId: string) => `agent-builder-${agentId}`;

export const ConversationPanelProvider = ({
  initialUserMessage,
  isFreshThread = false,
  features,
  availableAgentTools = [],
  availableWorkspaces = [],
  availableSkills = [],
  toolsReady = true,
  agentId,
  children,
}: ConversationPanelProviderProps) => {
  const builderThreadId = getBuilderThreadId(agentId);
  const { data, isLoading: isConversationLoading } = useAgentMessages({
    agentId: BUILDER_AGENT_ID,
    threadId: builderThreadId,
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
  const { data: dataProviders, isLoading: areLLMProvidersLoading } = useLLMProviders();
  const llmProviders = dataProviders?.providers || [];
  const allModels = useAllModels(llmProviders);
  const modelPolicy = useBuilderModelPolicy();
  const filteredModels = useBuilderFilteredModels(allModels, modelPolicy);
  const availableModels = features.model ? filteredModels : [];
  const initialMessageToolsReady = toolsReady && (!features.model || !areLLMProvidersLoading);

  const agentBuilderTool = useAgentBuilderTool({
    features,
    availableAgentTools,
    availableWorkspaces,
    availableSkills,
    availableModels,
  });
  const createSkillTool = useCreateSkillTool({ availableWorkspaces });
  const clientTools = useMemo(
    () => (features.skills ? { agentBuilderTool, [CREATE_SKILL_TOOL_NAME]: createSkillTool } : { agentBuilderTool }),
    [agentBuilderTool, createSkillTool, features.skills],
  );

  return (
    <StreamChatProvider
      agentId={BUILDER_AGENT_ID}
      threadId={builderThreadId}
      initialMessages={v5Messages}
      clientTools={clientTools}
    >
      <ConversationInitialMessage
        initialUserMessage={initialUserMessage}
        toolsReady={initialMessageToolsReady}
        isConversationLoading={isConversationLoading}
        hasExistingConversation={hasExistingConversation}
      />
      <ConversationLoadingContext.Provider value={isConversationLoading}>
        {children}
      </ConversationLoadingContext.Provider>
    </StreamChatProvider>
  );
};

const ConversationLoadingContext = createContext<boolean>(false);

interface ConversationInitialMessageProps {
  initialUserMessage?: string;
  toolsReady: boolean;
  isConversationLoading: boolean;
  hasExistingConversation: boolean;
}

const ConversationInitialMessage = ({
  initialUserMessage,
  toolsReady,
  isConversationLoading,
  hasExistingConversation,
}: ConversationInitialMessageProps) => {
  const send = useStreamSend();

  useInitialMessage({
    initialUserMessage,
    toolsReady,
    isConversationLoading,
    hasExistingConversation,
    onSend: send,
  });

  return null;
};

export const ConversationPanelChat = () => {
  return (
    <div className="flex h-full min-h-0 flex-col px-6">
      <ConversationMessageList />
      <ConversationComposer />
    </div>
  );
};

interface ConversationPanelProps extends Omit<ConversationPanelProviderProps, 'children'> {}

/**
 * Combined provider + chat. Useful for tests and any single-pane consumer that
 * does not need to expose `isRunning` to surrounding layout slots.
 */
export const ConversationPanel = (props: ConversationPanelProps) => (
  <ConversationPanelProvider {...props}>
    <ConversationPanelChat />
  </ConversationPanelProvider>
);

const ConversationMessageList = () => {
  const messages = useStreamMessages();
  const isRunning = useStreamRunning();
  const isConversationLoading = useContext(ConversationLoadingContext);
  return (
    <MessageList
      messages={messages}
      isLoading={isConversationLoading}
      isRunning={isRunning}
      skeletonTestId="agent-builder-conversation-messages-skeleton"
    />
  );
};

const ConversationComposer = () => {
  const isRunning = useStreamRunning();
  const send = useStreamSend();
  const { draft, setDraft, trimmed, handleFormSubmit, handleKeyDown } = useChatDraft({ onSubmit: send });

  return (
    <ChatComposer
      draft={draft}
      onDraftChange={setDraft}
      onSubmit={handleFormSubmit}
      onKeyDown={handleKeyDown}
      disabled={isRunning}
      isRunning={isRunning}
      canSubmit={trimmed.length > 0 && !isRunning}
      placeholder="Tell the builder what to change…"
      inputTestId="agent-builder-conversation-input"
      submitTestId="agent-builder-conversation-submit"
      containerTestId="agent-builder-conversation-composer"
      tone="info"
    />
  );
};
