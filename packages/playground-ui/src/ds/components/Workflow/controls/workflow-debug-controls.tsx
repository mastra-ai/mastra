import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { IconPause } from '@/ds/icons/central/IconPause';
import { IconPlay } from '@/ds/icons/central/IconPlay';
import { IconStepForwards } from '@/ds/icons/central/IconStepForwards';

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
      <div className="rounded-xl border border-surface-rim bg-background p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <Txt as="span" variant="meta" tone="muted">
            Next step
          </Txt>
          <Badge size="sm" icon={<IconPause />} emphasis="subtle">
            Step by step
          </Badge>
        </div>
        <div className="text-subheading break-words text-foreground" aria-live="polite">
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
          icon={isStreaming ? <Loader2 className="motion-safe:animate-spin" /> : <IconStepForwards />}
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
          <IconPlay />
        </Button>
        {children}
      </div>
    </div>
  );
}
