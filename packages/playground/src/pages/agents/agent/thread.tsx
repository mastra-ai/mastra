import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import type { ChatProps } from '@mastra/playground-ui/domains/agents/chat';
import {
  AgentThreadPage as SharedAgentThreadPage,
  ThreadsPanelContext,
  ThreadsPanelProvider,
  useAgentThreadPage,
  useThreadsPanel,
} from '@mastra/playground-ui/domains/agents/chat';
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
import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { AgentUnavailable } from '@/domains/agents/components/agent-unavailable';
import { MemorySidebar } from '@/domains/agents/components/memory-sidebar/memory-sidebar';
import { RenameThreadDialog } from '@/domains/agents/components/rename-thread-dialog';
import { ThreadsPanelShortcuts } from '@/domains/agents/components/threads-panel-shortcuts';
import { ObservationalMemoryProvider } from '@/domains/agents/context/agent-observational-memory-context';
import { WorkingMemoryProvider } from '@/domains/agents/context/agent-working-memory-context';
import { BrowserSessionProvider } from '@/domains/agents/context/browser-session-provider';
import { MemoryTimelineProvider, useMemoryTimeline } from '@/domains/agents/context/memory-timeline-context';
import { ThreadPreferencesProvider } from '@/domains/agents/context/thread-preferences-provider';
import { buildAgentDefaultSettings } from '@/domains/agents/utils/agent-default-settings';
import { getAgentSuggestedPrompts } from '@/domains/agents/utils/agent-suggested-prompts';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { AgentRunActions } from '@/domains/run-options/components/agent-run-actions';
import { StudioRuntimeFeatures } from '@/lib/ai-ui/chat/chat-provider';
import { StudioComposerFeatures } from '@/lib/ai-ui/thread';

function AgentThread() {
  const { agentId, threadId } = useParams();
  const client = useMastraClient();
  const { data: auth, error: authError } = useAuthCapabilities();
  const signedIn = auth && isAuthenticated(auth);
  const userId = signedIn ? auth.user.id : undefined;
  const canPersistDraft = auth?.enabled === false || Boolean(signedIn);
  const [requestContext] = useEntityRequestContext('agent', agentId!);
  const [searchParams] = useSearchParams();
  const {
    data: agent,
    isLoading: isAgentLoading,
    error,
  } = useAgent({
    agentId: agentId!,
    requestContext,
    queryOptions: { enabled: Boolean(agentId) },
  });
  const navigate = useNavigate();
  const threadsPanel = useThreadsPanel();
  const state = useAgentThreadPage({
    agentId: agentId!,
    resourceId: agentId!,
    threadId,
    requestContext,
    draftScope: [client.options.baseUrl, client.options.apiPrefix, userId, agentId!],
    canPersistDraft,
    navigateToThread: id => void navigate(`/agents/${agentId}/threads/${id}`, { replace: true }),
    navigateToNewThread: () => void navigate(`/agents/${agentId}/threads/new`),
    expandThreadsPanel: threadsPanel?.expandIfAutoCollapsed,
  });
  const defaultSettings = useMemo(() => buildAgentDefaultSettings(agent), [agent]);

  if (error && is401UnauthorizedError(error)) return <SessionExpired variant="fill" />;
  if (error && is403ForbiddenError(error)) return <PermissionDenied variant="fill" resource="agents" />;
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
    return (
      <SharedAgentThreadPage
        agentId={agentId!}
        state={state}
        canPersistDraft={canPersistDraft}
        isLoading
        chat={{}}
        threadListFeatures={{ onHidePanel: threadsPanel?.collapse, onCollapseEmpty: threadsPanel?.collapseOnce }}
        layoutBehavior={{ registerThreadsPanel: threadsPanel?.registerPanel }}
      />
    );
  }
  if (error && is404NotFoundError(error)) return <AgentUnavailable />;
  if (error) return <EmptyState tone="error" titleSlot="Failed to load agent" descriptionSlot={error.message} />;
  if (!agent) return <AgentUnavailable />;

  return (
    <ThreadPreferencesProvider
      agentId={agentId!}
      threadId={state.actualThreadId}
      defaultProvider={cleanProviderId(agent.provider ?? '')}
      defaultModel={agent.modelId ?? ''}
      defaultSettings={defaultSettings}
    >
      <WorkingMemoryProvider agentId={agentId!} threadId={state.actualThreadId} resourceId={agentId!}>
        <BrowserToolCallsProvider key={`browser-${agentId}-${state.actualThreadId}`}>
          <BrowserSessionProvider
            key={`session-${agentId}-${state.actualThreadId}`}
            agentId={agentId}
            threadId={state.actualThreadId}
            enabled={Boolean(agent.hasBrowser ?? agent.browserTools?.length)}
          >
            <ObservationalMemoryProvider>
              <MemoryTimelineProvider key={`memory-timeline-${agentId}-${state.actualThreadId}`}>
                <ActivatedSkillsProvider key={`${agentId}-${state.actualThreadId}`}>
                  <StudioThreadPage
                    agentId={agentId!}
                    state={state}
                    canPersistDraft={canPersistDraft}
                    agentName={agent.name}
                    modelVersion={agent.modelVersion}
                    supportsMemory={agent.supportsMemory}
                    modelList={agent.modelList}
                    suggestedPrompts={getAgentSuggestedPrompts(agent.metadata)}
                    requestContext={requestContext}
                    messageId={searchParams.get('messageId') ?? undefined}
                  />
                </ActivatedSkillsProvider>
              </MemoryTimelineProvider>
            </ObservationalMemoryProvider>
          </BrowserSessionProvider>
        </BrowserToolCallsProvider>
      </WorkingMemoryProvider>
    </ThreadPreferencesProvider>
  );
}

