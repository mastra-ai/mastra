import { Button } from '@mastra/playground-ui/components/Button';
import { IconArrowRight } from '@mastra/playground-ui/icons/central/IconArrowRight';
import { AgentStepContainer } from './agent-step-container';
import { Browser } from './browser';
import { useStreamRunning } from '@/domains/agent-builder/contexts/stream-chat-context';
import { useWizard } from '@/domains/agent-builder/contexts/wizard-context';
import { startViewTransition } from '@/lib/routing';

export const AgentProfileBrowserStep = () => {
  const { next } = useWizard();
  const isStreaming = useStreamRunning();

  const handleContinue = () => {
    startViewTransition(() => {
      next();
    });
  };

  return (
    <AgentStepContainer
      title="Browser"
      cta={
        <Button iconEnd={<IconArrowRight />} onClick={handleContinue} disabled={isStreaming}>
          Continue
        </Button>
      }
    >
      <Browser editable={!isStreaming} />
    </AgentStepContainer>
  );
};
