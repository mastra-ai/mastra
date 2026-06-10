import { Button, Icon, ScrollArea, toast } from '@mastra/playground-ui';
import { Plus } from 'lucide-react';
import { useState, useEffect, useContext } from 'react';

import { WorkflowRunContext } from '../context/workflow-run-context';
import { WorkflowRunDetail } from '../runs/workflow-run-details';
import { WorkflowRecentRuns } from '../runs/workflow-run-list';
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
    runId: contextRunId,
  } = useContext(WorkflowRunContext);

  const [runId, setRunId] = useState<string>('');

  const isCurrentRunFinished = ['success', 'failed', 'canceled', 'bailed'].includes(streamResult?.status ?? '');
  const showNewRunButton =
    Boolean(initialRunId || runId || contextRunId || isStreamingWorkflow) || isCurrentRunFinished;

  useEffect(() => {
    if (!runId && !initialRunId) {
      closeStreamsAndReset();
    }
  }, [runId, initialRunId, closeStreamsAndReset]);

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
    <div data-testid="workflow-information-panel" className="flex h-full min-h-0 w-full flex-col gap-2 p-2">
      {workflowId ? (
        <>
          <section
            data-testid="workflow-information-top-section"
            className="flex max-h-[50%] min-w-0 flex-none flex-col overflow-hidden rounded-studio-panel border border-border1/50 bg-surface3"
          >
            {showNewRunButton && (
              <div className="flex-none border-b border-border1/50 px-4 py-4">
                <Button
                  as={Link}
                  to={paths.workflowLink(workflowId)}
                  variant="primary"
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

            <ScrollArea
              data-testid="workflow-information-top-scroll-area"
              className="min-h-0 flex-1"
              viewPortClassName="h-full"
              mask={{ top: false }}
            >
              {initialRunId ? (
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
              )}
            </ScrollArea>
          </section>

          <section className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-studio-panel border border-border1/50 bg-surface3">
            <ScrollArea className="h-full w-full" viewPortClassName="h-full" mask={{ top: false }}>
              <WorkflowRecentRuns workflowId={workflowId} runId={initialRunId || runId} />
            </ScrollArea>
          </section>
        </>
      ) : null}
    </div>
  );
}
