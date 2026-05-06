import type { StoredSkillResponse } from '@mastra/client-js';
import { Spinner } from '@mastra/playground-ui';
import { useMemo, useState } from 'react';
import { FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useBuilderAgentFeatures } from '@/domains/agent-builder';
import { AgentBuilderMobileMenu } from '@/domains/agent-builder/components/agent-builder-edit/agent-builder-mobile-menu';
import type { ActiveDetail } from '@/domains/agent-builder/components/agent-builder-edit/agent-configure-panel';
import { AutosaveIndicator } from '@/domains/agent-builder/components/agent-builder-edit/autosave-indicator';
import { ConfigurePanelConnected } from '@/domains/agent-builder/components/agent-builder-edit/configure-panel-connected';
import {
  ConversationPanelChat,
  ConversationPanelProvider,
} from '@/domains/agent-builder/components/agent-builder-edit/conversation-panel';
import { DeleteAgentPanelButton } from '@/domains/agent-builder/components/agent-builder-edit/delete-agent-action';
import type { AvailableWorkspace } from '@/domains/agent-builder/components/agent-builder-edit/hooks/use-agent-builder-tool';
import { useChannelConnectToast } from '@/domains/agent-builder/components/agent-builder-edit/hooks/use-channel-connect-toast';
import { useStarterUserMessage } from '@/domains/agent-builder/components/agent-builder-edit/hooks/use-starter-user-message';
import { PublishToChannelButton } from '@/domains/agent-builder/components/agent-builder-edit/publish-to-channel-button';
import { useStreamRunning } from '@/domains/agent-builder/components/agent-builder-edit/stream-chat-context';
import { VisibilitySelect } from '@/domains/agent-builder/components/agent-builder-edit/visibility-select';
import { WorkspaceLayout } from '@/domains/agent-builder/components/agent-builder-edit/workspace-layout';
import { useAutosaveAgent } from '@/domains/agent-builder/hooks/use-autosave-agent';
import { useAvailableAgentTools } from '@/domains/agent-builder/hooks/use-available-agent-tools';
import { storedAgentToFormValues } from '@/domains/agent-builder/mappers/stored-agent-to-form-values';
import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import type { StoredAgent } from '@/domains/agents/hooks/use-stored-agents';
import { useStoredAgent } from '@/domains/agents/hooks/use-stored-agents';
import { useStoredSkills } from '@/domains/agents/hooks/use-stored-skills';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';
import { useTools } from '@/domains/tools/hooks/use-all-tools';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';
import { useStoredWorkspaces } from '@/domains/workspace/hooks/use-stored-workspaces';

type ToolsData = NonNullable<ReturnType<typeof useTools>['data']>;
type AgentsData = NonNullable<ReturnType<typeof useAgents>['data']>;
type WorkflowsData = NonNullable<ReturnType<typeof useWorkflows>['data']>;

