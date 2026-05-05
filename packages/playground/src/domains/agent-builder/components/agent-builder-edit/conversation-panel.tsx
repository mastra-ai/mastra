import { toAISdkV5Messages } from '@mastra/ai-sdk/ui';
import type { StoredSkillResponse } from '@mastra/client-js';
import type { MastraUIMessage } from '@mastra/react';
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import type { useBuilderAgentFeatures } from '../../hooks/use-builder-agent-features';
import { ChatComposer } from '../chat-primitives/chat-composer';
import { MessageList } from '../chat-primitives/message-list';
import { useAgentBuilderTool } from './hooks/use-agent-builder-tool';
import type { AvailableWorkspace } from './hooks/use-agent-builder-tool';
import { useChatDraft } from './hooks/use-chat-draft';
import { CONNECT_CHANNEL_TOOL_NAME, useConnectChannelTool } from './hooks/use-connect-channel-tool';
import { CREATE_SKILL_TOOL_NAME, useCreateSkillTool } from './hooks/use-create-skill-tool';
import { useStreamMessages, useStreamRunning, useStreamSend } from './stream-chat-context';
import { StreamChatProvider } from './stream-chat-provider';
import { useAgentBuilderAllowedModels } from '@/domains/agent-builder/hooks/use-agent-builder-allowed-models';
import { buildFormSnapshotInstructions } from '@/domains/agent-builder/mappers/build-form-snapshot';
import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';
import type { AgentTool } from '@/domains/agent-builder/types/agent-tool';
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
  /**
   * Whether the connectChannel client tool should be wired into chat. Mirrors the
   * gating of the "Publish to…" dropdown so the model can only trigger a connect
   * flow when a manual publish is also possible.
   */
  canPublishToChannel?: boolean;
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
  canPublishToChannel = false,
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
  const { models: filteredModels, isLoading: areLLMProvidersLoading } = useAgentBuilderAllowedModels();
  const availableModels = features.model ? filteredModels : [];
  const initialMessageToolsReady = toolsReady && (!features.model || !areLLMProvidersLoading);

  const agentBuilderTool = useAgentBuilderTool({
    features,
    availableAgentTools,
    availableWorkspaces,
    availableSkills,
    availableModels,
  });

  const { control } = useFormContext<AgentBuilderEditFormValues>();
  const formValues = useWatch({ control }) as AgentBuilderEditFormValues;
  const extraInstructions = useMemo(
    () =>
      buildFormSnapshotInstructions(formValues, {
        availableAgentTools,
        availableSkills,
        availableWorkspaces,
        availableModels,
        features,
      }),
    [formValues, availableAgentTools, availableSkills, availableWorkspaces, availableModels, features],
  );
  const createSkillTool = useCreateSkillTool({ availableWorkspaces });
  const connectChannelTool = useConnectChannelTool();
  const clientTools = useMemo(
    () => ({
      agentBuilderTool,
      ...(canPublishToChannel ? { [CONNECT_CHANNEL_TOOL_NAME]: connectChannelTool } : {}),
      ...(features.skills ? { [CREATE_SKILL_TOOL_NAME]: createSkillTool } : {}),
    }),
    [agentBuilderTool, canPublishToChannel, connectChannelTool, createSkillTool, features.skills],
  );

  const conversationContextValue = useMemo(
    () => ({ isLoading: isConversationLoading, agentId }),
    [isConversationLoading, agentId],
  );

  // Only forward the starter prompt into StreamChatProvider when it's actually
  // safe to dispatch (tools wired up, no existing convo loading, fresh thread).
  // StreamChatProvider then dispatches in a parent-level effect that runs *after*
  // useChat's `initialMessages` reset effect, which would otherwise wipe the
  // optimistic user message added by sendMessage.
  const starterMessageReady =
    initialMessageToolsReady && !isConversationLoading && !hasExistingConversation ? initialUserMessage : undefined;

  return (
    <StreamChatProvider
      agentId={BUILDER_AGENT_ID}
      threadId={builderThreadId}
      initialMessages={v5Messages}
      initialUserMessage={starterMessageReady}
      clientTools={clientTools}
      extraInstructions={extraInstructions}
    >
      <ConversationContext.Provider value={conversationContextValue}>{children}</ConversationContext.Provider>
    </StreamChatProvider>
  );
};

interface ConversationContextValue {
  isLoading: boolean;
  agentId: string;
}

const ConversationContext = createContext<ConversationContextValue>({ isLoading: false, agentId: '' });

export const ConversationPanelChat = () => {
  return (
    <div className="flex h-full min-h-0 flex-col">
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
  const { isLoading: isConversationLoading, agentId } = useContext(ConversationContext);
  return (
    <MessageList
      messages={messages}
      isLoading={isConversationLoading}
      isRunning={isRunning}
      skeletonTestId="agent-builder-conversation-messages-skeleton"
      agentId={agentId}
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
