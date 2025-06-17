import { useState } from 'react';

import { Badge, Icon, Txt, LegacyWorkflowTrigger, WorkflowIcon, WorkflowTrigger } from '@mastra/playground-ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { WorkflowLogs } from './workflow-logs';
import {
  useLegacyWorkflow,
  useWorkflow,
  useExecuteWorkflow,
  useWatchWorkflow,
  useResumeWorkflow,
  ExtendedWorkflowWatchResult,
} from '@/hooks/use-workflows';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
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
  const { createWorkflowRun, startWorkflowRun } = useExecuteWorkflow();
  const { watchWorkflow, watchResult } = useWatchWorkflow();
  const { resumeWorkflow } = useResumeWorkflow();

  const [runId, setRunId] = useState<string>('');
  const { handleCopy } = useCopyToClipboard({ text: workflowId });

  const stepsCount = Object.keys(workflow?.steps ?? {}).length;

  const isLoading = isLegacy ? isLegacyWorkflowLoading : isWorkflowLoading;
  const workflowToUse = isLegacy ? legacyWorkflow : workflow;

  return (
    <div className="grid grid-rows-[auto_1fr] h-full overflow-y-auto">
      <div className="p-5 border-b-sm border-border1">
        <div className="text-icon6 flex items-center gap-2">
          <Icon size="lg" className="bg-surface4 rounded-md p-1">
            <WorkflowIcon />
          </Icon>

          {isLoading ? (
            <Skeleton className="h-3 w-1/3" />
          ) : (
            <div className="flex items-center gap-4 min-w-0">
              <Txt variant="header-md" as="h2" className="font-medium truncate">
                {workflowToUse?.name}
              </Txt>
            </div>
          )}
        </div>

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
      </div>

      <div className="overflow-y-auto">
        <Tabs defaultValue="run" className="h-full grid grid-rows-[auto_1fr] overflow-y-auto">
          <TabsList className="flex shrink-0 border-b">
            <TabsTrigger value="run" className="group" onClick={() => navigate(`/workflows/${workflowId}/graph`)}>
              <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
                Run
              </p>
            </TabsTrigger>
            <TabsTrigger value="runs" className="group">
              <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
                Runs
              </p>
            </TabsTrigger>
            <TabsTrigger value="logs" className="group">
              <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
                Log Drains
              </p>
            </TabsTrigger>
          </TabsList>
          <div className="h-full overflow-y-auto">
            <TabsContent value="run">
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
                      startWorkflowRun={startWorkflowRun.mutateAsync}
                      resumeWorkflow={resumeWorkflow.mutateAsync}
                      watchWorkflow={watchWorkflow.mutateAsync}
                      watchResult={watchResult}
                      isWatchingWorkflow={watchWorkflow.isPending}
                      isResumingWorkflow={resumeWorkflow.isPending}
                    />
                  )}
                </>
              ) : null}
            </TabsContent>
            <TabsContent value="runs">
              <WorkflowRuns
                workflowId={workflowId}
                runId={params?.runId}
                isLoading={isRunsLoading}
                runs={runs?.runs || []}
                onPressRun={({ workflowId, runId }) => navigate(`/workflows/${workflowId}/graph/${runId}`)}
              />
            </TabsContent>
            <TabsContent value="logs">
              <WorkflowLogs runId={runId} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
