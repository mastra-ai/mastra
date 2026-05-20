import { Button, Skeleton } from '@mastra/playground-ui';
import type { ReactNode } from 'react';
import { useAgentColor } from '@/domains/agent-builder/contexts/agent-color-context';
import { useWizard } from '@/domains/agent-builder/contexts/wizard-context';
import { startViewTransition } from '@/lib/routing';

export interface AgentProfileInitialStepProps {
  avatar: ReactNode;
  details: ReactNode;
  isPreparing?: boolean;
}

export const AgentProfileInitialStep = ({ avatar, details, isPreparing }: AgentProfileInitialStepProps) => {
  const agentColor = useAgentColor();
  const { next } = useWizard();

  const handleContinue = () => {
    startViewTransition(() => {
      next();
    });
  };

  const bannerStyle = agentColor
    ? {
        backgroundImage: `linear-gradient(to bottom right, ${agentColor.background}, ${agentColor.foreground})`,
      }
    : undefined;

  return (
    <div className="relative w-full h-full border border-border1 bg-surface3 rounded-3xl overflow-hidden">
      {bannerStyle && (
        <div
          aria-hidden
          className={`absolute inset-0 rounded-3xl transition-opacity duration-500 ease-out ${
            isPreparing ? 'opacity-0' : 'opacity-100'
          }`}
          style={bannerStyle}
        />
      )}
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
            <Button onClick={handleContinue}>Continue</Button>
          </>
        )}
      </div>
    </div>
  );
};
