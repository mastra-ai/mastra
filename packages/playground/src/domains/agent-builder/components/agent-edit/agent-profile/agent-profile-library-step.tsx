import { Button } from '@mastra/playground-ui/components/Button';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { ArrowRightIcon, CheckIcon, LibraryIcon } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import { AgentStepContainer } from './agent-step-container';
import { useStreamRunning } from '@/domains/agent-builder/contexts/stream-chat-context';
import { useWizard } from '@/domains/agent-builder/contexts/wizard-context';
import { useVisibilityChange } from '@/domains/agent-builder/hooks/use-visibility-change-agent';
import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';
import { startViewTransition } from '@/lib/routing';

export interface AgentProfileLibraryStepProps {
  agentId: string;
}

export const AgentProfileLibraryStep = ({ agentId }: AgentProfileLibraryStepProps) => {
  const { next } = useWizard();
  const isStreaming = useStreamRunning();
  const { requestChange, dialog } = useVisibilityChange(agentId);
  const { control } = useFormContext<AgentBuilderEditFormValues>();
  const visibility = useWatch({ control, name: 'visibility' });
  const isInLibrary = visibility === 'public';

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
        className="relative flex h-full w-full flex-col items-center justify-center gap-4 px-6 py-6 text-center"
        data-testid="agent-builder-library-step"
      >
        <Icon size="lg" className="text-neutral4">
          <LibraryIcon />
        </Icon>
        {isInLibrary ? (
          <p className="text-neutral2 flex items-center gap-2" data-testid="agent-builder-library-added">
            <Icon>
              <CheckIcon />
            </Icon>
            Added to your library
          </p>
        ) : (
          <Button
            variant="primary"
            onClick={() => requestChange('public')}
            disabled={isStreaming}
            data-testid="agent-builder-library-add"
          >
            Add to library
          </Button>
        )}
        <p className="text-neutral3 max-w-md">
          You can change this at any time from the agent&apos;s visibility settings — adding to the library now is
          optional.
        </p>
        {dialog}
      </div>
    </AgentStepContainer>
  );
};
