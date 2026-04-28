import { Button, Spinner } from '@mastra/playground-ui';
import { useMemo, useState } from 'react';
import { FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { useBuilderAgentFeatures } from '@/domains/agent-builder';
import {
  AgentChatPanelChat,
  AgentChatPanelProvider,
} from '@/domains/agent-builder/components/agent-builder-edit/agent-chat-panel';
import { AgentConfigurePanel } from '@/domains/agent-builder/components/agent-builder-edit/agent-configure-panel';
import type { ActiveDetail } from '@/domains/agent-builder/components/agent-builder-edit/agent-configure-panel';
import { useStreamRunning } from '@/domains/agent-builder/components/agent-builder-edit/stream-chat-context';
import { WorkspaceLayout } from '@/domains/agent-builder/components/agent-builder-edit/workspace-layout';
import { useAvailableAgentTools } from '@/domains/agent-builder/hooks/use-available-agent-tools';
import { storedAgentToAgentConfig } from '@/domains/agent-builder/mappers/stored-agent-to-agent-config';
import { storedAgentToFormValues } from '@/domains/agent-builder/mappers/stored-agent-to-form-values';
import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import type { StoredAgent } from '@/domains/agents/hooks/use-stored-agents';
import { useStoredAgent } from '@/domains/agents/hooks/use-stored-agents';
import { useStoredSkills } from '@/domains/agents/hooks/use-stored-skills';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';
import { useTools } from '@/domains/tools/hooks/use-all-tools';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';

type ToolsData = NonNullable<ReturnType<typeof useTools>['data']>;
type AgentsData = NonNullable<ReturnType<typeof useAgents>['data']>;
type WorkflowsData = NonNullable<ReturnType<typeof useWorkflows>['data']>;

export default function AgentBuilderAgentView() {
  const { id } = useParams<{ id: string }>();
  const features = useBuilderAgentFeatures();
  const { data: storedAgent, isLoading: isStoredAgentLoading } = useStoredAgent(id);
  const { data: toolsData, isPending: isToolsPending } = useTools();
  const { data: agentsData, isPending: isAgentsPending } = useAgents({ enabled: features.agents });
  const { data: workflowsData, isPending: isWorkflowsPending } = useWorkflows({ enabled: features.workflows });
  const { isPending: isSkillsPending } = useStoredSkills();
  const isReady =
    Boolean(id) &&
    !isStoredAgentLoading &&
    !isToolsPending &&
    !isSkillsPending &&
    (!features.agents || !isAgentsPending) &&
    (!features.workflows || !isWorkflowsPending);

  if (!isReady) return <AgentBuilderAgentViewSkeleton />;

  return (
    <AgentBuilderAgentViewPage
      id={id}
      storedAgent={storedAgent}
      toolsData={toolsData}
      agentsData={agentsData}
      workflowsData={workflowsData}
    />
  );
}

interface PageProps {
  id: string | undefined;
  storedAgent: StoredAgent | null | undefined;
  toolsData: ToolsData | undefined;
  agentsData: AgentsData | undefined;
  workflowsData: WorkflowsData | undefined;
}

const AgentBuilderAgentViewPage = ({ id, storedAgent, toolsData, agentsData, workflowsData }: PageProps) => {
  const formMethods = useForm<AgentBuilderEditFormValues>({
    defaultValues: storedAgentToFormValues(storedAgent),
  });

  return (
    <FormProvider {...formMethods}>
      <AgentBuilderAgentViewReady
        id={id!}
        storedAgent={storedAgent}
        toolsData={toolsData ?? {}}
        agentsData={agentsData ?? {}}
        workflowsData={workflowsData ?? {}}
      />
    </FormProvider>
  );
};

const AgentBuilderAgentViewSkeleton = () => (
  <div className="h-screen w-screen flex items-center justify-center">
    <Spinner />
  </div>
);

interface AgentBuilderAgentViewReadyProps {
  id: string;
  storedAgent: StoredAgent | null | undefined;
  toolsData: ToolsData;
  agentsData: AgentsData;
  workflowsData: WorkflowsData;
}

const AgentBuilderAgentViewReady = ({
  id,
  storedAgent,
  toolsData,
  agentsData,
  workflowsData,
}: AgentBuilderAgentViewReadyProps) => {
  const navigate = useNavigate();
  const [activeDetail, setActiveDetail] = useState<ActiveDetail>(null);
  const formMethods = useFormContext<AgentBuilderEditFormValues>();
  const selectedTools = useWatch({ control: formMethods.control, name: 'tools' });
  const selectedAgents = useWatch({ control: formMethods.control, name: 'agents' });
  const selectedWorkflows = useWatch({ control: formMethods.control, name: 'workflows' });
  const { data: currentUser } = useCurrentUser();
  const isOwner = !storedAgent?.authorId || currentUser?.id === storedAgent.authorId;

  const availableAgentTools = useAvailableAgentTools({
    toolsData,
    agentsData,
    workflowsData,
    selectedTools,
    selectedAgents,
    selectedWorkflows,
    excludeAgentId: id,
  });

  const agent = useMemo(() => storedAgentToAgentConfig(storedAgent, id ?? ''), [storedAgent, id]);

  return (
    <AgentChatPanelProvider agentId={id} agentName={storedAgent?.name} agentDescription={storedAgent?.description}>
      <WorkspaceLayout
        isLoading={false}
        mode="test"
        defaultExpanded={false}
        detailOpen={activeDetail !== null}
        primaryAction={
          isOwner ? (
            <ViewHeaderActions onEdit={() => navigate(`/agent-builder/agents/${id}/edit`, { viewTransition: true })} />
          ) : undefined
        }
        chat={<AgentChatPanelChat />}
        configure={
          <ViewConfigurePanelConnected
            agent={agent}
            availableAgentTools={availableAgentTools}
            activeDetail={activeDetail}
            onActiveDetailChange={setActiveDetail}
          />
        }
      />
    </AgentChatPanelProvider>
  );
};

const ViewHeaderActions = ({ onEdit }: { onEdit: () => void }) => {
  const isRunning = useStreamRunning();
  return (
    <Button size="sm" variant="default" onClick={onEdit} disabled={isRunning} data-testid="agent-builder-view-edit">
      Edit configuration
    </Button>
  );
};

interface ViewConfigurePanelConnectedProps {
  agent: ReturnType<typeof storedAgentToAgentConfig>;
  availableAgentTools: ReturnType<typeof useAvailableAgentTools>;
  activeDetail: ActiveDetail;
  onActiveDetailChange: (next: ActiveDetail) => void;
}

const ViewConfigurePanelConnected = ({
  agent,
  availableAgentTools,
  activeDetail,
  onActiveDetailChange,
}: ViewConfigurePanelConnectedProps) => {
  const isRunning = useStreamRunning();
  return (
    <AgentConfigurePanel
      agent={agent}
      editable={false}
      isLoading={false}
      availableAgentTools={availableAgentTools}
      activeDetail={activeDetail}
      onActiveDetailChange={onActiveDetailChange}
      disabled={isRunning}
    />
  );
};
