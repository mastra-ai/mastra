import type { StoredSkillResponse } from '@mastra/client-js';
import { Button, Spinner } from '@mastra/playground-ui';
import { CheckIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useBuilderAgentFeatures } from '@/domains/agent-builder';
import { AgentBuilderMobileMenu } from '@/domains/agent-builder/components/agent-builder-edit/agent-builder-mobile-menu';
import type { ActiveDetail } from '@/domains/agent-builder/components/agent-builder-edit/agent-configure-panel';
import { ConfigurePanelConnected } from '@/domains/agent-builder/components/agent-builder-edit/configure-panel-connected';
import {
  ConversationPanelChat,
  ConversationPanelProvider,
} from '@/domains/agent-builder/components/agent-builder-edit/conversation-panel';
import { DeleteAgentDesktopButton } from '@/domains/agent-builder/components/agent-builder-edit/delete-agent-action';
import type { AvailableWorkspace } from '@/domains/agent-builder/components/agent-builder-edit/hooks/use-agent-builder-tool';
import { useChannelConnectToast } from '@/domains/agent-builder/components/agent-builder-edit/hooks/use-channel-connect-toast';
import { useStarterUserMessage } from '@/domains/agent-builder/components/agent-builder-edit/hooks/use-starter-user-message';
import { PublishToChannelButton } from '@/domains/agent-builder/components/agent-builder-edit/publish-to-channel-button';
import { useStreamRunning } from '@/domains/agent-builder/components/agent-builder-edit/stream-chat-context';
import { VisibilitySelect } from '@/domains/agent-builder/components/agent-builder-edit/visibility-select';
import { WorkspaceLayout } from '@/domains/agent-builder/components/agent-builder-edit/workspace-layout';
import { useAvailableAgentTools } from '@/domains/agent-builder/hooks/use-available-agent-tools';
import { useSaveAgent } from '@/domains/agent-builder/hooks/use-save-agent';
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
  const fromStarter = initialUserMessage !== undefined;
  const { data: storedAgent, isLoading: isStoredAgentLoading } = useStoredAgent(id, {
    status: 'draft',
    enabled: !fromStarter,
  });
  const { data: toolsData, isPending: isToolsPending } = useTools({ enabled: features.tools });
  const { data: agentsData, isPending: isAgentsPending } = useAgents({ enabled: features.agents });
  const { data: workflowsData, isPending: isWorkflowsPending } = useWorkflows({ enabled: features.workflows });
  const { data: storedSkillsResponse, isPending: isSkillsPending } = useStoredSkills(undefined, {
    enabled: features.skills,
  });
  const { data: workspacesData } = useStoredWorkspaces();
  const { data: currentUser, isLoading: isCurrentUserLoading } = useCurrentUser();
  const isOwner = !storedAgent?.authorId || currentUser?.id === storedAgent.authorId;
  const isOwnershipLoading = !fromStarter && Boolean(storedAgent?.authorId) && isCurrentUserLoading;
  const isReady =
    Boolean(id) &&
    (fromStarter || !isStoredAgentLoading) &&
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

  // Redirect non-owners to the view page (server blocks writes anyway)
  if (!fromStarter && !isOwner) {
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
      fromStarter={fromStarter}
      isOwner={isOwner}
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
  availableSkills: StoredSkillResponse[];
  initialUserMessage: string | undefined;
  fromStarter: boolean;
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
  fromStarter,
  isOwner,
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
        storedAgent={storedAgent}
        toolsData={toolsData ?? {}}
        agentsData={agentsData ?? {}}
        workflowsData={workflowsData ?? {}}
        availableWorkspaces={availableWorkspaces}
        availableSkills={availableSkills}
        initialUserMessage={initialUserMessage}
        fromStarter={fromStarter}
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
  mode: 'create' | 'edit';
  storedAgent: StoredAgent | null | undefined;
  toolsData: ToolsData;
  agentsData: AgentsData;
  workflowsData: WorkflowsData;
  availableWorkspaces: AvailableWorkspace[];
  availableSkills: StoredSkillResponse[];
  initialUserMessage: string | undefined;
  fromStarter: boolean;
  isOwner: boolean;
}

