import { Button } from '@mastra/playground-ui/components/Button';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { ArrowRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { AgentStepContainer } from './agent-step-container';
import { useStreamRunning } from '@/domains/agent-builder/contexts/stream-chat-context';
import { useWizard } from '@/domains/agent-builder/contexts/wizard-context';
import { startViewTransition } from '@/lib/routing';

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
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-4 px-6 py-6 text-center">
        {avatar}
        {details}
      </div>
    </AgentStepContainer>
  );
};
