import { useState, useEffect, useContext } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { CopyIcon, Cpu } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useWorkflow } from '@/hooks/use-workflows';
import { EntityHeader } from '@/components/ui/entity-header';
import { WorkflowIcon } from '@/ds/icons/WorkflowIcon';
import { Badge } from '@/ds/components/Badge';
import { WorkflowRunDetail } from '../runs/workflow-run-details';
import { WorkflowTrigger } from '../workflow/workflow-trigger';
import { toast } from '@/lib/toast';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { PlaygroundTabs, TabList, Tab, TabContent } from '@/components/ui/playground-tabs';
import { TracingRunOptions } from '@/domains/observability/components/tracing-run-options';

export interface WorkflowInformationProps {
  workflowId: string;
  initialRunId?: string;
}

export function WorkflowInformation({ workflowId, initialRunId }: WorkflowInformationProps) {
  const { data: workflow, isLoading, error } = useWorkflow(workflowId);

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
  } = useContext(WorkflowRunContext);

  const [tab, setTab] = useState<string>('current-run');
  const [runId, setRunId] = useState<string>('');
  const { handleCopy } = useCopyToClipboard({ text: workflowId });

  const stepsCount = Object.keys(workflow?.steps ?? {}).length;

  useEffect(() => {
    if (!runId && !initialRunId) {
      closeStreamsAndReset();
    }
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

          {workflow?.isProcessorWorkflow && (
            <Badge icon={<Cpu className="h-3 w-3" />} className="bg-violet-500/20 text-violet-400">
              Processor
            </Badge>
          )}
        </div>
      </EntityHeader>

      <div className="flex-1 overflow-hidden border-t-sm border-border1 flex flex-col">
        <PlaygroundTabs defaultTab="current-run" value={tab} onValueChange={setTab}>
          <TabList>
            <Tab value="current-run">Current Run</Tab>
            <Tab value="run-options">Run options</Tab>
          </TabList>

          <TabContent value="current-run">
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
          </TabContent>
          <TabContent value="run-options">
            <TracingRunOptions />
          </TabContent>
        </PlaygroundTabs>
      </div>
    </div>
  );
}
