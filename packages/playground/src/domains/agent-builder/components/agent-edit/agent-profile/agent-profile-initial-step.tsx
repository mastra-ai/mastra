import { Button, Skeleton, Icon } from '@mastra/playground-ui';
import { ArrowRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useFormState } from 'react-hook-form';
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
  const { dirtyFields } = useFormState();

  console.log('lol', isStreaming);

  const isReady = !isStreaming && Boolean(dirtyFields.name) && Boolean(dirtyFields.description);

  const handleContinue = () => {
    startViewTransition(() => {
      next();
    });
  };

  return (
    <AgentStepContainer
      cta={
        isReady ? (
          <Button onClick={handleContinue} className="animate-in fade-in duration-300">
            Continue{' '}
            <Icon>
              <ArrowRightIcon />
            </Icon>
          </Button>
        ) : null
      }
    >
      <div className="relative w-full h-full flex flex-col items-center justify-center gap-4 py-6 px-6 text-center">
        {!isReady ? (
          <>
            <div className="rounded-full bg-surface3 p-1 animate-in fade-in duration-300 fill-mode-both">
              <Skeleton className="h-avatar-lg w-avatar-lg rounded-full" />
            </div>
            <div className="flex w-full flex-col items-center gap-0.5">
              <div
                className="px-3 py-1.5 animate-in fade-in duration-300 delay-[100ms] fill-mode-both"
                data-testid="agent-profile-initial-step-name-skeleton"
              >
                <Skeleton className="h-7 w-48 rounded-lg" />
              </div>
              <div
                className="px-3 py-2 animate-in fade-in duration-300 delay-[150ms] fill-mode-both"
                data-testid="agent-profile-initial-step-description-skeleton"
              >
                <Skeleton className="h-12 w-72 rounded-lg" />
              </div>
            </div>
            <Skeleton className="h-9 w-24 rounded-md animate-in fade-in duration-300 fill-mode-both" />
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
