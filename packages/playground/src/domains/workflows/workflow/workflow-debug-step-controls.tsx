import { Icon } from '@mastra/playground-ui';
import { Button } from '@mastra/playground-ui/components/Button';
import { Loader2, PlayIcon, StepForwardIcon } from 'lucide-react';
import { useContext } from 'react';

import { WorkflowRunContext } from '../context/workflow-run-context';
import { useNextPerStep } from './use-workflow-trigger';

export interface WorkflowDebugStepControlsProps {
  isStreaming?: boolean;
}

export function WorkflowDebugStepControls({ isStreaming }: WorkflowDebugStepControlsProps) {
  const { result } = useContext(WorkflowRunContext);
  const { canRunNextStep, runNextStep, continueFullRun } = useNextPerStep();

  // A run only reaches the 'paused' status when it was started in per-step (debug) mode, so a
  // paused run always shows the step controls — including when landing directly on a paused
  // run's :runId page, where the in-memory debugMode flag starts out false.
  if (result?.status !== 'paused') {
    return null;
  }

  return (
    <div className="flex flex-col gap-2" data-testid="workflow-debug-step-controls">
      <Button
        type="button"
        variant="primary"
        className="w-full"
        onClick={runNextStep}
        disabled={!canRunNextStep || isStreaming}
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

      <Button type="button" variant="ghost" className="w-full" onClick={continueFullRun} disabled={isStreaming}>
        <Icon>
          <StepForwardIcon />
        </Icon>
        Continue full run
      </Button>
    </div>
  );
}