const AgentBuilderAgentEditReady = ({
  id,
  mode,
  storedAgent,
  toolsData,
  agentsData,
  workflowsData,
  availableWorkspaces,
  availableSkills,
  initialUserMessage,
  fromStarter,
  isOwner,
}: AgentBuilderAgentEditReadyProps) => {
  const navigate = useNavigate();
  const features = useBuilderAgentFeatures();
  const formMethods = useFormContext<AgentBuilderEditFormValues>();
  const selectedTools = useWatch({ control: formMethods.control, name: 'tools' });
  const selectedAgents = useWatch({ control: formMethods.control, name: 'agents' });
  const selectedWorkflows = useWatch({ control: formMethods.control, name: 'workflows' });

  // Gate publishing on the *saved* visibility — unsaved form edits should not unlock publishing.
  const isPublishable = storedAgent?.visibility === 'public';

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

  const { save, isSaving } = useSaveAgent({ agentId: id, mode, availableAgentTools, availableSkills });

  const handleSaveSuccess = async (values: AgentBuilderEditFormValues) => {
    await save(values);
    void navigate(`/agent-builder/agents/${id}/view`, { viewTransition: true });
  };
  const handleSave = formMethods.handleSubmit(handleSaveSuccess);

  const canPublishToChannel = mode === 'edit' && isOwner && isPublishable;

  return (
    <ConversationPanelProvider
      initialUserMessage={initialUserMessage}
      isFreshThread={fromStarter}
      features={features}
      availableAgentTools={availableAgentTools}
      availableWorkspaces={availableWorkspaces}
      availableSkills={availableSkills}
      toolsReady
      agentId={id}
      canPublishToChannel={canPublishToChannel}
    >
      <WorkspaceLayout
        isLoading={false}
        mode="build"
        creating={mode === 'create'}
        defaultExpanded={mode === 'edit'}
        detailOpen={activeDetail !== null}
        showConfigure={isOwner}
        backHref={mode === 'edit' ? `/agent-builder/agents/${id}/view` : '/agent-builder/agents'}
        backTooltip={mode === 'edit' ? 'Back to agent chat' : 'Agents list'}
        modeAction={
          <div className="hidden lg:flex items-center gap-2">
            {canPublishToChannel && <PublishToChannelButton agentId={id} />}
            <VisibilitySelectConnected />
          </div>
        }
        primaryAction={<HeaderActions mode={mode} agentId={id} isSaving={isSaving} onSave={handleSave} />}
        mobileExtra={
          <AgentBuilderMobileMenuConnected
            agentId={id}
            showPublishToChannel={canPublishToChannel}
            showDelete={mode === 'edit'}
          />
        }
        chat={<ConversationPanelChat />}
        configure={
          <ConfigurePanelConnected
            editable
            availableAgentTools={availableAgentTools}
            availableSkills={availableSkills}
            activeDetail={activeDetail}
            onActiveDetailChange={setActiveDetail}
          />
        }
      />
    </ConversationPanelProvider>
  );
};

const VisibilitySelectConnected = () => {
  const isRunning = useStreamRunning();
  const { data: capabilities } = useAuthCapabilities();
  if (!capabilities?.enabled) return null;
  return <VisibilitySelect disabled={isRunning} variant="ghost" />;
};

const AgentBuilderMobileMenuConnected = ({
  agentId,
  showPublishToChannel,
  showDelete,
}: {
  agentId: string | undefined;
  showPublishToChannel: boolean;
  showDelete: boolean;
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
      showDelete={showDelete}
      agentName={name}
      disabled={isRunning}
    />
  );
};

interface HeaderActionsProps {
  mode: 'create' | 'edit';
  agentId: string;
  isSaving: boolean;
  onSave: () => void;
}

const HeaderActions = ({ mode, agentId, isSaving, onSave }: HeaderActionsProps) => {
  const isRunning = useStreamRunning();
  const disabled = isSaving || isRunning;
  const formMethods = useFormContext<AgentBuilderEditFormValues>();
  const name = useWatch({ control: formMethods.control, name: 'name' }) ?? '';
  return (
    <div className="flex items-center gap-2">
      {mode === 'edit' && <DeleteAgentDesktopButton agentId={agentId} agentName={name} disabled={disabled} />}
      <Button size="sm" variant="cta" onClick={onSave} disabled={disabled} data-testid="agent-builder-edit-save">
        <CheckIcon /> {isSaving ? 'Saving…' : mode === 'edit' ? 'Save' : 'Create'}
      </Button>
    </div>
  );
};
