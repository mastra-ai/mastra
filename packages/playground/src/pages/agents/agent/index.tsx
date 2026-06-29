import { v4 as uuid } from '@lukeed/uuid';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { AgentSidebar } from '@/domains/agents/agent-sidebar';
import { AgentChat } from '@/domains/agents/components/agent-chat';
import { AgentChatShell } from '@/domains/agents/components/agent-chat-shell';
import { AgentViewLoadingSkeleton } from '@/domains/agents/components/agent-loading-skeletons';
import { AgentSettingsView } from '@/domains/agents/components/agent-settings/agent-settings-view';
import { BrowserViewPanel } from '@/domains/agents/components/browser-view';
import { ComposerRunOptions } from '@/domains/agents/components/composer-run-options';
import '@/domains/agents/components/agent-view-transition.css';
import { ActivatedSkillsProvider } from '@/domains/agents/context/activated-skills-context';
import { AgentSettingsProvider } from '@/domains/agents/context/agent-context';
import { ObservationalMemoryProvider } from '@/domains/agents/context/agent-observational-memory-context';
import { AgentSidebarViewProvider } from '@/domains/agents/context/agent-sidebar-view-context';
import { WorkingMemoryProvider } from '@/domains/agents/context/agent-working-memory-context';
import { BrowserSessionProvider } from '@/domains/agents/context/browser-session-provider';
import { BrowserToolCallsProvider } from '@/domains/agents/context/browser-tool-calls-context';
import { MemoryTimelineProvider } from '@/domains/agents/context/memory-timeline-context';
import { useAgent } from '@/domains/agents/hooks/use-agent';
import { buildAgentDefaultSettings } from '@/domains/agents/utils/agent-default-settings';
import { ThreadInputProvider } from '@/domains/conversation/context/ThreadInputContext';
import { useMemory, useThreads } from '@/domains/memory/hooks/use-memory';
import { SchemaRequestContextProvider } from '@/domains/request-context/context/schema-request-context';

// With View Transitions support the chat/settings switch is choreographed in
// agent-view-transition.css; the in-DOM enter animation would replay inside the
// captured snapshot and double the motion, so it only serves as a fallback.
const supportsViewTransitions = typeof document !== 'undefined' && 'startViewTransition' in document;

