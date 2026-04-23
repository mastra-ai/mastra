import { Button, cn, IconButton } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { ArrowLeftIcon, Columns2, EyeIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useBuilderAgentFeatures } from '@/domains/agent-builder';
import { AgentBuilderBreadcrumb } from '@/domains/agent-builder/components/agent-builder-edit/agent-builder-breadcrumb';
import { EditableAgentConfigurePanel } from '@/domains/agent-builder/components/agent-builder-edit/agent-configure-panel';
import { AgentPreviewChat } from '@/domains/agent-builder/components/agent-builder-edit/agent-preview-chat';
import { ConversationPanel } from '@/domains/agent-builder/components/agent-builder-edit/conversation-panel';
import { BrowserFrame } from '@/domains/agent-builder/components/browser-frame';
import { defaultAgentFixture } from '@/domains/agent-builder/fixtures';
import type { AgentFixture } from '@/domains/agent-builder/fixtures';
import { useSaveAgent } from '@/domains/agent-builder/hooks/use-save-agent';
import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';
import { useTools } from '@/domains/tools/hooks/use-all-tools';

interface AvailableTool {
  id: string;
  description?: string;
}

type LocationState = { userMessage?: string } | null;

export default function AgentBuilderAgentEdit() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const formMethods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: '',
      instructions: '',
      tools: {},
      skills: [],
    },
  });
  const state = (location.state as LocationState) ?? null;
  const [agent, setAgent] = useState<AgentFixture>(defaultAgentFixture);
  const features = useBuilderAgentFeatures();
  const { data: toolsData, isPending } = useTools();

  const availableTools = useMemo<AvailableTool[]>(
    () =>
      toolsData
        ? Object.entries(toolsData).map(([id, tool]) => ({
            id,
            description: (tool as { description?: string }).description,
          }))
        : [],
    [toolsData],
  );

  const { save, isSaving } = useSaveAgent({ agentId: id!, availableTools });
  const handleSaveSuccess = async (values: AgentBuilderEditFormValues) => {
    await save(values);
    void navigate(`/agent-builder/agents`, { viewTransition: true });
  };
  const handleSave = formMethods.handleSubmit(handleSaveSuccess);

  const [expanded, setExpanded] = useState(true);
  const navigate = useNavigate();

  const gridClass = expanded ? 'grid-cols-[1fr_380px]' : 'grid-cols-[1fr_0px]';

  return (
    <FormProvider {...formMethods}>
      <div className="flex flex-col h-full bg-surface1">
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
          <AgentBuilderBreadcrumb className="justify-self-center" />
          <div className="justify-self-end">
            <Button variant="primary" onClick={handleSave} disabled={isSaving} data-testid="agent-builder-edit-save">
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="flex w-[40ch] shrink-0 flex-col bg-surface1 pt-4 pb-6 px-6">
            <MastraReactProvider baseUrl="http://localhost:4112">
              <ConversationPanel
                initialUserMessage={state?.userMessage}
                features={features}
                availableTools={availableTools}
                toolsReady={!isPending}
              />
            </MastraReactProvider>
          </div>
          <div className="flex flex-1 min-w-0 flex-col pt-4 pb-6 pr-6">
            <BrowserFrame className={cn('grid relative agent-builder-panel-grid', gridClass)}>
              <div className="h-full w-full overflow-hidden grid grid-rows-[auto_1fr]">
                <div className="flex gap-2 items-center pl-6 pt-6 pr-6 justify-between">
                  <IconButton
                    tooltip="View agent"
                    className="rounded-full"
                    onClick={() => navigate(`/agent-builder/agents/${id}/view`, { viewTransition: true })}
                  >
                    <EyeIcon />
                  </IconButton>

                  {!expanded && (
                    <IconButton tooltip="Expand" className="rounded-full" onClick={() => setExpanded(true)}>
                      <Columns2 />
                    </IconButton>
                  )}
                </div>

                <AgentPreviewChat agent={agent} />
              </div>

              <div className="h-full min-w-0 overflow-hidden" aria-hidden={!expanded}>
                <div
                  className={cn(
                    'agent-builder-panel-slide h-full w-[380px] overflow-y-auto pr-6 pb-6 pt-6',
                    expanded ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0 pointer-events-none',
                  )}
                  style={expanded ? { viewTransitionName: 'agent-builder-configure-panel' } : undefined}
                >
                  <EditableAgentConfigurePanel
                    agent={agent}
                    onAgentChange={setAgent}
                    onClose={() => setExpanded(false)}
                    availableTools={availableTools}
                  />
                </div>
              </div>
            </BrowserFrame>
          </div>
        </div>
      </div>
    </FormProvider>
  );
}
