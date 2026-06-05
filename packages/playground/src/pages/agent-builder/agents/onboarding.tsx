import { Button, Spinner } from '@mastra/playground-ui';
import { useState } from 'react';
import { FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import { Navigate, useNavigate, useParams } from 'react-router';
import { ConversationPanelChat } from '@/domains/agent-builder/components/agent-edit/conversation-panel';
import { EditTopBar } from '@/domains/agent-builder/components/agent-edit/edit-top-bar';
import { AgentColorProvider } from '@/domains/agent-builder/contexts/agent-color-context';
import { AgentPrimitivesProvider, useAgentPrimitives } from '@/domains/agent-builder/contexts/agent-primitives-context';
import { EditPageProvider, useEditPage } from '@/domains/agent-builder/contexts/edit-page-context';
import { useStreamRunning } from '@/domains/agent-builder/contexts/stream-chat-context';
import { WizardProvider } from '@/domains/agent-builder/contexts/wizard-context';
import { useAvailableAgentTools } from '@/domains/agent-builder/hooks/use-available-agent-tools';
import { AgentBuilderEditLayout } from '@/domains/agent-builder/layouts/agent-builder-edit-layout';
import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';
import { storedAgentToFormValues } from '@/domains/agent-builder/services/stored-agent-to-form-values';

/**
 * Standalone onboarding page shown right after the creation workflow finishes.
 * It mirrors the edit page's provider stack but stays in a centered
 * "review your new agent" experience: the user can chat with the freshly
 * created agent and then choose to view it or jump into full configuration.
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

const OnboardingLayout = () => {
  return (
    <AgentBuilderEditLayout
      topBar={<EditTopBar isLoading={false} />}
      chat={<ConversationPanelChat />}
      chatFooter={<OnboardingCtas />}
      profile={null}
      variant="centered"
    />
  );
};

const OnboardingCtas = () => {
  const navigate = useNavigate();
  const { agentId } = useEditPage();
  const isRunning = useStreamRunning();

  return (
    <div className="flex flex-col gap-2" data-testid="agent-builder-onboarding-ctas">
      <Button
        variant="primary"
        disabled={isRunning}
        onClick={() => navigate(`/agent-builder/agents/${agentId}/view`, { viewTransition: true })}
        data-testid="agent-builder-onboarding-cta-view"
      >
        View agent
      </Button>
      <Button
        variant="outline"
        disabled={isRunning}
        onClick={() => navigate(`/agent-builder/agents/${agentId}/edit`, { viewTransition: true })}
        data-testid="agent-builder-onboarding-cta-config"
      >
        Review config
      </Button>
    </div>
  );
};

const AgentBuilderOnboardingSkeleton = () => (
  <div className="h-screen w-screen flex items-center justify-center">
    <Spinner />
  </div>
);
