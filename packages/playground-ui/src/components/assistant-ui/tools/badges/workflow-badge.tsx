import { WorkflowIcon } from '@/ds/icons';
import { GetWorkflowResponse } from '@mastra/client-js';

import { useContext, useEffect } from 'react';

import { WorkflowGraph, WorkflowRunContext, WorkflowRunProvider } from '@/domains/workflows';
import { useLinkComponent } from '@/lib/framework';
import { Button } from '@/ds/components/Button';

import { useHandleAgentWorkflowStream } from '@/domains/workflows/hooks/use-handle-agent-workflow-stream';
import { useWorkflowRuns } from '@/hooks/use-workflow-runs';
import { StreamChunk } from '@/types';
import { BadgeWrapper } from './badge-wrapper';

export interface WorkflowBadgeProps {
  workflow: GetWorkflowResponse;
  workflowId: string;
  runId?: string;
  isStreaming?: boolean;
}

export const WorkflowBadge = ({ workflow, runId, workflowId, isStreaming }: WorkflowBadgeProps) => {
  const { data: runs, isLoading: isRunsLoading } = useWorkflowRuns(workflowId, {
    enabled: Boolean(runId) && !isStreaming,
  });
  const run = runs?.runs.find(run => run.runId === runId);
  const isLoading = isRunsLoading || !run;

  const snapshot = typeof run?.snapshot === 'object' ? run?.snapshot : undefined;

  return (
    <BadgeWrapper icon={<WorkflowIcon className="text-accent3" />} title={workflow.name} initialCollapsed={false}>
      {!isStreaming && !isLoading && (
        <WorkflowRunProvider snapshot={snapshot}>
          <WorkflowBadgeExtended workflowId={workflowId} workflow={workflow} runId={runId} />
        </WorkflowRunProvider>
      )}

      {isStreaming && <WorkflowBadgeExtended workflowId={workflowId} workflow={workflow} runId={runId} />}
    </BadgeWrapper>
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
        <WorkflowGraph workflowId={workflowId} workflow={workflow!} />
      </div>
    </>
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
