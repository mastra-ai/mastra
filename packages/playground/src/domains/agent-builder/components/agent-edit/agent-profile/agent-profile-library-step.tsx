import { Button, Icon } from '@mastra/playground-ui';
import { ArrowRightIcon, LibraryIcon } from 'lucide-react';
import { AgentStepContainer } from './agent-step-container';
import { useStreamRunning } from '@/domains/agent-builder/contexts/stream-chat-context';
import { useWizard } from '@/domains/agent-builder/contexts/wizard-context';
import { startViewTransition } from '@/lib/routing';

export const AgentProfileLibraryStep = () => {
  const { next } = useWizard();
  const isStreaming = useStreamRunning();

  const handleContinue = () => {
    startViewTransition(() => {
      next();
    });
  };

  return (
    <AgentStepContainer
      title="Add to your library"
      description="Adding your agent to the library makes it visible to everyone in your workspace, so teammates can discover it, try it out, and copy it as a starting point for their own agents."
      cta={
        <Button onClick={handleContinue} disabled={isStreaming}>
          Continue{' '}
          <Icon>
            <ArrowRightIcon />
          </Icon>
        </Button>
      }
    >
      <div
        className="relative w-full h-full flex flex-col items-center justify-center gap-4 py-6 px-6 text-center"
        data-testid="agent-builder-library-step"
      >
        <Icon size="lg" className="text-neutral4">
          <LibraryIcon />
        </Icon>
        <p className="text-neutral3 max-w-md">
          You can change this at any time from the agent&apos;s visibility settings — adding to the library now is
          optional.
        </p>
      </div>
    </AgentStepContainer>
  );
};
