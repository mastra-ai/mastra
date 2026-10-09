import { v4 as uuid } from '@lukeed/uuid';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { ActivatedSkillsProvider } from '@mastra/playground-ui/domains/agents/context/activated-skills-context';
import { BrowserToolCallsProvider } from '@mastra/playground-ui/domains/agents/context/browser-tool-calls-context';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { cleanProviderId } from '@mastra/playground-ui/domains/llm';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { is401UnauthorizedError, is403ForbiddenError, is404NotFoundError } from '@mastra/playground-ui/utils/errors';
import { useMastraClient } from '@mastra/react';
import { useAgent } from '@mastra/react/hooks/agents';
import { useAuthCapabilities, isAuthenticated } from '@mastra/react/hooks/auth';
import { useMemory, useThreads } from '@mastra/react/hooks/memory';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { AgentSidebar } from '@/domains/agents/agent-sidebar';
import { AgentChat } from '@/domains/agents/components/agent-chat';
import { AgentLayout } from '@/domains/agents/components/agent-layout';
import {
  AgentChatLoadingSkeleton,
  AgentLandingLoadingSkeleton,
} from '@/domains/agents/components/agent-loading-skeletons';
import { AgentUnavailable } from '@/domains/agents/components/agent-unavailable';
import { ChatThreads } from '@/domains/agents/components/chat-threads';
import { SidebarPanel } from '@/domains/agents/components/sidebar-panel';
import { ThreadsPanelShortcuts } from '@/domains/agents/components/threads-panel-shortcuts';
import { ObservationalMemoryProvider } from '@/domains/agents/context/agent-observational-memory-context';
import { WorkingMemoryProvider } from '@/domains/agents/context/agent-working-memory-context';
import { BrowserSessionProvider } from '@/domains/agents/context/browser-session-provider';
import { MemoryTimelineProvider } from '@/domains/agents/context/memory-timeline-context';
import { ThreadPreferencesProvider } from '@/domains/agents/context/thread-preferences-provider';
import { ThreadsPanelProvider } from '@/domains/agents/context/threads-panel-context';
import { useThreadsPanel } from '@/domains/agents/context/use-threads-panel';
import { buildAgentDefaultSettings } from '@/domains/agents/utils/agent-default-settings';
import { getAgentSuggestedPrompts } from '@/domains/agents/utils/agent-suggested-prompts';
import type { ThreadDraftHandle } from '@/domains/conversation/context/ThreadInputContext';
import { ThreadInputProvider } from '@/domains/conversation/context/ThreadInputContext';
import { AgentRunActions } from '@/domains/run-options/components/agent-run-actions';

