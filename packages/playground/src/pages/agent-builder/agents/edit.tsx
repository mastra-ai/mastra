import { Spinner } from '@mastra/playground-ui';
import { useState } from 'react';
import { FormProvider, useForm, useFormContext, useFormState, useWatch } from 'react-hook-form';
import { Navigate, useNavigate, useParams } from 'react-router';
import { AgentBuilderMobileMenu } from '@/domains/agent-builder/components/agent-edit/agent-builder-mobile-menu';
import {
  AgentProfile,
  AgentProfileInitialStep,
  AgentProfileModelStep,
  AgentProfileAvatar,
  AgentProfileDetails,
  AgentProfileHero,
  AgentProfileTabs,
} from '@/domains/agent-builder/components/agent-edit/agent-profile';
import { AutosaveIndicator } from '@/domains/agent-builder/components/agent-edit/autosave-indicator';
import { ConversationPanelChat } from '@/domains/agent-builder/components/agent-edit/conversation-panel';
import { DeleteAgentPanelButton } from '@/domains/agent-builder/components/agent-edit/delete-agent-action';
import { EditTopBar } from '@/domains/agent-builder/components/agent-edit/edit-top-bar';
import { PublishToChannelButton } from '@/domains/agent-builder/components/agent-edit/publish-to-channel-button';
import { VisibilitySelect } from '@/domains/agent-builder/components/agent-edit/visibility-select';
import { AgentColorProvider } from '@/domains/agent-builder/contexts/agent-color-context';
import { AgentPrimitivesProvider, useAgentPrimitives } from '@/domains/agent-builder/contexts/agent-primitives-context';
import { EditPageProvider, useEditPage } from '@/domains/agent-builder/contexts/edit-page-context';
import { useStreamRunning } from '@/domains/agent-builder/contexts/stream-chat-context';
import { useWizard, WizardProvider } from '@/domains/agent-builder/contexts/wizard-context';
import { useAvailableAgentTools } from '@/domains/agent-builder/hooks/use-available-agent-tools';
import { useChannelConnectToast } from '@/domains/agent-builder/hooks/use-channel-connect-toast';
import { AgentBuilderEditLayout } from '@/domains/agent-builder/layouts/agent-builder-edit-layout';
import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';
import { storedAgentToFormValues } from '@/domains/agent-builder/services/stored-agent-to-form-values';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';

export default function AgentBuilderAgentEdit() {
  const { id } = useParams<{ id: string }>();
  useChannelConnectToast();

  return (
    <AgentPrimitivesProvider agentId={id!}>
      <EditPageGate />
    </AgentPrimitivesProvider>
  );
}

const EditPageGate = () => {
  const { agentId, storedAgent, isReady, isOwner, canWrite, initialUserMessage } = useAgentPrimitives();

  if (!isReady) return <AgentBuilderAgentEditSkeleton />;
  if (!storedAgent) return <Navigate to="/agent-builder/agents" replace />;
  if (!canWrite || !isOwner) return <Navigate to={`/agent-builder/agents/${agentId}/view`} replace />;

  return (
    <WizardProvider initialStep={initialUserMessage ? 'initial' : 'end'}>
      <EditPageForm />
    </WizardProvider>
  );
};

const EditPageForm = () => {
  const { storedAgent } = useAgentPrimitives();
  const [defaultValues] = useState(() => storedAgentToFormValues(storedAgent));
  const formMethods = useForm<AgentBuilderEditFormValues>({ defaultValues });

  return (
    <FormProvider {...formMethods}>
      <AgentColorProvider>
        <EditPageBody />
      </AgentColorProvider>
    </FormProvider>
  );
};

