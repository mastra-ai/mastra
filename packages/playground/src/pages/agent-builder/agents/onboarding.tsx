import { Spinner } from '@mastra/playground-ui';
import { useState } from 'react';
import { FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import { Navigate, useParams } from 'react-router';
import {
  AgentProfile,
  AgentProfileAvatar,
  AgentProfileBrowserStep,
  AgentProfileDetails,
  AgentProfileHero,
  AgentProfileInitialStep,
  AgentProfileInstructionsStep,
  AgentProfileIntegrationsStep,
  AgentProfileModelStep,
  AgentProfileSkillsStep,
  AgentProfileTabs,
  AgentProfileToolsStep,
} from '@/domains/agent-builder/components/agent-edit/agent-profile';
import { EditTopBar } from '@/domains/agent-builder/components/agent-edit/edit-top-bar';
import { AgentColorProvider } from '@/domains/agent-builder/contexts/agent-color-context';
import { AgentPrimitivesProvider, useAgentPrimitives } from '@/domains/agent-builder/contexts/agent-primitives-context';
import { EditPageProvider, useEditPage } from '@/domains/agent-builder/contexts/edit-page-context';
import { useStreamRunning } from '@/domains/agent-builder/contexts/stream-chat-context';
import { useWizard, WizardProvider } from '@/domains/agent-builder/contexts/wizard-context';
import { useAvailableAgentTools } from '@/domains/agent-builder/hooks/use-available-agent-tools';
import { AgentBuilderEditLayout } from '@/domains/agent-builder/layouts/agent-builder-edit-layout';
import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';
import { storedAgentToFormValues } from '@/domains/agent-builder/services/stored-agent-to-form-values';

/**
 * Standalone onboarding page shown right after the creation workflow finishes.
 * It mirrors the edit page's provider stack but stays in a centered,
 * low-noise review flow so the user can inspect each section one by one.
 */
export default function AgentBuilderAgentOnboarding() {
  const { id } = useParams<{ id: string }>();

  return (
    <AgentPrimitivesProvider agentId={id!}>
      <OnboardingGate />
    </AgentPrimitivesProvider>
  );
}

const OnboardingGate = () => {
  const { agentId, storedAgent, isReady, isOwner, canWrite } = useAgentPrimitives();

  if (!isReady) return <AgentBuilderOnboardingSkeleton />;
  if (!storedAgent) return <Navigate to="/agent-builder/agents" replace />;
  if (!canWrite || !isOwner) return <Navigate to={`/agent-builder/agents/${agentId}/view`} replace />;

  return (
    <WizardProvider initialStep="initial">
      <OnboardingForm />
    </WizardProvider>
  );
};

const OnboardingForm = () => {
  const { agentId, storedAgent } = useAgentPrimitives();
  const [defaultValues] = useState(() => storedAgentToFormValues(storedAgent));
  const formMethods = useForm<AgentBuilderEditFormValues>({ defaultValues });

  return (
    <FormProvider {...formMethods}>
      <AgentColorProvider agentId={agentId}>
        <OnboardingBody />
      </AgentColorProvider>
    </FormProvider>
  );
};

const OnboardingBody = () => {
  const { agentId, storedAgent, toolsData, agentsData, workflowsData } = useAgentPrimitives();
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

  return (
    <EditPageProvider storedAgent={storedAgent!} availableAgentTools={availableAgentTools} onModeToggle={undefined}>
      <OnboardingLayout />
    </EditPageProvider>
  );
};

const OnboardingLayout = () => (
  <AgentBuilderEditLayout
    topBar={<EditTopBar isLoading={false} />}
    profile={<OnboardingProfileSlot />}
    variant="profile-centered"
  />
);

const OnboardingProfileSlot = () => {
  const { agentId, availableAgentTools, availableSkills } = useEditPage();
  const isRunning = useStreamRunning();
  const { step } = useWizard();

  if (step === 'initial') {
    return (
      <AgentProfileInitialStep
        avatar={<AgentProfileAvatar disabled={isRunning} />}
        details={<AgentProfileDetails disabled={isRunning} mode="highlighted" />}
      />
    );
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

const AgentBuilderOnboardingSkeleton = () => (
  <div className="h-screen w-screen flex items-center justify-center">
    <Spinner />
  </div>
);
