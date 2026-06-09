import { Button, Icon } from '@mastra/playground-ui';
import { ArrowRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { AgentStepContainer } from './agent-step-container';
import { useStreamRunning } from '@/domains/agent-builder/contexts/stream-chat-context';
import { useWizard } from '@/domains/agent-builder/contexts/wizard-context';
import { startViewTransition } from '@/lib/routing';

export interface AgentProfileInitialStepProps {
  avatar: ReactNode;
  details: ReactNode;
}

export const AgentProfileInitialStep = ({ avatar, details }: AgentProfileInitialStepProps) => {
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
      <div className="relative w-full h-full flex flex-col items-center justify-center gap-4 py-6 px-6 text-center">
        {avatar}
        {details}
      </div>
    </AgentStepContainer>
  );
};
