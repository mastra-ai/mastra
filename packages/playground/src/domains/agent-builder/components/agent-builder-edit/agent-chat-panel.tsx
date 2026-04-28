import { toAISdkV5Messages } from '@mastra/ai-sdk/ui';
import { Avatar, Txt } from '@mastra/playground-ui';
import type { MastraUIMessage } from '@mastra/react';
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

import { ChatComposer } from '../chat-primitives/chat-composer';
import { MessageList } from '../chat-primitives/message-list';
import { useChatDraft } from './hooks/use-chat-draft';
import { useStreamMessages, useStreamRunning, useStreamSend } from './stream-chat-context';
import { StreamChatProvider } from './stream-chat-provider';
import { useAgentMessages } from '@/hooks/use-agent-messages';

interface AgentChatPanelProviderProps {
  agentId: string;
  agentName?: string;
  agentDescription?: string;
  children: ReactNode;
}

interface AgentChatMeta {
  isConversationLoading: boolean;
  agentName?: string;
  agentDescription?: string;
}

const AgentChatMetaContext = createContext<AgentChatMeta>({ isConversationLoading: false });

export const AgentChatPanelProvider = ({
  agentId,
  agentName,
  agentDescription,
  children,
}: AgentChatPanelProviderProps) => {
  const { data, isLoading: isConversationLoading } = useAgentMessages({
    agentId,
    threadId: agentId,
    memory: true,
  });

  // Stable empty array per agentId.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const emptyMessages = useMemo(() => [] as never[], [agentId]);
  const storedMessages = data?.messages ?? emptyMessages;
  const v5Messages = useMemo(() => toAISdkV5Messages(storedMessages) as MastraUIMessage[], [storedMessages]);

  const meta = useMemo<AgentChatMeta>(
    () => ({ isConversationLoading, agentName, agentDescription }),
    [isConversationLoading, agentName, agentDescription],
  );

  return (
    <StreamChatProvider agentId={agentId} threadId={agentId} initialMessages={v5Messages}>
      <AgentChatMetaContext.Provider value={meta}>{children}</AgentChatMetaContext.Provider>
    </StreamChatProvider>
  );
};

export const AgentChatPanelChat = () => {
  return (
    <div className="flex h-full min-h-0 flex-col px-6">
      <AgentChatMessageList />
      <AgentChatComposer />
    </div>
  );
};

interface AgentChatPanelProps extends Omit<AgentChatPanelProviderProps, 'children'> {}

/**
 * Combined provider + chat. Useful for tests and any single-pane consumer that
 * does not need to expose `isRunning` to surrounding layout slots.
 */
export const AgentChatPanel = (props: AgentChatPanelProps) => (
  <AgentChatPanelProvider {...props}>
    <AgentChatPanelChat />
  </AgentChatPanelProvider>
);

const AgentChatMessageList = () => {
  const messages = useStreamMessages();
  const isRunning = useStreamRunning();
  const { isConversationLoading, agentName, agentDescription } = useContext(AgentChatMetaContext);

  return (
    <MessageList
      messages={messages}
      isLoading={isConversationLoading}
      isRunning={isRunning}
      skeletonTestId="agent-builder-agent-chat-messages-skeleton"
      emptyState={
        <div
          className="flex h-full flex-col items-center justify-center gap-3 text-center"
          data-testid="agent-builder-agent-chat-empty-state"
        >
          <div className="starter-chip" style={{ animationDelay: '0ms' }}>
            <Avatar name={agentName ?? 'Agent'} size="lg" />
          </div>
          <div className="starter-chip" style={{ animationDelay: '150ms' }}>
            <Txt variant="ui-md" className="text-neutral6 font-medium">
              {agentName ?? 'your agent'}
            </Txt>
          </div>
          {agentDescription ? (
            <div className="starter-chip" style={{ animationDelay: '300ms' }}>
              <Txt variant="ui-sm" className="text-neutral4 max-w-[40ch]">
                {agentDescription}
              </Txt>
            </div>
          ) : null}
        </div>
      }
    />
  );
};

const AgentChatComposer = () => {
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
      placeholder="Message your agent…"
      inputTestId="agent-builder-agent-chat-input"
      submitTestId="agent-builder-agent-chat-submit"
      viewTransitionName="agent-builder-prompt"
    />
  );
};
