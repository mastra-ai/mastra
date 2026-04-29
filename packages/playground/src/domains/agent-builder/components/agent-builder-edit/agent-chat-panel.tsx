import { toAISdkV5Messages } from '@mastra/ai-sdk/ui';
import { Avatar, Txt } from '@mastra/playground-ui';
import type { MastraUIMessage } from '@mastra/react';
import { CircleCheckIcon, LightbulbIcon, ListChecksIcon, WrenchIcon } from 'lucide-react';
import { createContext, useContext, useMemo } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';

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
  agentAvatarUrl?: string;
  children: ReactNode;
}

interface AgentChatMeta {
  isConversationLoading: boolean;
  agentName?: string;
  agentDescription?: string;
  agentAvatarUrl?: string;
}

const AgentChatMetaContext = createContext<AgentChatMeta>({ isConversationLoading: false });

const STARTER_PROMPTS = [
  {
    title: 'What can you do?',
    description: 'Get an overview of capabilities',
    prompt: 'What can you do? Give me a quick overview of your capabilities.',
    Icon: ListChecksIcon,
  },
  {
    title: 'Show available tools',
    description: 'See what this agent can call',
    prompt: 'Show me the available tools you can call and explain when you would use each one.',
    Icon: WrenchIcon,
  },
  {
    title: 'Suggest a task',
    description: 'Get an example prompt to try',
    prompt: 'Suggest a useful task I can try with you, including an example prompt.',
    Icon: LightbulbIcon,
  },
  {
    title: 'Run a self-check',
    description: 'Verify tools are reachable',
    prompt: 'Run a self-check and verify whether your tools are reachable. Tell me what works and what does not.',
    Icon: CircleCheckIcon,
  },
];

export const AgentChatPanelProvider = ({
  agentId,
  agentName,
  agentDescription,
  agentAvatarUrl,
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
    () => ({ isConversationLoading, agentName, agentDescription, agentAvatarUrl }),
    [isConversationLoading, agentName, agentDescription, agentAvatarUrl],
  );

  return (
    <StreamChatProvider agentId={agentId} threadId={agentId} initialMessages={v5Messages}>
      <AgentChatMetaContext.Provider value={meta}>{children}</AgentChatMetaContext.Provider>
    </StreamChatProvider>
  );
};

export const AgentChatPanelChat = () => {
  const isRunning = useStreamRunning();
  const send = useStreamSend();
  const { draft, setDraft, trimmed, handleFormSubmit, handleKeyDown } = useChatDraft({ onSubmit: send });

  return (
    <div className="flex h-full min-h-0 flex-col px-6">
      <AgentChatMessageList onStarterPromptSelect={setDraft} />
      <AgentChatComposer
        draft={draft}
        setDraft={setDraft}
        trimmed={trimmed}
        handleFormSubmit={handleFormSubmit}
        handleKeyDown={handleKeyDown}
        isRunning={isRunning}
      />
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

interface AgentChatMessageListProps {
  onStarterPromptSelect: (prompt: string) => void;
}

const AgentChatMessageList = ({ onStarterPromptSelect }: AgentChatMessageListProps) => {
  const messages = useStreamMessages();
  const isRunning = useStreamRunning();
  const { isConversationLoading, agentName, agentDescription, agentAvatarUrl } = useContext(AgentChatMetaContext);

  return (
    <MessageList
      messages={messages}
      isLoading={isConversationLoading}
      isRunning={isRunning}
      skeletonTestId="agent-builder-agent-chat-messages-skeleton"
      emptyState={
        <div
          className="flex h-full flex-col items-center justify-center gap-6 text-center"
          data-testid="agent-builder-agent-chat-empty-state"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="starter-chip" style={{ animationDelay: '0ms' }}>
              <Avatar name={agentName ?? 'Agent'} src={agentAvatarUrl} size="lg" />
            </div>
            <div className="starter-chip" style={{ animationDelay: '150ms' }}>
              <Txt variant="ui-lg" className="text-neutral6 font-semibold">
                {agentName ?? 'your agent'}
              </Txt>
            </div>
            {agentDescription ? (
              <div className="starter-chip" style={{ animationDelay: '220ms' }}>
                <Txt variant="ui-sm" className="text-neutral4 max-w-[40ch]">
                  {agentDescription}
                </Txt>
              </div>
            ) : null}
          </div>

          <div className="grid w-full max-w-2xl grid-cols-2 gap-5">
            {STARTER_PROMPTS.map((starterPrompt, index) => (
              <button
                key={starterPrompt.title}
                type="button"
                onClick={() => onStarterPromptSelect(starterPrompt.prompt)}
                data-testid={`agent-builder-agent-chat-starter-${starterPrompt.title.toLowerCase().replace(/\s+/g, '-')}`}
                style={{ animationDelay: `${280 + index * 40}ms` }}
                className="starter-chip group flex gap-3 rounded-lg border border-border1 bg-surface2 p-4 text-left transition-colors duration-normal ease-out-custom hover:border-border2 hover:bg-surface3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent1"
              >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-surface3 text-neutral4 transition-colors group-hover:text-neutral6">
                  <starterPrompt.Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <Txt variant="ui-sm" className="text-neutral6 font-medium transition-colors group-hover:text-neutral6">
                    {starterPrompt.title}
                  </Txt>
                  <Txt variant="ui-xs" className="mt-1 text-neutral4 transition-colors group-hover:text-neutral5">
                    {starterPrompt.description}
                  </Txt>
                </span>
              </button>
            ))}
          </div>
        </div>
      }
    />
  );
};

interface AgentChatComposerProps {
  draft: string;
  setDraft: (value: string) => void;
  trimmed: string;
  handleFormSubmit: (e: FormEvent<HTMLFormElement>) => void;
  handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  isRunning: boolean;
}

const AgentChatComposer = ({
  draft,
  setDraft,
  trimmed,
  handleFormSubmit,
  handleKeyDown,
  isRunning,
}: AgentChatComposerProps) => {
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
      containerTestId="agent-builder-agent-chat-composer"
      tone="success"
    />
  );
};
