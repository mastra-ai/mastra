import { useState, useEffect, useContext, useMemo } from 'react';

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
import { useWorkflowStepDetail } from '../context/workflow-step-detail-context';
import { Tabs, TabList, Tab, TabContent } from '@/components/ui/elements/tabs';
import { TracingRunOptions } from '@/domains/observability/components/tracing-run-options';
import { WorkflowStepDetailContent } from './workflow-step-detail';

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

  const { stepDetail, closeStepDetail } = useWorkflowStepDetail();

  const [tab, setTab] = useState<string>('current-run');
  const [runId, setRunId] = useState<string>('');
  const { handleCopy } = useCopyToClipboard({ text: workflowId });

  const stepsCount = Object.keys(workflow?.steps ?? {}).length;

  // Generate dynamic tab name based on step detail type
  const nodeDetailTabName = useMemo(() => {
    if (!stepDetail) return null;
    if (stepDetail.type === 'map-config') {
      return 'Map Config';
    }
    if (stepDetail.type === 'nested-graph') {
      return 'Nested Workflow';
    }
    return 'Node';
  }, [stepDetail]);

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

  // Auto-switch tabs when step detail opens/closes
  useEffect(() => {
    if (stepDetail) {
      setTab('node-details');
    } else if (tab === 'node-details') {
      setTab('current-run');
    }
  }, [stepDetail]);

  // Handle tab change - close step detail when switching away from node-details
  const handleTabChange = (newTab: string) => {
    if (tab === 'node-details' && newTab !== 'node-details') {
      closeStepDetail();
    }
    setTab(newTab);
  };

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

      <div className="flex-1 overflow-auto border-t-sm border-border1 flex flex-col">
        <Tabs defaultTab="current-run" value={tab} onValueChange={handleTabChange} className="h-full">
          <TabList>
            <Tab value="current-run">Current Run</Tab>
            <Tab value="run-options">Run Options</Tab>
            {stepDetail && nodeDetailTabName && (
              <Tab
                value="node-details"
                onClose={() => {
                  closeStepDetail();
                  setTab('current-run');
                }}
              >
                {nodeDetailTabName} Details
              </Tab>
            )}
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
          {stepDetail && (
            <TabContent value="node-details">
              <WorkflowStepDetailContent />
            </TabContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
