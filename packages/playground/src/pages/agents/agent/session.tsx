import { v4 as uuid } from '@lukeed/uuid';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { MainContentLayout } from '@mastra/playground-ui/components/MainContent';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { RequestContextProvider } from '@mastra/playground-ui/domains/request-context';
import { is401UnauthorizedError, is403ForbiddenError, is404NotFoundError } from '@mastra/playground-ui/utils/errors';
import { useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { SessionHeader } from '@/components/session-header';
import { AgentChat } from '@/domains/agents/components/agent-chat';
import { AgentChatLoadingSkeleton } from '@/domains/agents/components/agent-loading-skeletons';
import { AgentRunOptions } from '@/domains/agents/components/agent-run-options';
import { AgentUnavailable } from '@/domains/agents/components/agent-unavailable';
import { ActivatedSkillsProvider } from '@/domains/agents/context/activated-skills-context';
import { AgentSettingsProvider } from '@/domains/agents/context/agent-context';
import { ObservationalMemoryProvider } from '@/domains/agents/context/agent-observational-memory-context';
import { WorkingMemoryProvider } from '@/domains/agents/context/agent-working-memory-context';
import { BrowserSessionProvider } from '@/domains/agents/context/browser-session-provider';
import { BrowserToolCallsProvider } from '@/domains/agents/context/browser-tool-calls-context';
import { useAgent } from '@/domains/agents/hooks/use-agent';
import { buildAgentDefaultSettings } from '@/domains/agents/utils/agent-default-settings';
import { ThreadInputProvider } from '@/domains/conversation/context/ThreadInputContext';
import { useMemory, useThreads } from '@/domains/memory/hooks/use-memory';
import { TracingSettingsProvider } from '@/domains/observability/context/tracing-settings-context';

function AgentSession() {
  const { agentId, threadId } = useParams();
  const [searchParams] = useSearchParams();
  const { data: agent, isLoading: isAgentLoading, error } = useAgent(agentId!);
  const { data: memory } = useMemory(agentId!);
  const navigate = useNavigate();
  const isNewThread = threadId === 'new';

  // eslint-disable-next-line react-hooks/exhaustive-deps -- threadId is intentional: we need a new UUID per thread
  const newThreadId = useMemo(() => uuid(), [threadId]);

  const hasMemory = Boolean(memory?.result);

  const { refetch: refreshThreads } = useThreads({
    resourceId: agentId!,
    agentId: agentId!,
    isMemoryEnabled: hasMemory,
  });

  useEffect(() => {
    if (!hasMemory) return;
    if (threadId) return;

    void navigate(`/agents/${agentId}/session/new`);
  }, [hasMemory, threadId, agentId, navigate]);

  const messageId = searchParams.get('messageId') ?? undefined;

  const defaultSettings = useMemo(() => buildAgentDefaultSettings(agent), [agent]);

  if (error && is401UnauthorizedError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <SessionExpired />
      </div>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <PermissionDenied resource="agents" />
      </div>
    );
  }

  if (isAgentLoading) {
    return <AgentSessionLoadingSkeleton />;
  }

  // A 404 is authoritative even if a previous fetch left stale data in the cache.
  if (error && is404NotFoundError(error)) {
    return <AgentUnavailable />;
  }

  if (error) {
    return <ErrorState title="Failed to load agent" message={error.message} />;
  }

  if (!agent) {
    return <AgentUnavailable />;
  }

  const actualThreadId = isNewThread ? newThreadId : (threadId ?? newThreadId);

  const handleRefreshThreadList = async () => {
    await refreshThreads();

    if (isNewThread) {
      void navigate(`/agents/${agentId}/session/${newThreadId}`);
    }
  };

  return (
    <TracingSettingsProvider entityId={agentId!} entityType="agent">
      <AgentSettingsProvider agentId={agentId!} defaultSettings={defaultSettings}>
        <RequestContextProvider key={agentId} entityKey={`agent:${agentId}`}>
          <WorkingMemoryProvider agentId={agentId!} threadId={actualThreadId} resourceId={agentId!}>
            <BrowserToolCallsProvider key={`browser-${agentId}-${actualThreadId}`}>
              <BrowserSessionProvider
                key={`session-${agentId}-${actualThreadId}`}
                agentId={agentId!}
                threadId={actualThreadId}
                enabled={Boolean(agent?.hasBrowser ?? agent?.browserTools?.length)}
              >
                <ThreadInputProvider>
                  <ObservationalMemoryProvider>
                    <ActivatedSkillsProvider>
                      <MainContentLayout>
                        <SessionHeader />
                        <div className="relative grid h-full min-h-0">
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
                            isNewThread={isNewThread}
                            hideModelSwitcher
                            runOptionsSlot={
                              <AgentRunOptions
                                triggerVariant="icon"
                                requestContextSchema={agent?.requestContextSchema}
                              />
                            }
                          />
                        </div>
                      </MainContentLayout>
                    </ActivatedSkillsProvider>
                  </ObservationalMemoryProvider>
                </ThreadInputProvider>
              </BrowserSessionProvider>
            </BrowserToolCallsProvider>
          </WorkingMemoryProvider>
        </RequestContextProvider>
      </AgentSettingsProvider>
    </TracingSettingsProvider>
  );
}

export default AgentSession;

const AgentSessionLoadingSkeleton = () => (
  <MainContentLayout>
    <SessionHeader />
    <div className="relative grid h-full overflow-y-auto pt-4" data-testid="agent-session-skeleton" aria-busy="true">
      <AgentChatLoadingSkeleton />
    </div>
  </MainContentLayout>
);
