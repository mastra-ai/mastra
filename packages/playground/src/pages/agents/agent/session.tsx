import { v4 as uuid } from '@lukeed/uuid';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { TracingSettingsProvider } from '@mastra/playground-ui/domains/observability/context/tracing-settings-context';
import { is401UnauthorizedError, is403ForbiddenError, is404NotFoundError } from '@mastra/playground-ui/utils/errors';
import { useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { SessionHeader } from '@/components/session-header';
import { AgentChat } from '@/domains/agents/components/agent-chat';
import { AgentChatLoadingSkeleton } from '@/domains/agents/components/agent-loading-skeletons';
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
import { SchemaRequestContextProvider } from '@/domains/request-context/context/schema-request-context';

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
    return <SessionExpired variant="fill" />;
  }

  if (error && is403ForbiddenError(error)) {
    return <PermissionDenied variant="fill" resource="agents" />;
  }

  if (isAgentLoading) {
    return <AgentSessionLoadingSkeleton />;
  }

  // A 404 is authoritative even if a previous fetch left stale data in the cache.
  if (error && is404NotFoundError(error)) {
    return <AgentUnavailable />;
  }

  if (error) {
    return <EmptyState tone="error" titleSlot="Failed to load agent" descriptionSlot={error.message} />;
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
        <SchemaRequestContextProvider>
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
                      <PageLayout variant="fit">
                        <h1 className="sr-only">{agentId}</h1>
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
                          />
                        </div>
                      </PageLayout>
                    </ActivatedSkillsProvider>
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

export default AgentSession;

const AgentSessionLoadingSkeleton = () => (
  <PageLayout variant="fit">
    <h1 className="sr-only">Agent session</h1>
    <SessionHeader />
    <div className="relative grid h-full overflow-y-auto pt-4" data-testid="agent-session-skeleton" aria-busy="true">
      <AgentChatLoadingSkeleton />
    </div>
  </PageLayout>
);
