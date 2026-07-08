import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { useState } from 'react';
import { FormProvider, useForm, useFormContext, useFormState, useWatch } from 'react-hook-form';
import { Navigate, useNavigate, useParams } from 'react-router';
import { AgentBuilderMobileMenu } from '@/domains/agent-builder/components/agent-edit/agent-builder-mobile-menu';
import {
  AgentProfile,
  AgentProfileReadyStep,
  AgentProfileIdentityStep,
  AgentProfileLibraryStep,
  AgentProfileModelStep,
  AgentProfileToolsStep,
  AgentProfileInstructionsStep,
  AgentProfileSkillsStep,
  AgentProfileBrowserStep,
  AgentProfileIntegrationsStep,
  AgentProfileAvatar,
  AgentProfileDetails,
  AgentProfileHero,
  AgentProfileTabs,
} from '@/domains/agent-builder/components/agent-edit/agent-profile';
import { AutosaveIndicator } from '@/domains/agent-builder/components/agent-edit/autosave-indicator';
import { ConversationPanelChat } from '@/domains/agent-builder/components/agent-edit/conversation-panel';
import { DeleteAgentPanelButton } from '@/domains/agent-builder/components/agent-edit/delete-agent-action';
import { EditTopBar } from '@/domains/agent-builder/components/agent-edit/edit-top-bar';
import { VisibilitySelect } from '@/domains/agent-builder/components/agent-edit/visibility-select';
import { AgentColorProvider } from '@/domains/agent-builder/contexts/agent-color-context';
import { AgentPrimitivesProvider, useAgentPrimitives } from '@/domains/agent-builder/contexts/agent-primitives-context';
import { EditPageProvider, useEditPage } from '@/domains/agent-builder/contexts/edit-page-context';
import { useStreamRunning, useStreamRunningDebounced } from '@/domains/agent-builder/contexts/stream-chat-context';
import { useWizard, WizardProvider } from '@/domains/agent-builder/contexts/wizard-context';
import { useAvailableAgentTools } from '@/domains/agent-builder/hooks/use-available-agent-tools';
import { useBuilderAgentFeatures } from '@/domains/agent-builder/hooks/use-builder-agent-features';
import { useChannelConnectToast } from '@/domains/agent-builder/hooks/use-channel-connect-toast';
import { AgentBuilderEditLayout } from '@/domains/agent-builder/layouts/agent-builder-edit-layout';
import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';
import { storedAgentToFormValues } from '@/domains/agent-builder/services/stored-agent-to-form-values';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import { useAllProviderTools } from '@/domains/tool-providers/hooks/use-all-provider-tools';
import { startViewTransition } from '@/lib/routing';

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
  const { agentId, storedAgent, isReady, isOwner, canWrite } = useAgentPrimitives();

  if (!isReady) return <AgentBuilderAgentEditSkeleton />;
  if (!storedAgent) return <Navigate to="/agent-builder/agents" replace />;
  if (!canWrite || !isOwner) return <Navigate to={`/agent-builder/agents/${agentId}/view`} replace />;

  return <EditPageForm />;
};

const EditPageForm = () => {
  const { agentId, storedAgent } = useAgentPrimitives();
  const [defaultValues] = useState(() => storedAgentToFormValues(storedAgent));
  const formMethods = useForm<AgentBuilderEditFormValues>({ defaultValues });

  return (
    <FormProvider {...formMethods}>
      <AgentColorProvider agentId={agentId}>
        <EditPageBody />
      </AgentColorProvider>
    </FormProvider>
  );
};

const EditPageBody = () => {
  const { agentId, storedAgent, toolsData, agentsData, workflowsData, isOwner, initialUserMessage } =
    useAgentPrimitives();
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

  // While integration tools are still loading, treat tools as potentially
  // available so the wizard's tools step isn't dropped prematurely (parity
  // with the Tools tab gating). React Query dedupes this with the identical
  // queries issued by `useAvailableAgentTools`.
  const { isLoading: isIntegrationToolsLoading } = useAllProviderTools();

  const handleModeToggle = isOwner
    ? () => navigate(`/agent-builder/agents/${agentId}/view`, { viewTransition: true })
    : undefined;

  return (
    <WizardProvider
      initialStep={initialUserMessage ? 'ready' : 'end'}
      hasAgentTools={availableAgentTools.length > 0 || isIntegrationToolsLoading}
    >
      <EditPageProvider
        storedAgent={storedAgent!}
        availableAgentTools={availableAgentTools}
        onModeToggle={handleModeToggle}
      >
        <EditPageLayout />
      </EditPageProvider>
    </WizardProvider>
  );
};

