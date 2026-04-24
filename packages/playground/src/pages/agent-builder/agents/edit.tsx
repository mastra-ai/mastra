import { IconButton } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { EyeIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useBuilderAgentFeatures } from '@/domains/agent-builder';
import { EditableAgentConfigurePanel } from '@/domains/agent-builder/components/agent-builder-edit/agent-configure-panel';
import { ConversationPanel } from '@/domains/agent-builder/components/agent-builder-edit/conversation-panel';
import { WorkspaceLayout } from '@/domains/agent-builder/components/agent-builder-edit/workspace-layout';
import { defaultAgentFixture } from '@/domains/agent-builder/fixtures';
import type { AgentFixture } from '@/domains/agent-builder/fixtures';
import { useSaveAgent } from '@/domains/agent-builder/hooks/use-save-agent';
import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';
import type { StoredAgent } from '@/domains/agents/hooks/use-stored-agents';
import { useStoredAgent } from '@/domains/agents/hooks/use-stored-agents';
import { useTools } from '@/domains/tools/hooks/use-all-tools';

interface AvailableTool {
  id: string;
  description?: string;
}

type ToolsData = NonNullable<ReturnType<typeof useTools>['data']>;

type LocationState = { userMessage?: string } | null;

export default function AgentBuilderAgentEdit() {
  const { id } = useParams<{ id: string }>();
  const { data: storedAgent, isLoading: isStoredAgentLoading } = useStoredAgent(id);
  const { data: toolsData, isPending: isToolsPending } = useTools();
  const isReady = Boolean(id) && !isStoredAgentLoading && !isToolsPending;

  return (
    <AgentBuilderAgentEditPage
      key={isReady ? 'ready' : 'loading'}
      id={id}
      storedAgent={storedAgent}
      toolsData={toolsData}
      isReady={isReady}
    />
  );
}

interface PageProps {
  id: string | undefined;
  storedAgent: StoredAgent | null | undefined;
  toolsData: ToolsData | undefined;
  isReady: boolean;
}

const AgentBuilderAgentEditPage = ({ id, storedAgent, toolsData, isReady }: PageProps) => {
  const formMethods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: storedAgent?.name ?? '',
      instructions: typeof storedAgent?.instructions === 'string' ? storedAgent.instructions : '',
      tools: Object.fromEntries(Object.keys(storedAgent?.tools ?? {}).map(k => [k, true])),
      skills: Object.keys(storedAgent?.skills ?? {}),
    },
  });

  return (
    <FormProvider {...formMethods}>
      {!isReady || !id ? (
        <AgentBuilderAgentEditSkeleton />
      ) : (
        <AgentBuilderAgentEditReady id={id} storedAgent={storedAgent} toolsData={toolsData ?? {}} />
      )}
    </FormProvider>
  );
};

const AgentBuilderAgentEditSkeleton = () => (
  <WorkspaceLayout
    isLoading
    chat={null}
    configure={
      <EditableAgentConfigurePanel
        agent={defaultAgentFixture}
        onAgentChange={() => {}}
        availableTools={[]}
        onSave={() => {}}
        isSaving={false}
        isLoading
      />
    }
  />
);

interface AgentBuilderAgentEditReadyProps {
  id: string;
  storedAgent: StoredAgent | null | undefined;
  toolsData: ToolsData;
}

const AgentBuilderAgentEditReady = ({ id, storedAgent, toolsData }: AgentBuilderAgentEditReadyProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const features = useBuilderAgentFeatures();
  const state = (location.state as LocationState) ?? null;
  const formMethods = useFormContext<AgentBuilderEditFormValues>();

  const availableTools = useMemo<AvailableTool[]>(
    () =>
      Object.entries(toolsData).map(([toolId, tool]) => ({
        id: toolId,
        description: (tool as { description?: string }).description,
      })),
    [toolsData],
  );

  const [agent, setAgent] = useState<AgentFixture>(defaultAgentFixture);

  const mode: 'create' | 'edit' = storedAgent ? 'edit' : 'create';
  const { save, isSaving } = useSaveAgent({ agentId: id, mode, availableTools });

  const handleSaveSuccess = async (values: AgentBuilderEditFormValues) => {
    await save(values);
    void navigate(`/agent-builder/agents`, { viewTransition: true });
  };
  const handleSave = formMethods.handleSubmit(handleSaveSuccess);

  return (
    <WorkspaceLayout
      isLoading={false}
      defaultExpanded
      toolbarAction={
        <IconButton
          tooltip="View agent"
          className="rounded-full"
          onClick={() => navigate(`/agent-builder/agents/${id}/view`, { viewTransition: true })}
        >
          <EyeIcon />
        </IconButton>
      }
      chat={
        <MastraReactProvider baseUrl="http://localhost:4112">
          <ConversationPanel
            initialUserMessage={state?.userMessage}
            features={features}
            availableTools={availableTools}
            toolsReady
            agentId={id}
          />
        </MastraReactProvider>
      }
      configure={
        <EditableAgentConfigurePanel
          agent={agent}
          onAgentChange={setAgent}
          availableTools={availableTools}
          onSave={handleSave}
          isSaving={isSaving}
          isLoading={false}
        />
      }
    />
  );
};
