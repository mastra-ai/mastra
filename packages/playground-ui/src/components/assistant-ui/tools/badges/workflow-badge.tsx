import { Icon, WorkflowIcon } from '@/ds/icons';
import { GetWorkflowResponse } from '@mastra/client-js';
import { ChevronUpIcon } from 'lucide-react';
import { Badge } from '@/ds/components/Badge';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useWorkflowRuns } from '@/hooks/use-workflow-runs';
import { WorkflowGraph, WorkflowRunProvider } from '@/domains/workflows';
import { WorkflowResult } from '@mastra/core';
import { useLinkComponent } from '@/lib/framework';
import { Button } from '@/ds/components/Button';
import Spinner from '@/components/ui/spinner';

export interface WorkflowBadgeProps {
  workflow: GetWorkflowResponse;
  workflowId: string;
  result?: {
    result: WorkflowResult<any, any>;
    runId: string;
  };
}

export const WorkflowBadge = ({ workflow, result, workflowId }: WorkflowBadgeProps) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsCollapsed(s => !s)}
        className="flex items-center gap-2 disabled:cursor-not-allowed"
        type="button"
      >
        <Icon>
          <ChevronUpIcon className={cn('transition-all', isCollapsed ? 'rotate-90' : 'rotate-180')} />
        </Icon>
        <Badge icon={<WorkflowIcon className="text-accent3" />}>{workflow.name}</Badge>
      </button>

      {!isCollapsed && <WorkflowBadgeExtended workflowId={workflowId} workflow={workflow} runId={result?.runId} />}
    </div>
  );
};

interface WorkflowBadgeExtendedProps {
  workflowId: string;
  runId?: string;
  workflow: GetWorkflowResponse;
}

const WorkflowBadgeExtended = ({ workflowId, workflow, runId }: WorkflowBadgeExtendedProps) => {
  const { Link } = useLinkComponent();
  const { runs, isLoading: isRunsLoading } = useWorkflowRuns(workflowId, { enabled: Boolean(runId) });
  const run = runs?.runs.find(run => run.runId === runId);

  const isLoading = isRunsLoading || !run;

  return (
    <div className="pt-2">
      <div className="border-sm border-border1 rounded-lg bg-surface4">
        <div className="p-4 border-b-sm border-border1">
          {isLoading ? (
            <div className="flex items-center justify-center h-[50vh]">
              <Spinner />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 pb-2">
                <Button as={Link} href={`/workflows/${workflowId}/graph`}>
                  Go to workflow
                </Button>
                <Button as={Link} href={`/workflows/${workflowId}/graph/${runId}`}>
                  See run
                </Button>
              </div>

              <div className="rounded-md overflow-hidden h-[60vh] w-full">
                <WorkflowRunProvider snapshot={typeof run?.snapshot === 'object' ? run.snapshot : undefined}>
                  <WorkflowGraph workflowId={workflowId} workflow={workflow!} />
                </WorkflowRunProvider>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
