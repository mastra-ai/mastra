import { WorkflowDebugControls } from '@mastra/playground-ui/components/Workflow';
import { useContext } from 'react';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { useNextPerStep } from './use-workflow-trigger';

export interface WorkflowDebugStepControlsProps {
  isStreaming?: boolean;
}

export function WorkflowDebugStepControls({ isStreaming }: WorkflowDebugStepControlsProps) {
  const { result } = useContext(WorkflowRunContext);
  const { canRunNextStep, runNextStep, continueFullRun } = useNextPerStep();

  if (result?.status !== 'paused') return null;

  return (
    <WorkflowDebugControls
      isStreaming={isStreaming}
      canRunNextStep={canRunNextStep}
      onRunNextStep={runNextStep}
      onContinueRun={continueFullRun}
    />
  );
}
