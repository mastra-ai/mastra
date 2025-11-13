import { Skeleton } from '@/components/ui/skeleton';
import { Txt } from '@/ds/components/Txt';

import { useWorkflowRunExecutionResult } from '@/hooks/use-workflow-runs';
import { WorkflowTrigger, WorkflowTriggerProps } from '../workflow/workflow-trigger';
import { convertWorkflowRunStateToStreamResult } from '../utils';

import { WorkflowRunStreamResult } from '../context/workflow-run-context';
import { WorkflowRunState } from '@mastra/core/workflows';

export interface WorkflowRunDetailProps
  extends Omit<WorkflowTriggerProps, 'paramsRunId' | 'workflowId' | 'observeWorkflowStream'> {
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
  const { isLoading, data: runExecutionResult } = useWorkflowRunExecutionResult(workflowId, runId ?? '');

  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  if (!runExecutionResult || !runId) {
    return (
      <div className="p-4">
        <Txt variant="ui-md" className="text-icon6 text-center">
          No previous run
        </Txt>
      </div>
    );
  }

  const runResult = convertWorkflowRunStateToStreamResult({
    context: {
      input: runExecutionResult.payload,
      ...runExecutionResult.steps,
    } as any,
    status: runExecutionResult.status,
    result: runExecutionResult.result,
    error: runExecutionResult.error,
    runId,
  } as WorkflowRunState);
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
