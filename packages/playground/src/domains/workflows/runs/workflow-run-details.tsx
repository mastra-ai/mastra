import { Skeleton, Txt } from '@mastra/playground-ui';
import { useContext } from 'react';
import type { WorkflowRunStreamResult } from '../context/workflow-run-context';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { convertWorkflowRunStateToStreamResult } from '../utils';
import type { WorkflowTriggerProps } from '../workflow/workflow-trigger';
import { WorkflowTrigger } from '../workflow/workflow-trigger';

export interface WorkflowRunDetailProps extends Omit<
  WorkflowTriggerProps,
  'paramsRunId' | 'workflowId' | 'observeWorkflowStream'
> {
  workflowId: string;
  runId?: string;
  observeWorkflowStream?: ({
    workflowId,
    runId,
    storeRunResult,
  }: {
    workflowId: string;
    runId: string;
    storeRunResult: WorkflowRunStreamResult | null;
  }) => void;
}

export const WorkflowRunDetail = ({
  workflowId,
  runId,
  observeWorkflowStream,
  ...triggerProps
}: WorkflowRunDetailProps) => {
  const { runSnapshot, isLoadingRunExecutionResult } = useContext(WorkflowRunContext);

  if (isLoadingRunExecutionResult) {
    return (
      <div className="p-4">
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  if (!runSnapshot || !runId) {
    return (
      <div className="p-4">
        <Txt variant="ui-md" className="text-neutral6 text-center">
          No previous run
        </Txt>
      </div>
    );
  }

  const runResult = convertWorkflowRunStateToStreamResult(runSnapshot);
  const runStatus = runResult?.status;

  if (runId) {
    return (
      <div className="h-full grid grid-rows-[1fr_auto]">
        <WorkflowTrigger
          {...triggerProps}
          paramsRunId={runId}
          workflowId={workflowId}
          observeWorkflowStream={() => {
            if (runStatus !== 'success' && runStatus !== 'failed' && runStatus !== 'canceled') {
              observeWorkflowStream?.({ workflowId, runId, storeRunResult: runResult });
            }
          }}
        />
      </div>
    );
  }
};
