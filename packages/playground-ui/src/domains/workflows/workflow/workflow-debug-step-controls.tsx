import { useContext } from 'react';
import type { ReactNode } from 'react';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { useNextPerStep } from './use-workflow-trigger';
import { WorkflowDebugControls } from '@/ds/components/Workflow';

export interface WorkflowDebugStepControlsProps {
  isStreaming?: boolean;
  disabled?: boolean;
  children?: ReactNode;
  requestContext: Record<string, any>;
}

export function WorkflowDebugStepControls({
  isStreaming,
  disabled,
  children,
  requestContext,
}: WorkflowDebugStepControlsProps) {
  const { result } = useContext(WorkflowRunContext);
  const { canRunNextStep, nextStepLabel, runNextStep, continueFullRun } = useNextPerStep(requestContext);

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