function AgentThread() {
  const { agentId, threadId } = useParams();
  const client = useMastraClient();
  const { data: auth, error: authError } = useAuthCapabilities();
  const signedIn = auth && isAuthenticated(auth);
  const userId = signedIn ? auth.user.id : undefined;
  const canPersistDraft = auth?.enabled === false || Boolean(signedIn);
  const draftScope = [client.options.baseUrl, client.options.apiPrefix, userId, agentId];
  const draftKey = JSON.stringify([...draftScope, threadId ?? 'new']);
  const [searchParams] = useSearchParams();
  const {
    data: agent,
    isLoading: isAgentLoading,
    error,
  } = useAgent({
    agentId: agentId!,
    requestContext: useEntityRequestContext('agent', agentId!)[0],
    queryOptions: { enabled: Boolean(agentId) },
  });
  const { data: memory, isLoading: isMemoryLoading } = useMemory({
    agentId: agentId!,
    requestContext: useEntityRequestContext('agent', agentId!)[0],
    queryOptions: { enabled: Boolean(agentId) },
  });
  const navigate = useNavigate();
  const threadsPanel = useThreadsPanel();
  const draftHandle = useRef<ThreadDraftHandle>(null);
  const isNewThread = threadId === 'new';

  // eslint-disable-next-line react-hooks/exhaustive-deps -- threadId is intentional: we need a new UUID per thread
  const newThreadId = useMemo(() => uuid(), [threadId]);
  const newThreadKey = JSON.stringify([...draftScope, newThreadId]);
  const activeNewThread = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    activeNewThread.current = isNewThread ? newThreadKey : undefined;
    return () => {
      activeNewThread.current = undefined;
    };
  }, [isNewThread, newThreadKey]);

  const hasMemory = Boolean(memory?.result);

  const {
    data: threads,
    isLoading: isThreadsLoading,
    refetch: refreshThreads,
  } = useThreads({
    agentId: agentId!,
    isMemoryEnabled: hasMemory,
    resourceId: agentId!,
    requestContext: useEntityRequestContext('agent', agentId!)[0],
    queryOptions: { enabled: Boolean(hasMemory) },
  });

  const messageId = searchParams.get('messageId') ?? undefined;
  const suggestedPrompts = getAgentSuggestedPrompts(agent?.metadata);

  const defaultSettings = useMemo(() => buildAgentDefaultSettings(agent), [agent]);

  // 401 check - session expired, needs re-authentication
  if (error && is401UnauthorizedError(error)) {
    return <SessionExpired variant="fill" />;
  }

  // 403 check - permission denied for agents
  if (error && is403ForbiddenError(error)) {
    return <PermissionDenied variant="fill" resource="agents" />;
  }

  if (!auth && authError) {
    return (
      <EmptyState
        tone="error"
        titleSlot="Failed to check authentication"
        descriptionSlot="Reload the page to try again. Your saved drafts have not been changed."
      />
    );
  }

  if (isAgentLoading || !auth) {
    // Same layout shell as the resolved page, so the threads panel doesn't pop in and push the chat sideways.
    return (
      <AgentLayout
        agentId={agentId!}
        leftSlot={
          isNewThread && !isMemoryLoading && !hasMemory ? undefined : <ThreadsPanelLoadingShell agentId={agentId!} />
        }
        leftDrawerLabel="Threads"
      >
        {isNewThread ? <AgentLandingLoadingSkeleton /> : <AgentThreadLoadingSkeleton />}
      </AgentLayout>
    );
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
  // A first visit has nothing to list: give the landing the full width until a thread exists.
  // Without memory there is nothing else in the panel, so it is dropped entirely.
  const hideThreadsPanel = isNewThread && !hasMemory && (isThreadsLoading || !threads?.length);

  const handleRefreshThreadList = async () => {
    if (isNewThread && activeNewThread.current === newThreadKey) {
      const currentDraft = draftHandle.current;
      if (canPersistDraft) await currentDraft?.move(newThreadKey);
      if (activeNewThread.current === newThreadKey && currentDraft === draftHandle.current) {
        void navigate(`/agents/${agentId}/threads/${newThreadId}`, { replace: true });
      }
    }
    // The first thread now exists: reopen the panel if the empty landing folded it away.
    threadsPanel?.expandIfAutoCollapsed();

    await refreshThreads();
  };

  return (
    <ThreadPreferencesProvider
      agentId={agentId!}
      threadId={actualThreadId}
      defaultProvider={cleanProviderId(agent.provider ?? '')}
      defaultModel={agent.modelId ?? ''}
      defaultSettings={defaultSettings}
    >
      <WorkingMemoryProvider agentId={agentId!} threadId={actualThreadId} resourceId={agentId!}>
        <BrowserToolCallsProvider key={`browser-${agentId}-${actualThreadId}`}>
          <BrowserSessionProvider
            key={`session-${agentId}-${actualThreadId}`}
            agentId={agentId!}
            threadId={actualThreadId}
            enabled={Boolean(agent?.hasBrowser ?? agent?.browserTools?.length)}
          >
            <ThreadInputProvider
              ref={draftHandle}
              key={`${canPersistDraft}:${JSON.stringify([...draftScope, actualThreadId])}`}
              persistence={canPersistDraft ? { key: draftKey, threadId: actualThreadId } : undefined}
            >
              <ObservationalMemoryProvider>
                <MemoryTimelineProvider key={`memory-timeline-${agentId}-${actualThreadId}`}>
                  <ActivatedSkillsProvider key={`${agentId}-${actualThreadId}`}>
                    <ThreadsPanelShortcuts />
                    <AgentLayout
                      agentId={agentId!}
                      leftSlot={
                        hideThreadsPanel ? undefined : <AgentSidebar agentId={agentId!} threadId={actualThreadId} />
                      }
                      leftDrawerLabel="Threads"
                    >
                      <div key={actualThreadId} className="relative flex h-full min-h-0 flex-col">
                        <div className="relative grid min-h-0 flex-1">
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
                            runOptionsSlot={<AgentRunActions agentId={agentId!} />}
                          />
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
    </ThreadPreferencesProvider>
  );
}

// Keyed by agent so the threads panel's first-visit auto-collapse is tracked per agent.
function AgentThreadPage() {
  const { agentId } = useParams();
  return (
    <ThreadsPanelProvider key={agentId}>
      <AgentThread />
    </ThreadsPanelProvider>
  );
}

export default AgentThreadPage;

const ThreadsPanelLoadingShell = ({ agentId }: { agentId: string }) => (
  <SidebarPanel>
    <ChatThreads
      threads={[]}
      threadId=""
      onDelete={() => {}}
      resourceId={agentId}
      resourceType="agent"
      embedded
      isLoading
    />
  </SidebarPanel>
);

const AgentThreadLoadingSkeleton = () => (
  <div className="relative grid h-full overflow-y-auto pt-4" data-testid="agent-thread-skeleton" aria-busy="true">
    <AgentChatLoadingSkeleton />
  </div>
);
