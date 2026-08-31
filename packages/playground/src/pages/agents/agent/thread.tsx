import { v4 as uuid } from '@lukeed/uuid';
import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { MainContentLayout } from '@mastra/playground-ui/components/MainContent';
import { MainSidebar, MainSidebarProvider, useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { ArrowLeft, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { AgentChat } from '@/domains/agents/components/agent-chat';
import {
  AgentChatLoadingSkeleton,
  AgentSidebarLoadingSkeleton,
} from '@/domains/agents/components/agent-loading-skeletons';
import { ActivatedSkillsProvider } from '@/domains/agents/context/activated-skills-context';
import { AgentSettingsProvider } from '@/domains/agents/context/agent-context';
import { ObservationalMemoryProvider } from '@/domains/agents/context/agent-observational-memory-context';
import { WorkingMemoryProvider } from '@/domains/agents/context/agent-working-memory-context';
import { BrowserSessionProvider } from '@/domains/agents/context/browser-session-provider';
import { BrowserToolCallsProvider } from '@/domains/agents/context/browser-tool-calls-context';
import { MemoryTimelineProvider } from '@/domains/agents/context/memory-timeline-context';
import { useAgent } from '@/domains/agents/hooks/use-agent';
import { buildAgentDefaultSettings } from '@/domains/agents/utils/agent-default-settings';
import { getAgentSuggestedPrompts } from '@/domains/agents/utils/agent-suggested-prompts';
import { ThreadInputProvider } from '@/domains/conversation/context/ThreadInputContext';
import { useMemory, useThreads } from '@/domains/memory/hooks/use-memory';
import { TracingSettingsProvider } from '@/domains/observability/context/tracing-settings-context';
import { SchemaRequestContextProvider } from '@/domains/request-context/context/schema-request-context';
import { useLinkComponent } from '@/lib/framework';

function AgentThread() {
  const { agentId, threadId } = useParams();
  const [searchParams] = useSearchParams();
  const { data: agent, isLoading: isAgentLoading, error } = useAgent(agentId!);
  const { data: memory } = useMemory(agentId!);
  const navigate = useNavigate();
  const isNewThread = threadId === 'new';

  // eslint-disable-next-line react-hooks/exhaustive-deps -- threadId is intentional: we need a new UUID per thread
  const newThreadId = useMemo(() => uuid(), [threadId]);

  const hasMemory = Boolean(memory?.result);

  const {
    data: threads,
    isLoading: isThreadsLoading,
    refetch: refreshThreads,
  } = useThreads({
    agentId: agentId!,
    isMemoryEnabled: hasMemory,
    resourceId: agentId!,
  });

  const sidebarThreads = useMemo(
    () =>
      (threads || []).map(thread => ({
        ...thread,
        createdAt: new Date(thread.createdAt),
        updatedAt: new Date(thread.updatedAt),
      })),
    [threads],
  );

  const messageId = searchParams.get('messageId') ?? undefined;
  const suggestedPrompts = getAgentSuggestedPrompts(agent?.metadata);

  const defaultSettings = useMemo(() => buildAgentDefaultSettings(agent), [agent]);

  // 401 check - session expired, needs re-authentication
  if (error && is401UnauthorizedError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <SessionExpired />
      </div>
    );
  }

  // 403 check - permission denied for agents
  if (error && is403ForbiddenError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <PermissionDenied resource="agents" />
      </div>
    );
  }

  if (isAgentLoading) {
    return <AgentThreadLoadingSkeleton />;
  }

  if (!agent) {
    return <div className="py-4 text-center">Agent not found</div>;
  }

  const actualThreadId = isNewThread ? newThreadId : (threadId ?? newThreadId);

  const handleRefreshThreadList = async () => {
    await refreshThreads();

    if (isNewThread) {
      void navigate(`/agents/${agentId}/threads/${newThreadId}`);
    }
  };

  return (
    <TracingSettingsProvider entityId={agentId!} entityType="agent">
      <AgentSettingsProvider agentId={agentId!} defaultSettings={defaultSettings}>
        <SchemaRequestContextProvider>
          <WorkingMemoryProvider agentId={agentId!} threadId={actualThreadId} resourceId={agentId!}>
            <BrowserToolCallsProvider key={`browser-${agentId}-${actualThreadId}`}>
              <BrowserSessionProvider
                key={`session-${agentId}-${actualThreadId}`}
                agentId={agentId!}
                threadId={actualThreadId}
                enabled={Boolean(agent?.browserTools?.length)}
              >
                <ThreadInputProvider>
                  <ObservationalMemoryProvider>
                    <MemoryTimelineProvider key={`memory-timeline-${agentId}-${actualThreadId}`}>
                      <ActivatedSkillsProvider key={`${agentId}-${actualThreadId}`}>
                        <MainSidebarProvider storageKey="agent-thread">
                          <div className="bg-surface1 h-full lg:grid lg:grid-cols-[auto_1fr] lg:grid-rows-[1fr]">
                            <ThreadSidebar
                              agentId={agentId!}
                              agentName={agent.name}
                              threads={sidebarThreads}
                              threadId={actualThreadId}
                              isLoading={isThreadsLoading}
                            />
                            <div className="flex h-full min-h-0 flex-col">
                              <div className="rounded-studio-frame border-border1 bg-surface2 shadow-main-frame m-1.5 min-h-0 flex-1 overflow-y-auto border [--studio-frame-inset:0.5rem] [--studio-frame-radius:1.5rem] lg:m-2 lg:ml-0">
                                <div className="relative grid h-full min-h-0 overflow-y-auto pt-6">
                                  <AgentChat
                                    key={actualThreadId}
                                    agentId={agentId!}
                                    agentName={agent?.name}
                                    modelVersion={agent?.modelVersion}
                                    supportsMemory={agent?.supportsMemory}
                                    threadId={actualThreadId}
                                    memory={hasMemory}
                                    refreshThreadList={handleRefreshThreadList}
                                    modelList={agent?.modelList}
                                    messageId={messageId}
                                    suggestedPrompts={suggestedPrompts}
                                    isNewThread={isNewThread}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </MainSidebarProvider>
                      </ActivatedSkillsProvider>
                    </MemoryTimelineProvider>
                  </ObservationalMemoryProvider>
                </ThreadInputProvider>
              </BrowserSessionProvider>
            </BrowserToolCallsProvider>
          </WorkingMemoryProvider>
        </SchemaRequestContextProvider>
      </AgentSettingsProvider>
    </TracingSettingsProvider>
  );
}

