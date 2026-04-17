import { v4 as uuid } from '@lukeed/uuid';
import {
  Button,
  Header,
  HeaderAction,
  HeaderTitle,
  Icon,
  LogoWithoutText,
  MainContentLayout,
} from '@mastra/playground-ui';
import { Pencil } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { AgentAvatar } from '@/domains/agent-studio/components/agent-avatar';
import { resolveAgentAvatar } from '@/domains/agent-studio/components/avatar';
import { resolveVisibility } from '@/domains/agent-studio/components/visibility';
import { VisibilityBadge } from '@/domains/agent-studio/components/visibility-badge';
import { useRecentAgents } from '@/domains/agent-studio/hooks/use-recent-agents';
import { AgentSidebar } from '@/domains/agents/agent-sidebar';
import { AgentChat } from '@/domains/agents/components/agent-chat';
import { AgentLayout } from '@/domains/agents/components/agent-layout';
import { ActivatedSkillsProvider } from '@/domains/agents/context/activated-skills-context';
import { AgentSettingsProvider } from '@/domains/agents/context/agent-context';
import { ObservationalMemoryProvider } from '@/domains/agents/context/agent-observational-memory-context';
import { WorkingMemoryProvider } from '@/domains/agents/context/agent-working-memory-context';
import { BrowserSessionProvider } from '@/domains/agents/context/browser-session-context';
import { BrowserToolCallsProvider } from '@/domains/agents/context/browser-tool-calls-context';
import { useAgent } from '@/domains/agents/hooks/use-agent';
import { useStoredAgent } from '@/domains/agents/hooks/use-stored-agents';
import { AuthStatus } from '@/domains/auth/components/auth-status';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { ThreadInputProvider } from '@/domains/conversation/context/ThreadInputContext';
import { useMemory, useThreads } from '@/domains/memory/hooks/use-memory';
import { TracingSettingsProvider } from '@/domains/observability/context/tracing-settings-context';
import { SchemaRequestContextProvider } from '@/domains/request-context/context/schema-request-context';
import { useLinkComponent } from '@/lib/framework';

import type { AgentSettingsType } from '@/types';

/**
 * Agent Studio chat surface. Mirrors the `/agents/:agentId/session` experience
 * (simple header, hidden model switcher, no right-hand agent-info panel) but
 * adds the memory conversation history sidebar on the left so end users can
 * navigate between threads, and an "Edit agent" button for admins.
 */
