import { Button, IconButton, Spinner } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { MessageSquareIcon, SaveIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { useBuilderAgentFeatures } from '@/domains/agent-builder';
import { AgentConfigurePanel } from '@/domains/agent-builder/components/agent-builder-edit/agent-configure-panel';
import type { ActiveDetail } from '@/domains/agent-builder/components/agent-builder-edit/agent-configure-panel';
import { ConversationPanel } from '@/domains/agent-builder/components/agent-builder-edit/conversation-panel';
import type { AvailableWorkspace } from '@/domains/agent-builder/components/agent-builder-edit/hooks/use-agent-builder-tool';
import { useStarterUserMessage } from '@/domains/agent-builder/components/agent-builder-edit/hooks/use-starter-user-message';
import { WorkspaceLayout } from '@/domains/agent-builder/components/agent-builder-edit/workspace-layout';
import { useAvailableAgentTools } from '@/domains/agent-builder/hooks/use-available-agent-tools';
import { useSaveAgent } from '@/domains/agent-builder/hooks/use-save-agent';
import { storedAgentToFormValues } from '@/domains/agent-builder/mappers/stored-agent-to-form-values';
import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import type { StoredAgent } from '@/domains/agents/hooks/use-stored-agents';
import { useStoredAgent } from '@/domains/agents/hooks/use-stored-agents';
import { useStoredSkills } from '@/domains/agents/hooks/use-stored-skills';
import { useTools } from '@/domains/tools/hooks/use-all-tools';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';
import { useWorkspaces } from '@/domains/workspace/hooks';

type ToolsData = NonNullable<ReturnType<typeof useTools>['data']>;
type AgentsData = NonNullable<ReturnType<typeof useAgents>['data']>;
type WorkflowsData = NonNullable<ReturnType<typeof useWorkflows>['data']>;

export default function AgentBuilderAgentEdit() {
  const { id } = useParams<{ id: string }>();
  const features = useBuilderAgentFeatures();
  const initialUserMessage = useStarterUserMessage();
  const fromStarter = initialUserMessage !== undefined;
  const { data: storedAgent, isLoading: isStoredAgentLoading } = useStoredAgent(id, { enabled: !fromStarter });
  const { data: toolsData, isPending: isToolsPending } = useTools();
  const { data: agentsData, isPending: isAgentsPending } = useAgents({ enabled: features.agents });
  const { data: workflowsData, isPending: isWorkflowsPending } = useWorkflows({ enabled: features.workflows });
  const { isPending: isSkillsPending } = useStoredSkills({ enabled: features.skills });
  const { data: workspacesData } = useWorkspaces();
  const isReady =
    Boolean(id) &&
    (fromStarter || !isStoredAgentLoading) &&
    !isToolsPending &&
    (!features.agents || !isAgentsPending) &&
    (!features.workflows || !isWorkflowsPending) &&
    (!features.skills || !isSkillsPending);

  const availableWorkspaces = useMemo<AvailableWorkspace[]>(
    () => (workspacesData?.workspaces ?? []).map(ws => ({ id: ws.id, name: ws.name })),
    [workspacesData],
  );

  if (!isReady) return <AgentBuilderAgentEditSkeleton />;

  return (
    <AgentBuilderAgentEditPage
      id={id}
      storedAgent={storedAgent}
      toolsData={toolsData}
      agentsData={agentsData}
      workflowsData={workflowsData}
      availableWorkspaces={availableWorkspaces}
      initialUserMessage={initialUserMessage}
      fromStarter={fromStarter}
    />
  );
}

interface PageProps {
  id: string | undefined;
  storedAgent: StoredAgent | null | undefined;
  toolsData: ToolsData | undefined;
  agentsData: AgentsData | undefined;
  workflowsData: WorkflowsData | undefined;
  availableWorkspaces: AvailableWorkspace[];
  initialUserMessage: string | undefined;
  fromStarter: boolean;
}

const AgentBuilderAgentEditPage = ({
  id,
  storedAgent,
  toolsData,
  agentsData,
  workflowsData,
  availableWorkspaces,
  initialUserMessage,
  fromStarter,
}: PageProps) => {
  const formMethods = useForm<AgentBuilderEditFormValues>({
    defaultValues: storedAgentToFormValues(storedAgent),
  });

  const mode: 'create' | 'edit' = storedAgent ? 'edit' : 'create';

  return (
    <FormProvider {...formMethods}>
      <AgentBuilderAgentEditReady
        id={id!}
        mode={mode}
        toolsData={toolsData ?? {}}
        agentsData={agentsData ?? {}}
        workflowsData={workflowsData ?? {}}
        availableWorkspaces={availableWorkspaces}
        initialUserMessage={initialUserMessage}
        fromStarter={fromStarter}
      />
    </FormProvider>
  );
};

const AgentBuilderAgentEditSkeleton = () => (
  <div className="h-screen w-screen flex items-center justify-center">
    <Spinner />
  </div>
);

interface AgentBuilderAgentEditReadyProps {
  id: string;
  mode: 'create' | 'edit';
  toolsData: ToolsData;
  agentsData: AgentsData;
  workflowsData: WorkflowsData;
  availableWorkspaces: AvailableWorkspace[];
  initialUserMessage: string | undefined;
  fromStarter: boolean;
}

const AgentBuilderAgentEditReady = ({
  id,
  mode,
  toolsData,
  agentsData,
  workflowsData,
  availableWorkspaces,
  initialUserMessage,
  fromStarter,
}: AgentBuilderAgentEditReadyProps) => {
  const navigate = useNavigate();
  const features = useBuilderAgentFeatures();
  const formMethods = useFormContext<AgentBuilderEditFormValues>();
  const selectedTools = useWatch({ control: formMethods.control, name: 'tools' });
  const selectedAgents = useWatch({ control: formMethods.control, name: 'agents' });
  const selectedWorkflows = useWatch({ control: formMethods.control, name: 'workflows' });

  const availableAgentTools = useAvailableAgentTools({
    toolsData,
    agentsData,
    workflowsData,
    selectedTools,
    selectedAgents,
    selectedWorkflows,
    excludeAgentId: id,
  });

  const [activeDetail, setActiveDetail] = useState<ActiveDetail>(null);

  const { save, isSaving } = useSaveAgent({ agentId: id, mode, availableAgentTools });

  const handleSaveSuccess = async (values: AgentBuilderEditFormValues) => {
    await save(values);
    void navigate(`/agent-builder/agents`, { viewTransition: true });
  };
  const handleSave = formMethods.handleSubmit(handleSaveSuccess);

  return (
    <WorkspaceLayout
      isLoading={false}
      mode="build"
      creating={mode === 'create'}
      detailOpen={activeDetail !== null}
      modeAction={
        mode === 'edit' ? (
          <IconButton
            tooltip="Chat"
            className="rounded-full"
            onClick={() => navigate(`/agent-builder/agents/${id}/view`, { viewTransition: true })}
            data-testid="agent-builder-edit-preview"
          >
            <MessageSquareIcon />
          </IconButton>
        ) : undefined
      }
      primaryAction={
        <Button
          size="sm"
          variant="primary"
          onClick={handleSave}
          disabled={isSaving}
          data-testid="agent-builder-edit-save"
        >
          <SaveIcon /> {isSaving ? 'Saving…' : mode === 'edit' ? 'Save' : 'Create'}
        </Button>
      }
      chat={
        <MastraReactProvider baseUrl="http://localhost:4112">
          <ConversationPanel
            initialUserMessage={initialUserMessage}
            isFreshThread={fromStarter}
            features={features}
            availableAgentTools={availableAgentTools}
            availableWorkspaces={availableWorkspaces}
            toolsReady
            agentId={id}
          />
        </MastraReactProvider>
      }
      configure={
        <AgentConfigurePanel
          editable
          availableAgentTools={availableAgentTools}
          isLoading={false}
          activeDetail={activeDetail}
          onActiveDetailChange={setActiveDetail}
        />
      }
    />
  );
};