export default function AgentBuilderAgentEdit() {
  const { id } = useParams<{ id: string }>();
  useChannelConnectToast();
  const features = useBuilderAgentFeatures();
  const initialUserMessage = useStarterUserMessage();
  const { data: storedAgent, isLoading: isStoredAgentLoading } = useStoredAgent(id, { status: 'draft' });
  const { data: toolsData, isPending: isToolsPending } = useTools({ enabled: features.tools });
  const { data: agentsData, isPending: isAgentsPending } = useAgents({ enabled: features.agents });
  const { data: workflowsData, isPending: isWorkflowsPending } = useWorkflows({ enabled: features.workflows });
  const { data: storedSkillsResponse, isPending: isSkillsPending } = useStoredSkills(undefined, {
    enabled: features.skills,
  });
  const { data: workspacesData } = useStoredWorkspaces();
  const { data: currentUser, isLoading: isCurrentUserLoading } = useCurrentUser();
  const isOwner = !storedAgent?.authorId || currentUser?.id === storedAgent.authorId;
  const isOwnershipLoading = Boolean(storedAgent?.authorId) && isCurrentUserLoading;
  const isReady =
    Boolean(id) &&
    !isStoredAgentLoading &&
    !isOwnershipLoading &&
    (!features.tools || !isToolsPending) &&
    (!features.skills || !isSkillsPending) &&
    (!features.agents || !isAgentsPending) &&
    (!features.workflows || !isWorkflowsPending);

  const availableWorkspaces = useMemo<AvailableWorkspace[]>(
    () =>
      (workspacesData?.workspaces ?? [])
        .filter(ws => ws.status !== 'archived')
        .sort((a, b) => (b.runtimeRegistered ? 1 : 0) - (a.runtimeRegistered ? 1 : 0))
        .map(ws => ({ id: ws.id, name: ws.name })),
    [workspacesData],
  );

  const availableSkills = useMemo<StoredSkillResponse[]>(
    () => storedSkillsResponse?.skills ?? [],
    [storedSkillsResponse],
  );

  if (!isReady) return <AgentBuilderAgentEditSkeleton />;

  // Edit-only route: bounce out to the agents list when no stored agent exists for this id.
  if (!storedAgent) {
    return <Navigate to="/agent-builder/agents" replace />;
  }

  // Redirect non-owners to the view page (server blocks writes anyway)
  if (!isOwner) {
    return <Navigate to={`/agent-builder/agents/${id}/view`} replace />;
  }

  return (
    <AgentBuilderAgentEditPage
      id={id}
      storedAgent={storedAgent}
      toolsData={toolsData}
      agentsData={agentsData}
      workflowsData={workflowsData}
      availableWorkspaces={availableWorkspaces}
      availableSkills={availableSkills}
      initialUserMessage={initialUserMessage}
      isOwner={isOwner}
    />
  );
}

interface PageProps {
  id: string | undefined;
  storedAgent: StoredAgent;
  toolsData: ToolsData | undefined;
  agentsData: AgentsData | undefined;
  workflowsData: WorkflowsData | undefined;
  availableWorkspaces: AvailableWorkspace[];
  availableSkills: StoredSkillResponse[];
  initialUserMessage: string | undefined;
  isOwner: boolean;
}

