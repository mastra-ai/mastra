import { v4 as uuid } from '@lukeed/uuid';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError, is404NotFoundError } from '@mastra/playground-ui/utils/errors';
import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
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
import { ThreadViewByTrace } from '@/domains/traces/components/thread-view-by-trace';

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
  // A new thread has no traces yet, so the advanced (trace-based) view falls back to the chat.
  const isAdvancedVariant = searchParams.get('variant') === 'advanced' && !isNewThread;
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

  // A 404 is authoritative even if a previous fetch left stale data in the cache.
  if (error && is404NotFoundError(error)) {
    return <div className="py-4 text-center">Agent not found</div>;
  }

  if (error) {
    return <ErrorState title="Failed to load agent" message={error.message} />;
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
    <AgentSettingsProvider agentId={agentId!} defaultSettings={defaultSettings}>
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
                <MemoryTimelineProvider key={`memory-timeline-${agentId}-${actualThreadId}`}>
                  <ActivatedSkillsProvider key={`${agentId}-${actualThreadId}`}>
                    <AgentLayout
                      agentId={agentId!}
                      leftSlot={
                        isThreadsLoading ? (
                          <AgentSidebarLoadingSkeleton />
                        ) : (
                          <AgentSidebar agentId={agentId!} threadId={actualThreadId} threads={sidebarThreads} />
                        )
                      }
                      leftDrawerLabel="Threads"
                    >
                      <div key={actualThreadId} className="relative flex h-full min-h-0 flex-col">
                        <div className="relative grid min-h-0 flex-1">
                          {isAdvancedVariant ? (
                            <ThreadViewByTrace threadId={actualThreadId} />
                          ) : (
                            <AgentChat
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
                          )}
                        </div>
                      </div>
                    </AgentLayout>
                  </ActivatedSkillsProvider>
                </MemoryTimelineProvider>
              </ObservationalMemoryProvider>
            </ThreadInputProvider>
          </BrowserSessionProvider>
        </BrowserToolCallsProvider>
      </WorkingMemoryProvider>
    </AgentSettingsProvider>
  );
}

export default AgentThread;

const AgentThreadLoadingSkeleton = () => (
  <div className="relative grid h-full overflow-y-auto pt-6" data-testid="agent-thread-skeleton" aria-busy="true">
    <AgentChatLoadingSkeleton />
  </div>
);
