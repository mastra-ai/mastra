import { Button } from '@mastra/playground-ui/components/Button';
import { Kbd } from '@mastra/playground-ui/components/Kbd';
import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';
import { Play } from 'lucide-react';

export const RUN_EXPERIMENT_SHORTCUT = 'r';

interface RunExperimentButtonProps {
  onClick: () => void;
}

/** "Run experiment" action bound to `R`. Mount at most one per view. */
export function RunExperimentButton({ onClick }: RunExperimentButtonProps) {
  useKeydown({ [RUN_EXPERIMENT_SHORTCUT]: onClick });

  return (
    <Button
      variant="ghost"
      size="sm"
      type="button"
      icon={<Play />}
      tooltip={
        <span className="inline-flex items-center gap-1.5">
          Run an experiment against this agent
          <Kbd size="xs">R</Kbd>
        </span>
      }
      onClick={onClick}
    >
      Run experiment
    </Button>
  );
}
