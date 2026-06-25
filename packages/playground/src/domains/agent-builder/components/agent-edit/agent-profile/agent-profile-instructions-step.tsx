import { Icon } from '@mastra/playground-ui';
import { Button } from '@mastra/playground-ui/components/Button';

import { ArrowRightIcon } from 'lucide-react';
import { AgentStepContainer } from './agent-step-container';
import { Instructions } from './instructions';
import { useStreamRunning } from '@/domains/agent-builder/contexts/stream-chat-context';
import { useWizard } from '@/domains/agent-builder/contexts/wizard-context';
import { startViewTransition } from '@/lib/routing';

export const AgentProfileInstructionsStep = () => {
  const { next } = useWizard();
  const isStreaming = useStreamRunning();

  const handleContinue = () => {
    startViewTransition(() => {
      next();
    });
  };

  return (
    <AgentStepContainer
      title="Instructions"
      cta={
        <Button onClick={handleContinue} disabled={isStreaming}>
          Continue{' '}
          <Icon>
            <ArrowRightIcon />
          </Icon>
        </Button>
      }
    >
      <Instructions editable={!isStreaming} />
    </AgentStepContainer>
  );
};
