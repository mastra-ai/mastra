import { Loader2, PlayIcon, StepForwardIcon } from 'lucide-react';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';

export interface WorkflowDebugControlsProps {
  isStreaming?: boolean;
  disabled?: boolean;
  canRunNextStep: boolean;
  onRunNextStep: () => void;
  onContinueRun: () => void;
}

export function WorkflowDebugControls({
  isStreaming,
  disabled,
  canRunNextStep,
  onRunNextStep,
  onContinueRun,
}: WorkflowDebugControlsProps) {
  return (
    <div className="flex flex-col gap-2" data-testid="workflow-debug-step-controls">
      <Button
        type="button"
        variant="primary"
        className="w-full"
        onClick={onRunNextStep}
        disabled={disabled || !canRunNextStep || isStreaming}
      >
        {isStreaming ? (
          <Icon>
            <Loader2 className="animate-spin" />
          </Icon>
        ) : (
          <Icon>
            <PlayIcon />
          </Icon>
        )}
        Run next step
      </Button>

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={onContinueRun}
        disabled={disabled || isStreaming}
        icon={<StepForwardIcon />}
      >
        Continue full run
      </Button>
    </div>
  );
}