function StudioThreadPage({
  agentId,
  state,
  canPersistDraft,
  agentName,
  modelVersion,
  supportsMemory,
  modelList,
  suggestedPrompts,
  requestContext,
  messageId,
}: {
  agentId: string;
  state: ReturnType<typeof useAgentThreadPage>;
  canPersistDraft: boolean;
  agentName: string;
  modelVersion?: ChatProps['modelVersion'];
  supportsMemory?: ChatProps['supportsMemory'];
  modelList?: ChatProps['modelList'];
  suggestedPrompts?: string[];
  requestContext: Record<string, unknown>;
  messageId?: string;
}) {
  const threadsPanel = useThreadsPanel();
  const { isPanelOpen } = useMemoryTimeline();
  const { canDelete, canEdit } = usePermissions();
  return (
    <ThreadsPanelContext.Provider value={threadsPanel}>
      <ThreadsPanelShortcuts />
      <SharedAgentThreadPage
        agentId={agentId}
        state={state}
        canPersistDraft={canPersistDraft}
        layoutBehavior={{ isMemoryTimelineOpen: isPanelOpen }}
        threadListFeatures={{
          canDeleteThread: canDelete('memory'),
          canRenameThread: canEdit('memory'),
          renderRenameDialog: (thread, onClose) => (
            <RenameThreadDialog
              agentId={agentId}
              threadId={thread.id}
              initialTitle={thread.title ?? ''}
              onOpenChange={open => {
                if (!open) onClose();
              }}
            />
          ),
        }}
        renderSidebar={threadList => (
          <MemorySidebar
            agentId={agentId}
            threadId={state.actualThreadId}
            threadsSlot={state.hasMemory ? threadList : undefined}
            isThreadsLoading={state.isThreadsLoading}
          />
        )}
        chat={{
          agentName,
          modelVersion,
          supportsMemory,
          modelList,
          messageId,
          suggestedPrompts,
          requestContext,
          runOptionsSlot: <AgentRunActions agentId={agentId} />,
          RuntimeFeatures: StudioRuntimeFeatures,
          ComposerFeatures: StudioComposerFeatures,
        }}
      />
    </ThreadsPanelContext.Provider>
  );
}

// Keep the one-shot empty-panel collapse scoped to each agent.
function AgentThreadPage() {
  const { agentId } = useParams();
  return (
    <ThreadsPanelProvider key={agentId}>
      <AgentThread />
    </ThreadsPanelProvider>
  );
}

export default AgentThreadPage;
