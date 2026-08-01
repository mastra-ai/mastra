import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { CircleCheckIcon, LightbulbIcon, ListChecksIcon, WrenchIcon } from 'lucide-react';
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

import { useStreamMessages, useStreamRunning, useStreamSend } from '../../contexts/stream-chat-context';
import { StreamChatProvider } from '../../contexts/stream-chat-provider';
import { useChatDraft } from '../../hooks/use-chat-draft';
import { ChatComposer } from '../chat-primitives/chat-composer';
import { MessageList } from '../chat-primitives/message-list';
import { BrowserThumbnail } from '@/domains/agents/components/browser-view';
import { useBrowserSession } from '@/domains/agents/context/browser-session-context';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';
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

const EMPTY_MESSAGES: never[] = [];

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
  const { data: currentUser } = useCurrentUser();
  const threadId = currentUser?.id ? `${currentUser.id}-${agentId}` : agentId;

  const { data, isLoading: isConversationLoading } = useAgentMessages({
    agentId,
    threadId,
    memory: true,
  });

  const storedMessages = data?.messages ?? EMPTY_MESSAGES;

  const meta = useMemo<AgentChatMeta>(
    () => ({ isConversationLoading, agentName, agentDescription, agentAvatarUrl }),
    [isConversationLoading, agentName, agentDescription, agentAvatarUrl],
  );

  return (
    <StreamChatProvider key={threadId} agentId={agentId} threadId={threadId} initialMessages={storedMessages}>
      <AgentChatMetaContext.Provider value={meta}>{children}</AgentChatMetaContext.Provider>
    </StreamChatProvider>
  );
};

interface AgentChatPanelChatProps {
  /** When true, renders the browser thumbnail above the composer */
  hasBrowser?: boolean;
}

export const AgentChatPanelChat = ({ hasBrowser = false }: AgentChatPanelChatProps) => {
  const isRunning = useStreamRunning();
  const send = useStreamSend();
  const { draft, setDraft, trimmed, handleFormSubmit, handleKeyDown } = useChatDraft({ onSubmit: send });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AgentChatMessageList onStarterPromptSelect={setDraft} />
      {hasBrowser && <BrowserThumbnailSlot />}
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
      />
    </div>
  );
};

/** Shows the browser thumbnail when a session is active and not in modal mode */
const BrowserThumbnailSlot = () => {
  const { hasSession, viewMode } = useBrowserSession();
  if (!hasSession || viewMode === 'modal') return null;
  return (
    <div className="mx-auto mb-2 w-full max-w-3xl">
      <BrowserThumbnail />
    </div>
  );
};

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
          className="flex flex-col items-center gap-6 py-6 text-center lg:h-full lg:justify-center lg:py-0"
          data-testid="agent-builder-agent-chat-empty-state"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="starter-chip" style={{ animationDelay: '0ms', viewTransitionName: 'agent-avatar' }}>
              <Avatar name={agentName ?? 'Agent'} src={agentAvatarUrl} size="lg" />
            </div>
            <div className="starter-chip" style={{ animationDelay: '150ms' }}>
              <Txt variant="ui-lg" className="text-neutral6 font-semibold" style={{ viewTransitionName: 'agent-name' }}>
                {agentName ?? 'your agent'}
              </Txt>
            </div>
            {agentDescription ? (
              <div className="starter-chip" style={{ animationDelay: '220ms' }}>
                <Txt
                  variant="ui-sm"
                  className="text-neutral4 max-w-[40ch]"
                  style={{ viewTransitionName: 'agent-description' }}
                >
                  {agentDescription}
                </Txt>
              </div>
            ) : null}
          </div>

          <div className="grid w-full max-w-2xl grid-cols-1 gap-5 sm:grid-cols-2">
            {STARTER_PROMPTS.map((starterPrompt, index) => (
              <button
                key={starterPrompt.title}
                type="button"
                onClick={() => onStarterPromptSelect(starterPrompt.prompt)}
                data-testid={`agent-builder-agent-chat-starter-${starterPrompt.title.toLowerCase().replace(/\s+/g, '-')}`}
                style={{ animationDelay: `${280 + index * 40}ms` }}
                className="starter-chip group border-border1 bg-surface2 duration-normal ease-out-custom hover:border-border2 hover:bg-surface3 focus-visible:ring-accent1 flex gap-3 rounded-3xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <span className="bg-surface3 text-neutral4 group-hover:text-neutral6 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md transition-colors">
                  <starterPrompt.Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <Txt
                    variant="ui-sm"
                    className="text-neutral6 group-hover:text-neutral6 font-medium transition-colors"
                  >
                    {starterPrompt.title}
                  </Txt>
                  <Txt variant="ui-xs" className="text-neutral4 group-hover:text-neutral5 mt-1 transition-colors">
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