function Agent({ view = 'chat' }: { view?: 'chat' | 'settings' }) {
  const { agentId, threadId, versionId } = useParams();
  const [searchParams] = useSearchParams();
  const { data: agent, isLoading: isAgentLoading, error } = useAgent(agentId!);
  const { data: memory, isLoading: isMemoryLoading } = useMemory(agentId!);
  const navigate = useNavigate();
  const isSettingsView = view === 'settings';
  const isNewThread = threadId === 'new';
  const routeThreadId = threadId ?? 'new';

  // Generate a stable thread ID for new threads. Regenerate when threadId
  // changes (e.g., clicking "New Chat" navigates back to /threads/new).
  const newThreadId = useMemo(() => {
    void threadId;
    return uuid();
  }, [threadId]);

  const hasMemory = Boolean(memory?.result);

  const {
    data: threads,
    isLoading: isThreadsLoading,
    refetch: refreshThreads,
  } = useThreads({ agentId: agentId!, isMemoryEnabled: hasMemory, resourceId: agentId! });

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
    if (isSettingsView || threadId) return;

    // Normalize /agents/:agentId to the default thread route.
    const nextPath = versionId
      ? `/agents/${agentId}/versions/${versionId}/threads/new`
      : `/agents/${agentId}/threads/new`;
    void navigate(nextPath);
  }, [isSettingsView, threadId, agentId, versionId, navigate]);

  const messageId = searchParams.get('messageId') ?? undefined;

  const defaultSettings = useMemo(() => buildAgentDefaultSettings(agent), [agent]);
  const actualThreadId = isNewThread ? newThreadId : (threadId ?? newThreadId);
  const agentVersionId = versionId;
  const threadMetadata = useMemo(
    () =>
      agentVersionId
        ? {
            mastra: {
              agentVersionId,
            },
          }
        : undefined,
    [agentVersionId],
  );

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
    return <AgentViewLoadingSkeleton agentId={agentId!} view={view} />;
  }

  if (!agent) {
    return <div className="text-center py-4">Agent not found</div>;
  }

  if (!isSettingsView && !threadId) {
    return null;
  }

  const handleRefreshThreadList = async () => {
    await refreshThreads();

    if (isNewThread) {
      const nextPath = agentVersionId
        ? `/agents/${agentId}/versions/${agentVersionId}/threads/${newThreadId}`
        : `/agents/${agentId}/threads/${newThreadId}`;
      void navigate(nextPath);
    }
  };

  return (
    <AgentSidebarViewProvider>
      <AgentSettingsProvider agentId={agentId!} defaultSettings={defaultSettings}>
        <SchemaRequestContextProvider>
          <WorkingMemoryProvider agentId={agentId!} threadId={actualThreadId!} resourceId={agentId!}>
            <BrowserToolCallsProvider key={`browser-${agentId}-${actualThreadId}`}>
              <BrowserSessionProvider
                key={`session-${agentId}-${actualThreadId}`}
                agentId={agentId!}
                threadId={actualThreadId!}
                enabled={Boolean(agent?.browserTools?.length)}
              >
                <ThreadInputProvider>
                  <ObservationalMemoryProvider>
                    <MemoryTimelineProvider key={`memory-timeline-${agentId}-${actualThreadId}`}>
                      <ActivatedSkillsProvider key={`${agentId}-${actualThreadId}`}>
                        <AgentChatShell
                          agentId={agentId!}
                          view={view}
                          agentVersionId={agentVersionId}
                          threadId={routeThreadId}
                          leftDrawerLabel="Open threads and memory"
                          leftSlot={
                            <AgentSidebar
                              agentId={agentId!}
                              threadId={actualThreadId!}
                              routeThreadId={routeThreadId}
                              agentVersionId={agentVersionId}
                              threads={sidebarThreads}
                              isLoading={isMemoryLoading || isThreadsLoading}
                              memoryType={memory?.memoryType}
                              hasMemory={hasMemory}
                              isMemoryLoading={isMemoryLoading}
                            />
                          }
                          browserOverlay={<BrowserViewPanel />}
                        >
                          <div
                            key={view}
                            className={
                              supportsViewTransitions
                                ? 'min-h-0 overflow-hidden'
                                : 'agent-view-enter min-h-0 overflow-hidden'
                            }
                          >
                            {isSettingsView ? (
                              <AgentSettingsView agentId={agentId!} />
                            ) : (
                              <AgentChat
                                key={actualThreadId!}
                                agentId={agentId!}
                                agentName={agent?.name}
                                modelVersion={agent?.modelVersion}
                                agentVersionId={agentVersionId}
                                threadMetadata={threadMetadata}
                                supportsMemory={agent?.supportsMemory}
                                threadId={actualThreadId!}
                                memory={hasMemory}
                                refreshThreadList={handleRefreshThreadList}
                                modelList={agent?.modelList}
                                messageId={messageId}
                                isNewThread={isNewThread}
                                runOptionsSlot={
                                  <ComposerRunOptions requestContextSchema={agent?.requestContextSchema} />
                                }
                              />
                            )}
                          </div>
                        </AgentChatShell>
                      </ActivatedSkillsProvider>
                    </MemoryTimelineProvider>
                  </ObservationalMemoryProvider>
                </ThreadInputProvider>
              </BrowserSessionProvider>
            </BrowserToolCallsProvider>
          </WorkingMemoryProvider>
        </SchemaRequestContextProvider>
      </AgentSettingsProvider>
    </AgentSidebarViewProvider>
  );
}

export default Agent;
