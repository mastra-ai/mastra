import { Icon, WorkflowIcon } from '@/ds/icons';
import { GetWorkflowResponse } from '@mastra/client-js';
import { ChevronUpIcon } from 'lucide-react';
import { Badge } from '@/ds/components/Badge';
import { useContext, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

import { WorkflowGraph, WorkflowRunContext, WorkflowRunProvider } from '@/domains/workflows';
import { useLinkComponent } from '@/lib/framework';
import { Button } from '@/ds/components/Button';

import { useHandleAgentWorkflowStream } from '@/domains/workflows/hooks/use-handle-agent-workflow-stream';
import { useWorkflowRuns } from '@/hooks/use-workflow-runs';
import { StreamChunk } from '@/types';

export interface WorkflowBadgeProps {
  workflow: GetWorkflowResponse;
  workflowId: string;
  runId?: string;
  isStreaming?: boolean;
}

export const WorkflowBadge = ({ workflow, runId, workflowId, isStreaming }: WorkflowBadgeProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { data: runs, isLoading: isRunsLoading } = useWorkflowRuns(workflowId, {
    enabled: Boolean(runId) && !isStreaming,
  });
  const run = runs?.runs.find(run => run.runId === runId);
  const isLoading = isRunsLoading || !run;

  const snapshot = typeof run?.snapshot === 'object' ? run?.snapshot : undefined;

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

      {!isCollapsed && !isStreaming && !isLoading && (
        <WorkflowRunProvider snapshot={snapshot}>
          <WorkflowBadgeExtended workflowId={workflowId} workflow={workflow} runId={runId} />
        </WorkflowRunProvider>
      )}

      {!isCollapsed && isStreaming && (
        <WorkflowBadgeExtended workflowId={workflowId} workflow={workflow} runId={runId} />
      )}
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

  return (
    <div className="pt-2">
      <div className="border-sm border-border1 rounded-lg bg-surface4">
        <div className="p-4 border-b-sm border-border1">
          <div className="flex items-center gap-2 pb-2">
            <Button as={Link} href={`/workflows/${workflowId}/graph`}>
              Go to workflow
            </Button>
            <Button as={Link} href={`/workflows/${workflowId}/graph/${runId}`}>
              See run
            </Button>
          </div>

          <div className="rounded-md overflow-hidden h-[60vh] w-full">
            <WorkflowGraph workflowId={workflowId} workflow={workflow!} />
          </div>
        </div>
      </div>
    </div>
  );
};

export const useWorkflowStream = (partialWorkflowOutput?: StreamChunk) => {
  const streamResult = useHandleAgentWorkflowStream(partialWorkflowOutput);
  const { setResult } = useContext(WorkflowRunContext);

  useEffect(() => {
    if (!streamResult) return;
    setResult(streamResult);
  }, [streamResult]);
};