export default AgentThread;

interface ThreadSidebarProps {
  agentId: string;
  agentName?: string;
  threads: Array<{ id: string; title?: string; createdAt: Date }>;
  threadId: string;
  isLoading: boolean;
}

const ThreadSidebar = ({ agentId, agentName, threads, threadId, isLoading }: ThreadSidebarProps) => {
  const { Link } = useLinkComponent();
  const { state } = useMainSidebar();

  return (
    <MainSidebar>
      <div className="mb-1.5 pt-2.5">
        <span className="flex h-7 items-center gap-2 pr-2 pl-3">
          <LogoWithoutText className="h-[1.5rem] w-[1.5rem] shrink-0" />
          <span className="font-display truncate text-sm font-semibold tracking-tight whitespace-nowrap">
            Mastra Studio
          </span>
        </span>
      </div>

      <div className="mb-1">
        <MainSidebar.NavList>
          <MainSidebar.NavLink state={state} asChild>
            <Link href={`/agents/${agentId}/overview`} data-testid="thread-sidebar-back">
              <ArrowLeft />
              <MainSidebar.NavLabel state={state}>Back to {agentName ?? 'agent'}</MainSidebar.NavLabel>
            </Link>
          </MainSidebar.NavLink>
          <MainSidebar.NavLink state={state} asChild>
            <Link href={`/agents/${agentId}/threads/new`} data-testid="thread-sidebar-new-chat">
              <Plus />
              <MainSidebar.NavLabel state={state}>New Chat</MainSidebar.NavLabel>
            </Link>
          </MainSidebar.NavLink>
        </MainSidebar.NavList>
      </div>

      <MainSidebar.Nav>
        <MainSidebar.NavSection>
          <MainSidebar.NavHeader state={state}>Threads</MainSidebar.NavHeader>
          {isLoading ? (
            <AgentSidebarLoadingSkeleton />
          ) : (
            <MainSidebar.NavList>
              {threads.map(thread => (
                <MainSidebar.NavLink
                  key={thread.id}
                  LinkComponent={Link}
                  state={state}
                  isActive={thread.id === threadId}
                  link={{ name: threadDisplayName(thread), url: `/agents/${agentId}/threads/${thread.id}` }}
                />
              ))}
            </MainSidebar.NavList>
          )}
        </MainSidebar.NavSection>
      </MainSidebar.Nav>
    </MainSidebar>
  );
};

const DEFAULT_THREAD_NAME = /^New Thread \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function threadDisplayName(thread: { id: string; title?: string; createdAt: Date }): string {
  if (thread.title && !DEFAULT_THREAD_NAME.test(thread.title)) return thread.title;
  return new Date(thread.createdAt)
    .toLocaleString('en-us', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    })
    .replace(',', ' at');
}

const AgentThreadLoadingSkeleton = () => (
  <MainContentLayout className="grid-rows-[1fr]">
    <div className="relative grid h-full overflow-y-auto pt-6" data-testid="agent-thread-skeleton" aria-busy="true">
      <AgentChatLoadingSkeleton />
    </div>
  </MainContentLayout>
);