export function AgentStudioAgentChat() {
  const { agentId, threadId } = useParams<{ agentId: string; threadId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { Link } = useLinkComponent();
  const { canEdit } = usePermissions();
  const { trackAgentOpened } = useRecentAgents();

  const { data: agent, isLoading: isAgentLoading } = useAgent(agentId!);
  const { data: storedAgent } = useStoredAgent(agentId);
  const { data: memory } = useMemory(agentId!);

  const isNewThread = threadId === 'new';
  // eslint-disable-next-line react-hooks/exhaustive-deps -- threadId is intentional: we need a new UUID per thread
  const newThreadId = useMemo(() => uuid(), [threadId]);

  const hasMemory = Boolean(memory?.result);

  const {
    data: threads,
    isLoading: isThreadsLoading,
    refetch: refreshThreads,
  } = useThreads({
    resourceId: agentId!,
    agentId: agentId!,
    isMemoryEnabled: hasMemory,
  });

  useEffect(() => {
    if (agentId) trackAgentOpened(agentId);
  }, [agentId, trackAgentOpened]);

  useEffect(() => {
    if (!hasMemory) return;
    if (threadId) return;
    void navigate(`/agent-studio/agents/${agentId}/chat/new`);
  }, [hasMemory, threadId, agentId, navigate]);

  const messageId = searchParams.get('messageId') ?? undefined;

  const defaultSettings = useMemo((): AgentSettingsType => {
    if (!agent) {
      return { modelSettings: {} };
    }

    const agentDefaultOptions = agent.defaultOptions as
      | {
          maxSteps?: number;
          modelSettings?: Record<string, unknown>;
          providerOptions?: AgentSettingsType['modelSettings']['providerOptions'];
        }
      | undefined;

    const { maxOutputTokens, ...restModelSettings } = (agentDefaultOptions?.modelSettings ?? {}) as {
      maxOutputTokens?: number;
      [key: string]: unknown;
    };

    return {
      modelSettings: {
        ...(restModelSettings as AgentSettingsType['modelSettings']),
        ...(maxOutputTokens !== undefined && { maxTokens: maxOutputTokens }),
        ...(agentDefaultOptions?.maxSteps !== undefined && { maxSteps: agentDefaultOptions.maxSteps }),
        ...(agentDefaultOptions?.providerOptions !== undefined && {
          providerOptions: agentDefaultOptions.providerOptions,
        }),
      },
    };
  }, [agent]);

  if (!agentId) {
    return <Navigate to="/agent-studio/agents" replace />;
  }

  if (isAgentLoading) {
    return null;
  }

  if (!agent) {
    return <div className="text-center py-4">Agent not found</div>;
  }

  const actualThreadId = isNewThread ? newThreadId : (threadId ?? newThreadId);

  const handleRefreshThreadList = async () => {
    await refreshThreads();
    if (isNewThread) {
      void navigate(`/agent-studio/agents/${agentId}/chat/${newThreadId}`);
    }
  };

  const canEditAgent = canEdit('stored-agents');
  const newThreadUrl = `/agent-studio/agents/${agentId}/chat/new`;
  const threadUrl = (tid: string) => `/agent-studio/agents/${agentId}/chat/${tid}`;

  const avatarUrl = storedAgent ? resolveAgentAvatar(storedAgent) : undefined;
  const visibility = storedAgent?.visibility ?? resolveVisibility(storedAgent?.metadata);

  return (
    <TracingSettingsProvider entityId={agentId} entityType="agent">
      <AgentSettingsProvider agentId={agentId} defaultSettings={defaultSettings}>
        <SchemaRequestContextProvider>
          <WorkingMemoryProvider agentId={agentId} threadId={actualThreadId} resourceId={agentId}>
            <BrowserToolCallsProvider key={`browser-${agentId}-${actualThreadId}`}>
              <BrowserSessionProvider
                key={`session-${agentId}-${actualThreadId}`}
                agentId={agentId}
                threadId={actualThreadId}
              >
                <ThreadInputProvider>
                  <ObservationalMemoryProvider>
                    <ActivatedSkillsProvider key={`${agentId}-${actualThreadId}`}>
                      <MainContentLayout>
                        <Header>
                          <HeaderTitle>
                            <LogoWithoutText className="h-5 w-8 shrink-0" />
                            <AgentAvatar name={agent.name} avatarUrl={avatarUrl} size={24} />
                            {agent.name ?? 'Mastra Studio'}
                            {storedAgent && <VisibilityBadge visibility={visibility} />}
                            <AuthStatus />
                          </HeaderTitle>

                          {canEditAgent && (
                            <HeaderAction>
                              <Button as={Link} href={`/agent-studio/agents/${agentId}/edit`} variant="light" size="sm">
                                <Icon>
                                  <Pencil />
                                </Icon>
                                Edit agent
                              </Button>
                            </HeaderAction>
                          )}
                        </Header>

                        <AgentLayout
                          agentId={agentId}
                          leftSlot={
                            hasMemory && (
                              <AgentSidebar
                                agentId={agentId}
                                threadId={actualThreadId}
                                threads={threads || []}
                                isLoading={isThreadsLoading}
                                newThreadUrl={newThreadUrl}
                                threadUrl={threadUrl}
                              />
                            )
                          }
                        >
                          <AgentChat
                            key={actualThreadId}
                            agentId={agentId}
                            agentName={agent?.name}
                            modelVersion={agent?.modelVersion}
                            threadId={actualThreadId}
                            memory={hasMemory}
                            refreshThreadList={handleRefreshThreadList}
                            modelList={agent?.modelList}
                            messageId={messageId}
                            isNewThread={isNewThread}
                            hideModelSwitcher
                          />
                        </AgentLayout>
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

export default AgentStudioAgentChat;
