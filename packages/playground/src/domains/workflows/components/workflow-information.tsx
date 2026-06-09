import { Button, Icon, ScrollArea, toast } from '@mastra/playground-ui';
import { Plus } from 'lucide-react';
import { useState, useEffect, useContext } from 'react';

import { WorkflowRunContext } from '../context/workflow-run-context';
import { WorkflowRunDetail } from '../runs/workflow-run-details';
import { WorkflowTrigger } from '../workflow/workflow-trigger';

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

  const [runId, setRunId] = useState<string>('');

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
            {workflowId ? (
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
