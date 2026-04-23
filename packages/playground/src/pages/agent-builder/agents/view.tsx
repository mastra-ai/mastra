import { cn, IconButton } from '@mastra/playground-ui';
import { ArrowLeftIcon, Columns2, PencilIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { AgentBuilderBreadcrumb } from '@/domains/agent-builder/components/agent-builder-edit/agent-builder-breadcrumb';
import { AgentConfigurePanel } from '@/domains/agent-builder/components/agent-builder-edit/agent-configure-panel';
import { AgentPreviewChat } from '@/domains/agent-builder/components/agent-builder-edit/agent-preview-chat';
import { BrowserFrame } from '@/domains/agent-builder/components/browser-frame';
import { defaultAgentFixture } from '@/domains/agent-builder/fixtures';
import type { AgentFixture } from '@/domains/agent-builder/fixtures';
import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';
import { useStoredAgent } from '@/domains/agents/hooks/use-stored-agents';
import { useTools } from '@/domains/tools/hooks/use-all-tools';

interface AvailableTool {
  id: string;
  description?: string;
}

export default function AgentBuilderAgentView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const gridClass = expanded ? 'grid-cols-[1fr_380px]' : 'grid-cols-[1fr_0px]';
  const { data: storedAgent, isLoading: isStoredAgentLoading } = useStoredAgent(id);
  const { data: toolsData, isPending: isToolsPending } = useTools();
  const isLoading = isStoredAgentLoading || isToolsPending;

  const availableTools = useMemo<AvailableTool[]>(
    () =>
      toolsData
        ? Object.entries(toolsData).map(([toolId, tool]) => ({
            id: toolId,
            description: (tool as { description?: string }).description,
          }))
        : [],
    [toolsData],
  );

  const agent = useMemo<AgentFixture>(() => {
    if (!storedAgent) return defaultAgentFixture;
    const instructions = typeof storedAgent.instructions === 'string' ? storedAgent.instructions : '';
    return {
      ...defaultAgentFixture,
      id: storedAgent.id ?? defaultAgentFixture.id,
      name: storedAgent.name ?? defaultAgentFixture.name,
      systemPrompt: instructions || defaultAgentFixture.systemPrompt,
    };
  }, [storedAgent]);

  const formMethods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: defaultAgentFixture.name,
      instructions: defaultAgentFixture.systemPrompt,
      tools: {},
      skills: [],
    },
  });

  useEffect(() => {
    if (!storedAgent) return;
    const instructions = typeof storedAgent.instructions === 'string' ? storedAgent.instructions : '';
    const tools = Object.fromEntries(Object.keys(storedAgent.tools ?? {}).map(k => [k, true]));
    const skills = Object.keys(storedAgent.skills ?? {});
    formMethods.reset({
      name: storedAgent.name ?? '',
      instructions,
      tools,
      skills,
    });
  }, [storedAgent, formMethods]);

  return (
    <FormProvider {...formMethods}>
      <div className="flex flex-1 min-w-0 flex-col h-full bg-surface1">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-6 pt-4">
          <div className="justify-self-start">
            <IconButton
              tooltip="Agents list"
              className="rounded-full"
              onClick={() => navigate(`/agent-builder/agents`)}
            >
              <ArrowLeftIcon />
            </IconButton>
          </div>
          <AgentBuilderBreadcrumb className="justify-self-center" isLoading={isLoading} />
          <div />
        </div>
        <div className="flex flex-1 min-h-0 min-w-0 flex-col px-6 pb-6 pt-4">
          <BrowserFrame className={cn('grid relative agent-builder-panel-grid', gridClass)}>
            <div className="h-full w-full overflow-hidden grid grid-rows-[auto_1fr]">
              <div className="flex gap-2 items-center pl-6 pt-6 pr-6 justify-between">
                <div className="flex gap-2 items-center">
                  <IconButton
                    tooltip="Edit agent"
                    className="rounded-full"
                    onClick={() => navigate(`/agent-builder/agents/${id}/edit`, { viewTransition: true })}
                  >
                    <PencilIcon />
                  </IconButton>
                </div>
                {!expanded && (
                  <IconButton tooltip="Expand" className="rounded-full" onClick={() => setExpanded(true)}>
                    <Columns2 />
                  </IconButton>
                )}
              </div>

              <AgentPreviewChat agent={agent} isLoading={isLoading} />
            </div>

            <div className="h-full min-w-0 overflow-hidden" aria-hidden={!expanded}>
              <div
                className={cn(
                  'agent-builder-panel-slide h-full w-[380px] overflow-y-auto pr-6 pb-6 pt-6',
                  expanded ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0 pointer-events-none',
                )}
                style={expanded ? { viewTransitionName: 'agent-builder-configure-panel' } : undefined}
              >
                <AgentConfigurePanel
                  agent={agent}
                  onAgentChange={() => {}}
                  editable={false}
                  onClose={() => setExpanded(false)}
                  isLoading={isLoading}
                  availableTools={availableTools}
                />
              </div>
            </div>
          </BrowserFrame>
        </div>
      </div>
    </FormProvider>
  );
}
