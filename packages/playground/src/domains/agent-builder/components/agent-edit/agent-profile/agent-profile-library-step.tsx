import { Button } from '@mastra/playground-ui/components/Button';
import { IconArrowRight } from '@mastra/playground-ui/icons/central/IconArrowRight';
import { IconCheckmark1 } from '@mastra/playground-ui/icons/central/IconCheckmark1';
import { IconLibrary } from '@mastra/playground-ui/icons/central/IconLibrary';
import { IconPlusLarge } from '@mastra/playground-ui/icons/central/IconPlusLarge';
import { Icon } from '@mastra/playground-ui/icons/Icon';
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
            <IconArrowRight />
          </Icon>
        </Button>
      }
    >
      <div
        className="relative flex h-full w-full flex-col items-center justify-center gap-4 px-4 py-4 text-center"
        data-testid="agent-builder-library-step"
      >
        <Icon size="lg" className="text-muted-foreground">
          <IconLibrary />
        </Icon>
        {isInLibrary ? (
          <p className="flex items-center gap-2 text-placeholder" data-testid="agent-builder-library-added">
            <Icon>
              <IconCheckmark1 />
            </Icon>
            Added to your library
          </p>
        ) : (
          <Button
            icon={<IconPlusLarge />}
            variant="primary"
            onClick={() => requestChange('public')}
            disabled={isStreaming}
            data-testid="agent-builder-library-add"
          >
            Add to library
          </Button>
        )}
        <p className="max-w-md text-muted-foreground">
          You can change this at any time in the agent&apos;s visibility settings. Adding to the library now is
          optional.
        </p>
        {dialog}
      </div>
    </AgentStepContainer>
  );
};
