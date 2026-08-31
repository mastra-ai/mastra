import { v4 as uuid } from '@lukeed/uuid';
import { Button } from '@mastra/playground-ui/components/Button';
import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { MainContentLayout } from '@mastra/playground-ui/components/MainContent';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { AgentSidebar } from '@/domains/agents/agent-sidebar';
import { AgentChat } from '@/domains/agents/components/agent-chat';
import { AgentLayout } from '@/domains/agents/components/agent-layout';
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

  useEffect(() => {
    if (threadId) return;

    void navigate(`/agents/${agentId}/threads/new`);
  }, [threadId, agentId, navigate]);

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
                        {/* No top header on this page: use a single full-height row instead of the default [auto_1fr]. */}
                        <MainContentLayout className="grid-rows-[1fr]">
                          <AgentLayout
                            agentId={agentId!}
                            leftDrawerLabel="Open threads"
                            leftSlot={
                              <div className="bg-surface3 border-border1/50 flex h-full min-h-0 flex-col border-r">
                                <ThreadSidebarHeader agentId={agentId!} agentName={agent.name} />
                                <div className="min-h-0 flex-1">
                                  {isThreadsLoading ? (
                                    <AgentSidebarLoadingSkeleton />
                                  ) : (
                                    <AgentSidebar
                                      agentId={agentId!}
                                      threadId={actualThreadId}
                                      threads={sidebarThreads}
                                    />
                                  )}
                                </div>
                              </div>
                            }
                          >
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
                          </AgentLayout>
                        </MainContentLayout>
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

const ThreadSidebarHeader = ({ agentId, agentName }: { agentId: string; agentName?: string }) => (
  <div className="border-border1/50 flex flex-col items-start gap-3 border-b px-4 py-4">
    <div className="text-neutral6 flex items-center gap-2 text-sm font-medium">
      <LogoWithoutText className="h-5 w-8 shrink-0" />
      Mastra
    </div>
    <Button variant="ghost" size="sm" as={Link} to={`/agents/${agentId}/overview`} data-testid="thread-sidebar-back">
      <Icon size="sm">
        <ArrowLeft />
      </Icon>
      Back to <span className="text-icon6">{agentName ?? 'agent'}</span>
    </Button>
  </div>
);

const AgentThreadLoadingSkeleton = () => (
  <MainContentLayout className="grid-rows-[1fr]">
    <div className="relative grid h-full overflow-y-auto pt-6" data-testid="agent-thread-skeleton" aria-busy="true">
      <AgentChatLoadingSkeleton />
    </div>
  </MainContentLayout>
);