const AgentBuilderAgentEditPage = ({
  id,
  storedAgent,
  toolsData,
  agentsData,
  workflowsData,
  availableWorkspaces,
  availableSkills,
  initialUserMessage,
  isOwner,
}: PageProps) => {
  const formMethods = useForm<AgentBuilderEditFormValues>({
    defaultValues: storedAgentToFormValues(storedAgent),
  });

  return (
    <FormProvider {...formMethods}>
      <AgentBuilderAgentEditReady
        id={id!}
        storedAgent={storedAgent}
        toolsData={toolsData ?? {}}
        agentsData={agentsData ?? {}}
        workflowsData={workflowsData ?? {}}
        availableWorkspaces={availableWorkspaces}
        availableSkills={availableSkills}
        initialUserMessage={initialUserMessage}
        isOwner={isOwner}
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
  storedAgent: StoredAgent;
  toolsData: ToolsData;
  agentsData: AgentsData;
  workflowsData: WorkflowsData;
  availableWorkspaces: AvailableWorkspace[];
  availableSkills: StoredSkillResponse[];
  initialUserMessage: string | undefined;
  isOwner: boolean;
}

const AgentBuilderAgentEditReady = ({
  id,
  storedAgent,
  toolsData,
  agentsData,
  workflowsData,
  availableWorkspaces,
  availableSkills,
  initialUserMessage,
  isOwner,
}: AgentBuilderAgentEditReadyProps) => {
  const features = useBuilderAgentFeatures();
  const formMethods = useFormContext<AgentBuilderEditFormValues>();
  const selectedTools = useWatch({ control: formMethods.control, name: 'tools' });
  const selectedAgents = useWatch({ control: formMethods.control, name: 'agents' });
  const selectedWorkflows = useWatch({ control: formMethods.control, name: 'workflows' });

  // Gate publishing on the *saved* visibility — unsaved form edits should not unlock publishing.
  const isPublishable = storedAgent.visibility === 'public';

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

  const autosave = useAutosaveAgent({ agentId: id, availableAgentTools, availableSkills });

  const isFreshThread = initialUserMessage !== undefined;
  const canPublishToChannel = isOwner && isPublishable;
  const navigate = useNavigate();

  const onModeToggle = isOwner
    ? () => navigate(`/agent-builder/agents/${id}/view`, { viewTransition: true })
    : undefined;

  return (
    <ConversationPanelProvider
      initialUserMessage={initialUserMessage}
      isFreshThread={isFreshThread}
      features={features}
      availableAgentTools={availableAgentTools}
      availableWorkspaces={availableWorkspaces}
      availableSkills={availableSkills}
      toolsReady
      agentId={id}
      canPublishToChannel={canPublishToChannel}
    >
      <EditWorkspaceLayoutConnected
        agentId={id}
        isOwner={isOwner}
        canPublishToChannel={canPublishToChannel}
        autosave={autosave}
        availableAgentTools={availableAgentTools}
        availableSkills={availableSkills}
        activeDetail={activeDetail}
        onActiveDetailChange={setActiveDetail}
        onModeToggle={onModeToggle}
      />
    </ConversationPanelProvider>
  );
};

interface EditWorkspaceLayoutConnectedProps {
  agentId: string;
  isOwner: boolean;
  canPublishToChannel: boolean;
  autosave: ReturnType<typeof useAutosaveAgent>;
  availableAgentTools: ReturnType<typeof useAvailableAgentTools>;
  availableSkills: StoredSkillResponse[];
  activeDetail: ActiveDetail;
  onActiveDetailChange: (next: ActiveDetail) => void;
  onModeToggle: (() => void) | undefined;
}

const EditWorkspaceLayoutConnected = ({
  agentId,
  isOwner,
  canPublishToChannel,
  autosave,
  availableAgentTools,
  availableSkills,
  activeDetail,
  onActiveDetailChange,
  onModeToggle,
}: EditWorkspaceLayoutConnectedProps) => {
  const isRunning = useStreamRunning();
  return (
    <WorkspaceLayout
      isLoading={false}
      mode="build"
      detailOpen={activeDetail !== null}
      showConfigure={isOwner}
      backHref={`/agent-builder/agents/${agentId}/view`}
      backTooltip="Back to agent chat"
      onModeToggle={onModeToggle}
      modeToggleDisabled={isRunning}
      rightAside={
        <AutosaveIndicator status={autosave.status} lastError={autosave.lastError} onRetry={autosave.retry} />
      }
      modeAction={
        <div className="hidden lg:flex items-center gap-2">
          {canPublishToChannel && <PublishToChannelButton agentId={agentId} />}
          <VisibilitySelectConnected agentId={agentId} />
        </div>
      }
      mobileExtra={
        <AgentBuilderMobileMenuConnected agentId={agentId} showPublishToChannel={canPublishToChannel} />
      }
      chat={<ConversationPanelChat />}
      configure={
        <ConfigurePanelConnected
          editable
          availableAgentTools={availableAgentTools}
          availableSkills={availableSkills}
          activeDetail={activeDetail}
          onActiveDetailChange={onActiveDetailChange}
          deleteAction={isOwner ? <DeleteAgentPanelButtonConnected agentId={agentId} /> : undefined}
        />
      }
    />
  );
};

const VisibilitySelectConnected = ({ agentId }: { agentId: string }) => {
  const { data: capabilities } = useAuthCapabilities();
  if (!capabilities?.enabled) return null;
  return <VisibilitySelect agentId={agentId} />;
};

const AgentBuilderMobileMenuConnected = ({
  agentId,
  showPublishToChannel,
}: {
  agentId: string | undefined;
  showPublishToChannel: boolean;
}) => {
  const isRunning = useStreamRunning();
  const { data: capabilities } = useAuthCapabilities();
  const authEnabled = !!capabilities?.enabled;
  const formMethods = useFormContext<AgentBuilderEditFormValues>();
  const name = useWatch({ control: formMethods.control, name: 'name' }) ?? '';
  return (
    <AgentBuilderMobileMenu
      agentId={agentId}
      showSetVisibility={authEnabled}
      showPublishToChannel={showPublishToChannel}
      showDelete
      agentName={name}
      disabled={isRunning}
    />
  );
};

const DeleteAgentPanelButtonConnected = ({ agentId }: { agentId: string }) => {
  const isRunning = useStreamRunning();
  const formMethods = useFormContext<AgentBuilderEditFormValues>();
  const name = useWatch({ control: formMethods.control, name: 'name' }) ?? '';
  return <DeleteAgentPanelButton agentId={agentId} agentName={name} disabled={isRunning} />;
};
