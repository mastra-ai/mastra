import {
  Button,
  Header,
  HeaderAction,
  HeaderTitle,
  Icon,
  MainContentLayout,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { Pencil } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { ProjectSidePanel } from '@/domains/agent-studio/components/project-side-panel';
import { useProject } from '@/domains/agent-studio/hooks/use-projects';
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
import { useMemory } from '@/domains/memory/hooks/use-memory';
import { TracingSettingsProvider } from '@/domains/observability/context/tracing-settings-context';
import { SchemaRequestContextProvider } from '@/domains/request-context/context/schema-request-context';
import { useLinkComponent } from '@/lib/framework';

import type { AgentSettingsType } from '@/types';

/**
 * Project chat surface. A project has a single fixed thread — its own
 * projectId doubles as the thread id — so there is no thread sidebar and
 * no "new thread" concept. The right slot shows the Team + Tasks panel.
 */
export function AgentStudioProjectChat() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { Link } = useLinkComponent();
  const { canEdit } = usePermissions();

  const { data: project, isLoading: isProjectLoading, error: projectError } = useProject(projectId);
  const { data: agent, isLoading: isAgentLoading } = useAgent(projectId!);
  const { data: memory } = useMemory(projectId!);

  const hasMemory = Boolean(memory?.result);

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

  // If the project isn't accessible (403/404), send the user back to the list.
  useEffect(() => {
    if (!projectError) return;
    const status =
      (projectError as { status?: number; statusCode?: number } | null)?.status ??
      (projectError as { statusCode?: number } | null)?.statusCode;
    if (is403ForbiddenError(projectError) || status === 404) {
      void navigate('/agent-studio/projects', { replace: true });
    }
  }, [projectError, navigate]);

  if (!projectId) {
    return <Navigate to="/agent-studio/projects" replace />;
  }

  if (isProjectLoading) {
    return null;
  }

  if (!project) {
    return <div className="text-center py-4">Project not found</div>;
  }

  void isAgentLoading;

  // One project, one thread. The projectId IS the thread id.
  const actualThreadId = projectId;

  const refreshThreadList = async () => {};

  const canEditProject = canEdit('stored-agents');
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
                          rightSlot={<ProjectSidePanel project={project} canEdit={canEditProject} />}
                        >
                          <AgentChat
                            key={actualThreadId}
                            agentId={projectId}
                            agentName={agent?.name ?? project.name}
                            modelVersion={agent?.modelVersion}
                            threadId={actualThreadId}
                            memory={hasMemory}
                            refreshThreadList={refreshThreadList}
                            modelList={agent?.modelList}
                            messageId={messageId}
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
