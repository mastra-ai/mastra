import { useState } from 'react';

import { Badge, Icon, Txt, VNextWorkflowTrigger, WorkflowIcon, WorkflowTrigger } from '@mastra/playground-ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { WorkflowEndpoints } from './workflow-endpoints';
import { WorkflowLogs } from './workflow-logs';
import { useWorkflow } from '@/hooks/use-workflows';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyIcon } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

export function WorkflowInformation({ workflowId, isVNext }: { workflowId: string; isVNext?: boolean }) {
  const { workflow, isLoading } = useWorkflow(workflowId);
  const [runId, setRunId] = useState<string>('');
  const { handleCopy } = useCopyToClipboard({ text: workflowId });

  const stepsCount = Object.keys(workflow?.steps ?? {}).length;

  return (
    <div className="h-full overflow-y-scroll pb-5">
      <div className="p-5 border-b-sm border-border1">
        <div className="text-icon6 flex items-center gap-2">
          <Icon size="lg" className="bg-surface4 rounded-md p-1">
            <WorkflowIcon />
          </Icon>

          {isLoading ? (
            <Skeleton className="h-3 w-1/3" />
          ) : (
            <Txt variant="header-md" as="h2" className="font-medium">
              {workflow?.name}
            </Txt>
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

      <Tabs defaultValue="run" className="h-full">
        <TabsList className="flex shrink-0 border-b">
          <TabsTrigger value="run" className="group">
            <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
              Run
            </p>
          </TabsTrigger>
          <TabsTrigger value="endpoints" className="group">
            <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
              Endpoints
            </p>
          </TabsTrigger>
          <TabsTrigger value="logs" className="group">
            <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
              Log Drains
            </p>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="run">
          {workflowId ? (
            <>
              {isVNext ? (
                <VNextWorkflowTrigger workflowId={workflowId} setRunId={setRunId} baseUrl="" />
              ) : (
                <WorkflowTrigger workflowId={workflowId} setRunId={setRunId} baseUrl="" />
              )}
            </>
          ) : null}
        </TabsContent>
        <TabsContent value="endpoints">
          <WorkflowEndpoints workflowId={workflowId} isVNext={isVNext} />
        </TabsContent>
        <TabsContent value="logs">
          <WorkflowLogs runId={runId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