const EditPageBody = () => {
  const { agentId, storedAgent, toolsData, agentsData, workflowsData, isOwner } = useAgentPrimitives();
  const navigate = useNavigate();
  const { control } = useFormContext<AgentBuilderEditFormValues>();
  const selectedTools = useWatch({ control, name: 'tools' });
  const selectedAgents = useWatch({ control, name: 'agents' });
  const selectedWorkflows = useWatch({ control, name: 'workflows' });

  const availableAgentTools = useAvailableAgentTools({
    toolsData,
    agentsData,
    workflowsData,
    selectedTools,
    selectedAgents,
    selectedWorkflows,
    excludeAgentId: agentId,
  });

  const handleModeToggle = isOwner
    ? () => navigate(`/agent-builder/agents/${agentId}/view`, { viewTransition: true })
    : undefined;

  return (
    <EditPageProvider
      storedAgent={storedAgent!}
      availableAgentTools={availableAgentTools}
      onModeToggle={handleModeToggle}
    >
      <AgentBuilderEditLayout topBar={<EditTopBarSlot />} chat={<ConversationPanelChat />} profile={<ProfileSlot />} />
    </EditPageProvider>
  );
};

const EditTopBarSlot = () => {
  const { autosave, onModeToggle, canPublishToChannel, agentId } = useEditPage();
  const isRunning = useStreamRunning();

  return (
    <EditTopBar
      isLoading={false}
      mode="build"
      onModeToggle={onModeToggle}
      modeToggleDisabled={isRunning}
      rightAside={
        <AutosaveIndicator status={autosave.status} lastError={autosave.lastError} onRetry={autosave.retry} />
      }
      modeAction={
        canPublishToChannel ? (
          <div className="hidden lg:flex items-center gap-2">
            <PublishToChannelButton agentId={agentId} />
          </div>
        ) : null
      }
      mobileExtra={<MobileMenuSlot />}
    />
  );
};

const MobileMenuSlot = () => {
  const { agentId, canPublishToChannel } = useEditPage();
  const isRunning = useStreamRunning();
  const { data: capabilities } = useAuthCapabilities();
  const { control } = useFormContext<AgentBuilderEditFormValues>();
  const name = useWatch({ control, name: 'name' }) ?? '';

  return (
    <AgentBuilderMobileMenu
      agentId={agentId}
      showSetVisibility={!!capabilities?.enabled}
      showPublishToChannel={canPublishToChannel}
      showDelete
      agentName={name}
      disabled={isRunning}
    />
  );
};

const ProfileSlot = () => {
  const { agentId, availableAgentTools, availableSkills, isOwner } = useEditPage();
  const isRunning = useStreamRunning();
  const { data: capabilities } = useAuthCapabilities();
  const { control } = useFormContext<AgentBuilderEditFormValues>();
  const name = useWatch({ control, name: 'name' }) ?? '';
  const { dirtyFields } = useFormState();
  const { step } = useWizard();

  const heroActions = (
    <>
      {capabilities?.enabled && (
        <span style={{ viewTransitionName: 'agent-visibility-select' }}>
          <VisibilitySelect agentId={agentId} />
        </span>
      )}
      {isOwner && <DeleteAgentPanelButton agentId={agentId} agentName={name} disabled={isRunning} />}
    </>
  );

  if (step === 'initial') {
    const isReady = dirtyFields.name && dirtyFields.description;

    return (
      <AgentProfileInitialStep
        isPreparing={!isReady}
        avatar={<AgentProfileAvatar disabled={isRunning} />}
        details={<AgentProfileDetails mode="highlighted" disabled={isRunning} />}
      />
    );
  }

  if (step === 'model') {
    return <AgentProfileModelStep />;
  }

  return (
    <AgentProfile>
      <AgentProfileHero
        avatar={<AgentProfileAvatar disabled={isRunning} />}
        details={<AgentProfileDetails disabled={isRunning} />}
        actions={heroActions}
      />
      <AgentProfileTabs
        agentId={agentId}
        availableAgentTools={availableAgentTools}
        availableSkills={availableSkills}
        disabled={isRunning}
      />
    </AgentProfile>
  );
};

const AgentBuilderAgentEditSkeleton = () => (
  <div className="h-screen w-screen flex items-center justify-center">
    <Spinner />
  </div>
);
