import { Button, Skeleton, Icon } from '@mastra/playground-ui';
import { ArrowRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { AgentStepContainer } from './agent-step-container';
import { useStreamRunning } from '@/domains/agent-builder/contexts/stream-chat-context';
import { useWizard } from '@/domains/agent-builder/contexts/wizard-context';
import { startViewTransition } from '@/lib/routing';

export interface AgentProfileInitialStepProps {
  avatar: ReactNode;
  details: ReactNode;
  isPreparing?: boolean;
}

export const AgentProfileInitialStep = ({ avatar, details, isPreparing }: AgentProfileInitialStepProps) => {
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
        {isPreparing ? (
          <>
            <div className="rounded-full bg-surface3 p-1">
              <Skeleton className="h-avatar-lg w-avatar-lg rounded-full" />
            </div>
            <div className="flex w-full flex-col items-center gap-0.5">
              <div className="px-3 py-1.5">
                <Skeleton className="h-7 w-48 rounded-lg" />
              </div>
              <div className="px-3 py-2">
                <Skeleton className="h-12 w-72 rounded-lg" />
              </div>
            </div>
            <Skeleton className="h-9 w-24 rounded-md" />
          </>
        ) : (
          <>
            {avatar}
            {details}
          </>
        )}
      </div>
    </AgentStepContainer>
  );
};
