import { Button, Icon } from '@mastra/playground-ui';

import { ArrowRightIcon } from 'lucide-react';
import { AgentStepContainer } from './agent-step-container';
import { Tools } from './tools';
import { useEditPage } from '@/domains/agent-builder/contexts/edit-page-context';
import { useStreamRunning } from '@/domains/agent-builder/contexts/stream-chat-context';
import { useWizard } from '@/domains/agent-builder/contexts/wizard-context';
import { startViewTransition } from '@/lib/routing';

export const AgentProfileToolsStep = () => {
  const { availableAgentTools } = useEditPage();
  const { next } = useWizard();
  const isStreaming = useStreamRunning();

  const handleContinue = () => {
    startViewTransition(() => {
      next();
    });
  };

  return (
    <AgentStepContainer
      title="Available tools"
      cta={
        <Button onClick={handleContinue} disabled={isStreaming}>
          Continue{' '}
          <Icon>
            <ArrowRightIcon />
          </Icon>
        </Button>
      }
    >
      <Tools availableAgentTools={availableAgentTools} editable={!isStreaming} />
    </AgentStepContainer>
  );
};
