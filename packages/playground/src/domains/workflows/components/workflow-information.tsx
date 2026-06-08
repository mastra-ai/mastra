import {
  Badge,
  Button,
  Icon,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useCopyToClipboard,
  toast,
} from '@mastra/playground-ui';
import { CopyIcon, Cpu, Plus } from 'lucide-react';
import { useState, useEffect, useContext } from 'react';

import { WorkflowRunContext } from '../context/workflow-run-context';
import { useWorkflowStepDetail } from '../context/workflow-step-detail-context';
import { WorkflowRunDetail } from '../runs/workflow-run-details';
import { WorkflowTrigger } from '../workflow/workflow-trigger';
import { WorkflowStepDetailContent } from './workflow-step-detail';

import { useWorkflow } from '@/hooks/use-workflows';
import { useLinkComponent } from '@/lib/framework';

export interface WorkflowInformationProps {
  workflowId: string;
  initialRunId?: string;
}

export function WorkflowInformation({ workflowId, initialRunId }: WorkflowInformationProps) {
  const { data: workflow, isLoading, error } = useWorkflow(workflowId);

  const { Link, paths } = useLinkComponent();

  const {
    createWorkflowRun,
    streamWorkflow,
    streamResult,
    isStreamingWorkflow,
    observeWorkflowStream,
    closeStreamsAndReset,
    resumeWorkflow,
    cancelWorkflowRun,
    isCancellingWorkflowRun,
    clearData,
    setRunId: setContextRunId,
  } = useContext(WorkflowRunContext);

  const { stepDetail } = useWorkflowStepDetail();

  const [runId, setRunId] = useState<string>('');
  const { handleCopy } = useCopyToClipboard({ text: workflowId });

  const stepsCount = Object.keys(workflow?.steps ?? {}).length;
  const isCurrentRunFinished = ['success', 'failed', 'canceled', 'bailed'].includes(streamResult?.status ?? '');
  const showNewRunButton = Boolean(initialRunId) || isCurrentRunFinished;

  useEffect(() => {
    if (!runId && !initialRunId) {
      closeStreamsAndReset();
    }
    // Only react to run identity changes. `closeStreamsAndReset` comes from context
    // and is intentionally excluded to avoid refiring on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, initialRunId]);

  useEffect(() => {
    if (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load workflow';
      toast.error(`Error loading workflow: ${errorMessage}`);
    }
  }, [error]);

  if (error) {
    return null;
  }

  return (
    <div className="h-full w-full p-2">
      <div className="h-full min-w-0 w-full bg-surface3 rounded-studio-panel border border-border1/50 overflow-hidden">
        <ScrollArea className="h-full w-full" viewPortClassName="h-full" mask={{ top: false }}>
          <div className="sticky top-0 z-10 bg-surface3">
            <div className="border-b border-border1/50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" onClick={handleCopy} className="h-badge-default">
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

                {workflow?.isProcessorWorkflow && (
                  <Badge icon={<Cpu className="h-3 w-3" />} className="bg-violet-500/20 text-violet-400">
                    Processor
                  </Badge>
                )}
              </div>
            </div>

            {showNewRunButton && (
              <div className="border-b border-border1/50 px-4 py-4">
                <Button
                  as={Link}
                  to={paths.workflowLink(workflowId)}
                  variant="default"
                  className="w-full"
                  onClick={() => {
                    closeStreamsAndReset();
                    clearData();
                    setRunId('');
                    setContextRunId('');
                  }}
                >
                  <Icon>
                    <Plus />
                  </Icon>
                  New workflow run
                </Button>
              </div>
            )}
          </div>

          <div className="relative">
            {stepDetail ? (
              <WorkflowStepDetailContent />
            ) : workflowId ? (
              initialRunId ? (
                <WorkflowRunDetail
                  workflowId={workflowId}
                  runId={initialRunId}
                  setRunId={setRunId}
                  workflow={workflow ?? undefined}
                  isLoading={isLoading}
                  createWorkflowRun={createWorkflowRun}
                  streamWorkflow={streamWorkflow}
                  resumeWorkflow={resumeWorkflow}
                  streamResult={streamResult}
                  isStreamingWorkflow={isStreamingWorkflow}
                  isCancellingWorkflowRun={isCancellingWorkflowRun}
                  cancelWorkflowRun={cancelWorkflowRun}
                  observeWorkflowStream={observeWorkflowStream}
                />
              ) : (
                <WorkflowTrigger
                  workflowId={workflowId}
                  setRunId={setRunId}
                  workflow={workflow ?? undefined}
                  isLoading={isLoading}
                  createWorkflowRun={createWorkflowRun}
                  streamWorkflow={streamWorkflow}
                  resumeWorkflow={resumeWorkflow}
                  streamResult={streamResult}
                  isStreamingWorkflow={isStreamingWorkflow}
                  isCancellingWorkflowRun={isCancellingWorkflowRun}
                  cancelWorkflowRun={cancelWorkflowRun}
                />
              )
            ) : null}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