const EditPageLayout = () => {
  const { step } = useWizard();
  const features = useBuilderAgentFeatures();
  // Debounced so a brief mid-conversation idle gap doesn't flicker the layout
  // between centered and split. Same signal as the composer.
  const isStreamRunning = useStreamRunningDebounced();
  const { control } = useFormContext<AgentBuilderEditFormValues>();
  const { dirtyFields } = useFormState({ control });
  const name = useWatch({ control, name: 'name' }) ?? '';
  const description = useWatch({ control, name: 'description' }) ?? '';
  const instructions = useWatch({ control, name: 'instructions' }) ?? '';
  const modelName = useWatch({ control, name: 'model.name' }) ?? '';

  // Onboarding gate: stay centered until every mandatory field for the new agent
  // is populated. A field is considered populated when it is either user-dirty
  // in the form OR already has a non-empty value (e.g. set by the builder agent
  // through a tool call, or persisted on the stored agent).
  const isFilled = (isDirty: boolean | undefined, value: string) => Boolean(isDirty) || value.trim().length > 0;

  const hasMandatoryFields =
    isFilled(dirtyFields.name, name) &&
    isFilled(dirtyFields.description, description) &&
    isFilled(dirtyFields.instructions, instructions) &&
    (!features.model || isFilled(dirtyFields.model?.name, modelName));

  // The `ready` step is only ever reached on the initial starter flow (a fresh agent
  // with a starter message); a direct /edit open starts the wizard at `end` instead.
  // On that flow the agent begins empty and the builder agent auto-runs to compose it,
  // writing the mandatory fields through the form. The "Your agent is ready" review
  // panel must only appear once the builder has finished: every mandatory field is
  // populated AND the stream is idle. While it is still running (or before any field
  // is set) we keep the chat centered.
  const isBuilderReady = hasMandatoryFields && !isStreamRunning;

  // Keep the chat centered (no profile column) until the builder is ready; for the
  // identity step we only require the mandatory fields so editing them back to empty
  // re-centers the layout.
  const shouldBeCentered = (step === 'ready' && !isBuilderReady) || (step === 'identity' && !hasMandatoryFields);

  const variant = shouldBeCentered ? 'centered' : 'split';
  const isCentered = shouldBeCentered;
  const showMobileInitialCtas = step === 'identity' && hasMandatoryFields && !isStreamRunning;

  return (
    <AgentBuilderEditLayout
      topBar={<EditTopBarSlot />}
      chat={<ConversationPanelChat />}
      chatFooter={showMobileInitialCtas ? <MobileInitialCtas /> : undefined}
      profile={isCentered ? null : <ProfileSlot />}
      variant={variant}
      hideMobileChat={step === 'end'}
    />
  );
};

const MobileInitialCtas = () => {
  const { next } = useWizard();
  const navigate = useNavigate();
  const { agentId } = useEditPage();

  return (
    <div className="flex flex-col gap-2 lg:hidden" data-testid="agent-builder-mobile-initial-ctas">
      <Button
        variant="primary"
        onClick={() => navigate(`/agent-builder/agents/${agentId}/view`, { viewTransition: true })}
        data-testid="agent-builder-mobile-initial-cta-chat"
      >
        Chat with my agent
      </Button>
      <Button
        variant="outline"
        onClick={() => startViewTransition(() => next())}
        data-testid="agent-builder-mobile-initial-cta-config"
      >
        See configuration
      </Button>
    </div>
  );
};

const EditTopBarSlot = () => {
  const { autosave, onModeToggle } = useEditPage();
  const isRunning = useStreamRunning();
  const { step } = useWizard();
  // During onboarding (any step before `end`) the agent is still being composed,
  // so switching to view mode makes no sense — hide the toggle entirely.
  const isOnboarding = step !== 'end';

  return (
    <EditTopBar
      isLoading={false}
      mode="build"
      onModeToggle={isOnboarding ? undefined : onModeToggle}
      modeToggleDisabled={isRunning}
      rightAside={
        <AutosaveIndicator status={autosave.status} lastError={autosave.lastError} onRetry={autosave.retry} />
      }
      mobileExtra={<MobileMenuSlot />}
    />
  );
};

const MobileMenuSlot = () => {
  const { agentId } = useEditPage();
  const isRunning = useStreamRunning();
  const { data: capabilities } = useAuthCapabilities();
  const { control } = useFormContext<AgentBuilderEditFormValues>();
  const name = useWatch({ control, name: 'name' }) ?? '';

  return (
    <AgentBuilderMobileMenu
      agentId={agentId}
      showSetVisibility={!!capabilities?.enabled}
      showDelete
      showViewAgent
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
  const { step } = useWizard();

  // Both buttons are already accessible from the mobile 3-dots menu, so we
  // hide them in the profile panel on mobile to avoid duplication.
  const heroActions = (
    <div className="hidden lg:flex items-center gap-2" data-testid="agent-builder-hero-actions-desktop">
      {capabilities?.enabled && (
        <span style={{ viewTransitionName: 'agent-visibility-select' }}>
          <VisibilitySelect agentId={agentId} />
        </span>
      )}
      {isOwner && <DeleteAgentPanelButton agentId={agentId} agentName={name} disabled={isRunning} />}
    </div>
  );

  // The `ready` entry screen is the review panel on the right-hand side; the
  // chat stays on the left (split layout) just like the rest of onboarding.
  if (step === 'ready') {
    return <AgentProfileReadyStep />;
  }

  // When the wizard is on the 'identity' step, `EditPageLayout` guarantees that
  // every mandatory field is filled before the profile column is rendered, so
  // there is no preparing/skeleton state to handle here.
  if (step === 'identity') {
    return (
      <AgentProfileIdentityStep
        avatar={<AgentProfileAvatar disabled={isRunning} />}
        details={<AgentProfileDetails mode="highlighted" disabled={isRunning} />}
      />
    );
  }

  if (step === 'library') {
    return <AgentProfileLibraryStep agentId={agentId} />;
  }

  if (step === 'model') {
    return <AgentProfileModelStep />;
  }

  if (step === 'tools') {
    return <AgentProfileToolsStep />;
  }

  if (step === 'instructions') {
    return <AgentProfileInstructionsStep />;
  }

  if (step === 'skills') {
    return <AgentProfileSkillsStep />;
  }

  if (step === 'browser') {
    return <AgentProfileBrowserStep />;
  }

  if (step === 'integrations') {
    return <AgentProfileIntegrationsStep />;
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
