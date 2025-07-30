import { useState } from 'react';

import {
  Badge,
  LegacyWorkflowTrigger,
  WorkflowIcon,
  WorkflowTrigger,
  PlaygroundTabs,
  TabList,
  Tab,
  TabContent,
  EntityHeader,
} from '@mastra/playground-ui';

import { WorkflowLogs } from './workflow-logs';
import {
  useLegacyWorkflow,
  useWorkflow,
  useExecuteWorkflow,
  useResumeWorkflow,
  useStreamWorkflow,
  useCancelWorkflowRun,
} from '@/hooks/use-workflows';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { CopyIcon } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { WorkflowRuns } from '@mastra/playground-ui';
import { useNavigate, useParams } from 'react-router';
import { useWorkflowRuns } from '@/pages/workflows/workflow/hooks/use-workflow-runs';

export function WorkflowInformation({ workflowId, isLegacy }: { workflowId: string; isLegacy?: boolean }) {
  const params = useParams();
  const navigate = useNavigate();
  const { data: workflow, isLoading: isWorkflowLoading } = useWorkflow(workflowId, !isLegacy);
  const { isLoading: isRunsLoading, data: runs } = useWorkflowRuns({ workflowId });
  const { data: legacyWorkflow, isLoading: isLegacyWorkflowLoading } = useLegacyWorkflow(workflowId, !!isLegacy);
  const { createWorkflowRun } = useExecuteWorkflow();
  const { resumeWorkflow } = useResumeWorkflow();
  const { streamWorkflow, streamResult, isStreaming } = useStreamWorkflow();
  const { mutateAsync: cancelWorkflowRun, isPending: isCancellingWorkflowRun } = useCancelWorkflowRun();

  const [runId, setRunId] = useState<string>('');
  const { handleCopy } = useCopyToClipboard({ text: workflowId });

  const stepsCount = Object.keys(workflow?.steps ?? {}).length;

  const isLoading = isLegacy ? isLegacyWorkflowLoading : isWorkflowLoading;
  const workflowToUse = isLegacy ? legacyWorkflow : workflow;

  return (
    <div className="grid grid-rows-[auto_1fr] h-full overflow-y-auto">
      <EntityHeader icon={<WorkflowIcon />} title={workflowToUse?.name || ''} isLoading={isLoading}>
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
        <PlaygroundTabs defaultTab="run" className="h-[unset]">
          <TabList className="sticky top-0 bg-surface3 z-10">
            <Tab value="run" onClick={() => navigate(`/workflows/${workflowId}/graph`)}>
              Run
            </Tab>
            <Tab value="runs">Runs</Tab>
            <Tab value="logs">Log Drains</Tab>
          </TabList>

          <TabContent value="run">
            {workflowId ? (
              <>
                {isLegacy ? (
                  <LegacyWorkflowTrigger workflowId={workflowId} setRunId={setRunId} />
                ) : (
                  <WorkflowTrigger
                    workflowId={workflowId}
                    setRunId={setRunId}
                    workflow={workflow}
                    isLoading={isWorkflowLoading}
                    createWorkflowRun={createWorkflowRun.mutateAsync}
                    streamWorkflow={streamWorkflow.mutateAsync}
                    resumeWorkflow={resumeWorkflow.mutateAsync}
                    streamResult={streamResult}
                    isStreamingWorkflow={isStreaming}
                    isResumingWorkflow={resumeWorkflow.isPending}
                    isCancellingWorkflowRun={isCancellingWorkflowRun}
                    cancelWorkflowRun={cancelWorkflowRun}
                  />
                )}
              </>
            ) : null}
          </TabContent>
          <TabContent value="runs">
            <WorkflowRuns
              workflowId={workflowId}
              runId={params?.runId}
              isLoading={isRunsLoading}
              runs={runs?.runs || []}
              onPressRun={({ workflowId, runId }) => navigate(`/workflows/${workflowId}/graph/${runId}`)}
            />
          </TabContent>

          <TabContent value="logs">
            <WorkflowLogs runId={runId} />
          </TabContent>
        </PlaygroundTabs>
      </div>
    </div>
  );
}
