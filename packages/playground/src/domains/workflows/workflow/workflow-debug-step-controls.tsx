import { WorkflowDebugControls } from '@mastra/playground-ui/components/Workflow';
import { useContext } from 'react';
import type { ReactNode } from 'react';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { useNextPerStep } from './use-workflow-trigger';

export interface WorkflowDebugStepControlsProps {
  isStreaming?: boolean;
  disabled?: boolean;
  children?: ReactNode;
}

export function WorkflowDebugStepControls({ isStreaming, disabled, children }: WorkflowDebugStepControlsProps) {
  const { result } = useContext(WorkflowRunContext);
  const { canRunNextStep, nextStepLabel, runNextStep, continueFullRun } = useNextPerStep();

  if (result?.status !== 'paused') return null;

  return (
    <WorkflowDebugControls
      isStreaming={isStreaming}
      canRunNextStep={canRunNextStep}
      nextStepLabel={nextStepLabel}
      disabled={disabled}
      onRunNextStep={runNextStep}
      onContinueRun={continueFullRun}
    >
      {children}
    </WorkflowDebugControls>
  );
}
