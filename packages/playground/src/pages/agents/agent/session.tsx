import { v4 as uuid } from '@lukeed/uuid';
import { MainContentLayout } from '@mastra/playground-ui/components/MainContent';
import { useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { SessionHeader } from '@/components/session-header';
import { AgentChat } from '@/domains/agents/components/agent-chat';
import { AgentChatLoadingSkeleton } from '@/domains/agents/components/agent-loading-skeletons';
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
import { SchemaRequestContextProvider } from '@/domains/request-context/context/schema-request-context';

function AgentSession() {
  const { agentId, threadId } = useParams();
  const [searchParams] = useSearchParams();
  const { data: agent, isLoading: isAgentLoading } = useAgent(agentId!);
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

  if (isAgentLoading) {
    return <AgentSessionLoadingSkeleton />;
  }

  if (!agent) {
    return <div className="text-center py-4">Agent not found</div>;
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
                enabled={Boolean(agent?.browserTools?.length)}
              >
                <ThreadInputProvider>
                  <ObservationalMemoryProvider>
                    <ActivatedSkillsProvider>
                      <MainContentLayout>
                        <SessionHeader />
                        <div className="grid overflow-y-auto relative h-full pt-6">
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
                      </MainContentLayout>
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
  <MainContentLayout>
    <SessionHeader />
    <div className="grid overflow-y-auto relative h-full pt-6" data-testid="agent-session-skeleton" aria-busy="true">
      <AgentChatLoadingSkeleton />
    </div>
  </MainContentLayout>
);
