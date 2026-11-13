import { Button } from '@mastra/playground-ui/components/Button';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { startViewTransition } from '@mastra/playground-ui/lib/view-transition';
import { ArrowRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { AgentStepContainer } from './agent-step-container';
import { useStreamRunning } from '@/domains/agent-builder/contexts/stream-chat-context';
import { useWizard } from '@/domains/agent-builder/contexts/wizard-context';

export interface AgentProfileIdentityStepProps {
  avatar: ReactNode;
  details: ReactNode;
}

export const AgentProfileIdentityStep = ({ avatar, details }: AgentProfileIdentityStepProps) => {
  const { next } = useWizard();
  const isStreaming = useStreamRunning();

  const handleContinue = () => {
    startViewTransition(() => {
      next();
    });
  };

  return (
    <AgentStepContainer
      cta={
        <Button onClick={handleContinue} disabled={isStreaming}>
          Continue{' '}
          <Icon>
            <ArrowRightIcon />
          </Icon>
        </Button>
      }
    >
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-4 px-4 py-4 text-center">
        {avatar}
        {details}
      </div>
    </AgentStepContainer>
  );
};
