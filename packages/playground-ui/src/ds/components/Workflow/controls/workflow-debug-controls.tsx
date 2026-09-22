import { Loader2, Pause, PlayIcon, StepForwardIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';

export interface WorkflowDebugControlsProps {
  isStreaming?: boolean;
  canRunNextStep: boolean;
  nextStepLabel?: string;
  disabled?: boolean;
  children?: ReactNode;
  onRunNextStep: () => void;
  onContinueRun: () => void;
}

export function WorkflowDebugControls({
  isStreaming,
  canRunNextStep,
  nextStepLabel,
  disabled,
  children,
  onRunNextStep,
  onContinueRun,
}: WorkflowDebugControlsProps) {
  const nextStepFallback = canRunNextStep ? 'Ready to advance' : 'Next step unavailable';
  const actionsDisabled = !canRunNextStep || isStreaming || disabled;

  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid="workflow-debug-step-controls">
      <div className="border-border/50 bg-background rounded-xl border p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-meta text-muted-foreground">Next step</span>
          <Badge size="sm" icon={<Pause />} emphasis="muted">
            Step by step
          </Badge>
        </div>
        <div className="text-subheading text-foreground break-words" aria-live="polite">
          {nextStepLabel || nextStepFallback}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="primary"
          className="min-w-0 flex-1"
          aria-label="Run next step"
          onClick={onRunNextStep}
          disabled={actionsDisabled}
          icon={isStreaming ? <Loader2 className="motion-safe:animate-spin" /> : <StepForwardIcon />}
        >
          {isStreaming ? 'Running step…' : 'Run next step'}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-md"
          tooltip="Continue full run"
          onClick={onContinueRun}
          disabled={actionsDisabled}
        >
          <PlayIcon />
        </Button>
        {children}
      </div>
    </div>
  );
}
