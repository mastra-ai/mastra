import { useState, useEffect } from 'react';

import {
  Badge,
  WorkflowIcon,
  WorkflowTrigger,
  EntityHeader,
  useWorkflow,
  WorkflowRunDetail,
} from '@mastra/playground-ui';

import { useExecuteWorkflow, useStreamWorkflow, useCancelWorkflowRun } from '@/hooks/use-workflows';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { CopyIcon } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useParams } from 'react-router';

export function WorkflowInformation({ workflowId }: { workflowId: string }) {
  const params = useParams();
  const { data: workflow, isLoading } = useWorkflow(workflowId);

  const { createWorkflowRun } = useExecuteWorkflow();
  const {
    streamWorkflow,
    streamResult,
    isStreaming,
    observeWorkflowStream,
    closeStreamsAndReset,
    resumeWorkflowStream,
  } = useStreamWorkflow();
  const { mutateAsync: cancelWorkflowRun, isPending: isCancellingWorkflowRun } = useCancelWorkflowRun();

  const [runId, setRunId] = useState<string>('');
  const { handleCopy } = useCopyToClipboard({ text: workflowId });

  const stepsCount = Object.keys(workflow?.steps ?? {}).length;

  useEffect(() => {
    if (!runId && !params?.runId) {
      closeStreamsAndReset();
    }
  }, [runId, params]);

  return (
    <div className="grid grid-rows-[auto_1fr] h-full overflow-y-auto border-l-sm border-border1">
      <EntityHeader icon={<WorkflowIcon />} title={workflow?.name || ''} isLoading={isLoading}>
        <div className="flex items-center gap-2 pt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={handleCopy} className="h-badge-default">
                <Badge icon={<CopyIcon />} variant="default">
                  {workflowId}
                </Badge>
              </button>
            </TooltipTrigger>
            <TooltipContent>Copy Workflow ID for use in code</TooltipContent>
          </Tooltip>

          <Badge>
            {stepsCount} step{stepsCount > 1 ? 's' : ''}
          </Badge>
        </div>
      </EntityHeader>

      <div className="overflow-y-auto border-t-sm border-border1">
        {workflowId ? (
          params?.runId ? (
            <WorkflowRunDetail
              workflowId={workflowId}
              runId={params?.runId}
              setRunId={setRunId}
              workflow={workflow ?? undefined}
              isLoading={isLoading}
              createWorkflowRun={createWorkflowRun.mutateAsync}
              streamWorkflow={streamWorkflow.mutateAsync}
              resumeWorkflow={resumeWorkflowStream.mutateAsync}
              streamResult={streamResult}
              isStreamingWorkflow={isStreaming}
              isCancellingWorkflowRun={isCancellingWorkflowRun}
              cancelWorkflowRun={cancelWorkflowRun}
              observeWorkflowStream={observeWorkflowStream.mutate}
            />
          ) : (
            <WorkflowTrigger
              workflowId={workflowId}
              setRunId={setRunId}
              workflow={workflow ?? undefined}
              isLoading={isLoading}
              createWorkflowRun={createWorkflowRun.mutateAsync}
              streamWorkflow={streamWorkflow.mutateAsync}
              resumeWorkflow={resumeWorkflowStream.mutateAsync}
              streamResult={streamResult}
              isStreamingWorkflow={isStreaming}
              isCancellingWorkflowRun={isCancellingWorkflowRun}
              cancelWorkflowRun={cancelWorkflowRun}
            />
          )
        ) : null}
      </div>
    </div>
  );
}
