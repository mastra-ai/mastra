import { Button } from '@mastra/playground-ui/components/Button';
import { IconArrowRight } from '@mastra/playground-ui/icons/central/IconArrowRight';
import { AgentStepContainer } from './agent-step-container';
import { Integrations } from './integrations';
import { useEditPage } from '@/domains/agent-builder/contexts/edit-page-context';
import { useStreamRunning } from '@/domains/agent-builder/contexts/stream-chat-context';
import { useWizard } from '@/domains/agent-builder/contexts/wizard-context';
import { startViewTransition } from '@/lib/routing';

export const AgentProfileIntegrationsStep = () => {
  const { agentId } = useEditPage();
  const { next } = useWizard();
  const isStreaming = useStreamRunning();

  const handleContinue = () => {
    startViewTransition(() => {
      next();
    });
  };

  return (
    <AgentStepContainer
      title="Integrations"
      cta={
        <Button iconEnd={<IconArrowRight />} onClick={handleContinue} disabled={isStreaming}>
          Continue
        </Button>
      }
    >
      <Integrations agentId={agentId} editable={!isStreaming} />
    </AgentStepContainer>
  );
};
