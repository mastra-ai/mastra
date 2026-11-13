import { Button } from '@mastra/playground-ui/components/Button';
import { Icon } from '@mastra/playground-ui/icons/Icon';

import { startViewTransition } from '@mastra/playground-ui/lib/view-transition';
import { ArrowRightIcon } from 'lucide-react';
import { AgentStepContainer } from './agent-step-container';
import { Integrations } from './integrations';
import { useEditPage } from '@/domains/agent-builder/contexts/edit-page-context';
import { useStreamRunning } from '@/domains/agent-builder/contexts/stream-chat-context';
import { useWizard } from '@/domains/agent-builder/contexts/wizard-context';

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
        <Button onClick={handleContinue} disabled={isStreaming}>
          Continue{' '}
          <Icon>
            <ArrowRightIcon />
          </Icon>
        </Button>
      }
    >
      <Integrations agentId={agentId} editable={!isStreaming} />
    </AgentStepContainer>
  );
};
