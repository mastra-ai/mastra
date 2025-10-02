import { WorkflowIcon } from '@/ds/icons';
import { GetWorkflowResponse, WorkflowWatchResult } from '@mastra/client-js';

import { useContext, useEffect } from 'react';

import { WorkflowGraph, WorkflowRunContext, WorkflowRunProvider } from '@/domains/workflows';
import { useLinkComponent } from '@/lib/framework';
import { Button } from '@/ds/components/Button';

import { useWorkflowRuns } from '@/hooks/use-workflow-runs';

import { BadgeWrapper } from './badge-wrapper';
import { NetworkChoiceMetadataDialogTrigger } from './network-choice-metadata-dialog';

export interface WorkflowBadgeProps {
  workflow: GetWorkflowResponse;
  workflowId: string;
  runId?: string;
  isStreaming?: boolean;
  networkMetadata?: {
    input?: string | Record<string, unknown>;
    selectionReason?: string;
  };
}

export const WorkflowBadge = ({ workflow, runId, workflowId, isStreaming, networkMetadata }: WorkflowBadgeProps) => {
  const { data: runs, isLoading: isRunsLoading } = useWorkflowRuns(workflowId, {
    enabled: Boolean(runId) && !isStreaming,
  });
  const run = runs?.runs.find(run => run.runId === runId);
  const isLoading = isRunsLoading || !run;

  const snapshot = typeof run?.snapshot === 'object' ? run?.snapshot : undefined;

  return (
    <BadgeWrapper
      icon={<WorkflowIcon className="text-accent3" />}
      title={workflow.name}
      initialCollapsed={false}
      extraInfo={
        networkMetadata && (
          <NetworkChoiceMetadataDialogTrigger
            selectionReason={networkMetadata?.selectionReason || ''}
            input={networkMetadata?.input}
          />
        )
      }
    >
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

export const useWorkflowStream = (workflowFullState?: WorkflowWatchResult) => {
  const { setResult } = useContext(WorkflowRunContext);

  useEffect(() => {
    if (!workflowFullState) return;
    setResult(workflowFullState);
  }, [workflowFullState]);
};
