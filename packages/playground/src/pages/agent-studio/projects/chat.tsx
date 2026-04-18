import { v4 as uuid } from '@lukeed/uuid';
import { Button, Header, HeaderAction, HeaderTitle, Icon, MainContentLayout } from '@mastra/playground-ui';
import { Pencil } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { ProjectTasksPanel } from '@/domains/agent-studio/components/project-tasks-panel';
import { useProject } from '@/domains/agent-studio/hooks/use-projects';
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
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { ThreadInputProvider } from '@/domains/conversation/context/ThreadInputContext';
import { useMemory, useThreads } from '@/domains/memory/hooks/use-memory';
import { TracingSettingsProvider } from '@/domains/observability/context/tracing-settings-context';
import { SchemaRequestContextProvider } from '@/domains/request-context/context/schema-request-context';
import { useLinkComponent } from '@/lib/framework';

import type { AgentSettingsType } from '@/types';

/**
 * Project chat surface. The project is persisted as a supervisor stored agent,
 * so we chat with it through the normal agent chat stack. The left slot holds
 * the memory thread list; the right slot holds the live task panel.
 */
export function AgentStudioProjectChat() {
  const { projectId, threadId } = useParams<{ projectId: string; threadId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { Link } = useLinkComponent();
  const { canEdit } = usePermissions();

  const { data: project, isLoading: isProjectLoading } = useProject(projectId);
  const { data: agent, isLoading: isAgentLoading } = useAgent(projectId!);
  const { data: memory } = useMemory(projectId!);

  const isNewThread = threadId === 'new';
  // eslint-disable-next-line react-hooks/exhaustive-deps -- threadId is intentional: we need a new UUID per thread
  const newThreadId = useMemo(() => uuid(), [threadId]);

  const hasMemory = Boolean(memory?.result);

  const {
    data: threads,
    isLoading: isThreadsLoading,
    refetch: refreshThreads,
  } = useThreads({
    resourceId: projectId!,
    agentId: projectId!,
    isMemoryEnabled: hasMemory,
  });

  useEffect(() => {
    if (!hasMemory) return;
    if (threadId) return;
    void navigate(`/agent-studio/projects/${projectId}/chat/new`);
  }, [hasMemory, threadId, projectId, navigate]);

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

  if (!projectId) {
    return <Navigate to="/agent-studio/projects" replace />;
  }

  if (isProjectLoading) {
    return null;
  }

  if (!project) {
    return <div className="text-center py-4">Project not found</div>;
  }

  // useAgent may 404 if the project isn't yet surfaced in the runtime — the
  // chat still works via the agent routes keyed by stored-agent id.
  void isAgentLoading;

  const actualThreadId = isNewThread ? newThreadId : (threadId ?? newThreadId);

  const handleRefreshThreadList = async () => {
    await refreshThreads();
    if (isNewThread) {
      void navigate(`/agent-studio/projects/${projectId}/chat/${newThreadId}`);
    }
  };

  const canEditProject = canEdit('stored-agents');
  const newThreadUrl = `/agent-studio/projects/${projectId}/chat/new`;
  const threadUrl = (tid: string) => `/agent-studio/projects/${projectId}/chat/${tid}`;
  const teamSize = project.project?.invitedAgentIds?.length ?? 0;

  return (
    <TracingSettingsProvider entityId={projectId} entityType="agent">
      <AgentSettingsProvider agentId={projectId} defaultSettings={defaultSettings}>
        <SchemaRequestContextProvider>
          <WorkingMemoryProvider agentId={projectId} threadId={actualThreadId} resourceId={projectId}>
            <BrowserToolCallsProvider key={`browser-${projectId}-${actualThreadId}`}>
              <BrowserSessionProvider
                key={`session-${projectId}-${actualThreadId}`}
                agentId={projectId}
                threadId={actualThreadId}
              >
                <ThreadInputProvider>
                  <ObservationalMemoryProvider>
                    <ActivatedSkillsProvider key={`${projectId}-${actualThreadId}`}>
                      <MainContentLayout>
                        <Header>
                          <HeaderTitle>
                            {project.name ?? 'Project'}
                            <span className="text-xs text-icon3 ml-2">
                              {teamSize} agent{teamSize === 1 ? '' : 's'}
                            </span>
                          </HeaderTitle>

                          {canEditProject && (
                            <HeaderAction>
                              <Button
                                as={Link}
                                href={`/agent-studio/projects/${projectId}/edit`}
                                variant="light"
                                size="sm"
                              >
                                <Icon>
                                  <Pencil />
                                </Icon>
                                Edit project
                              </Button>
                            </HeaderAction>
                          )}
                        </Header>

                        <AgentLayout
                          agentId={projectId}
                          leftSlot={
                            hasMemory && (
                              <AgentSidebar
                                agentId={projectId}
                                threadId={actualThreadId}
                                threads={threads || []}
                                isLoading={isThreadsLoading}
                                newThreadUrl={newThreadUrl}
                                threadUrl={threadUrl}
                              />
                            )
                          }
                          rightSlot={<ProjectTasksPanel project={project} />}
                        >
                          <AgentChat
                            key={actualThreadId}
                            agentId={projectId}
                            agentName={agent?.name ?? project.name}
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

export default AgentStudioProjectChat;
