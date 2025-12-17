import { WorkflowIcon } from '@/ds/icons';
import { GetWorkflowResponse } from '@mastra/client-js';

import { useContext, useEffect } from 'react';

import { WorkflowGraph, WorkflowRunContext, WorkflowRunProvider } from '@/domains/workflows';
import { useLinkComponent } from '@/lib/framework';
import { Button } from '@/ds/components/Button';

import { useWorkflowRuns } from '@/hooks/use-workflow-runs';

import { BadgeWrapper } from './badge-wrapper';
import { NetworkChoiceMetadataDialogTrigger } from './network-choice-metadata-dialog';
import { WorkflowRunStreamResult } from '@/domains/workflows/context/workflow-run-context';
import { MastraUIMessage } from '@mastra/react';
import { LoadingBadge } from './loading-badge';
import { useWorkflow } from '@/hooks';
import { ToolApprovalButtons, ToolApprovalButtonsProps } from './tool-approval-buttons';
import { SyntaxHighlighter } from '@/components/syntax-highlighter';

export interface WorkflowBadgeProps extends Omit<ToolApprovalButtonsProps, 'toolCalled'> {
  workflowId: string;
  result?: any;
  isStreaming?: boolean;
  metadata?: MastraUIMessage['metadata'];
  suspendPayload?: any;
}

export const WorkflowBadge = ({
  result,
  workflowId,
  isStreaming,
  metadata,
  toolCallId,
  toolApprovalMetadata,
  suspendPayload,
}: WorkflowBadgeProps) => {
  const { runId, status } = result || {};
  const { data: workflow, isLoading: isWorkflowLoading } = useWorkflow(workflowId);
  const { data: runs, isLoading: isRunsLoading } = useWorkflowRuns(workflowId, {
    enabled: Boolean(runId) && !isStreaming,
  });
  const run = runs?.find(run => run.runId === runId);
  const isLoading = isRunsLoading || !run;

  const snapshot = typeof run?.snapshot === 'object' ? run?.snapshot : undefined;

  const selectionReason = metadata?.mode === 'network' ? metadata.selectionReason : undefined;
  const agentNetworkInput = metadata?.mode === 'network' ? metadata.agentInput : undefined;

  let suspendPayloadSlot =
    typeof suspendPayload === 'string' ? (
      <pre className="whitespace-pre bg-surface4 p-4 rounded-md overflow-x-auto">{suspendPayload}</pre>
    ) : (
      <SyntaxHighlighter data={suspendPayload} data-testid="tool-suspend-payload" />
    );

  if (isWorkflowLoading || !workflow) return <LoadingBadge />;

  return (
    <BadgeWrapper
      data-testid="workflow-badge"
      icon={<WorkflowIcon className="text-accent3" />}
      title={workflow.name}
      initialCollapsed={false}
      extraInfo={
        metadata?.mode === 'network' && (
          <NetworkChoiceMetadataDialogTrigger
            selectionReason={selectionReason ?? ''}
            input={agentNetworkInput as string | Record<string, unknown> | undefined}
          />
        )
      }
    >
      {suspendPayloadSlot !== undefined && suspendPayload && (
        <div>
          <p className="font-medium pb-2">Tool suspend payload</p>
          {suspendPayloadSlot}
        </div>
      )}

      {!isStreaming && !isLoading && (
        <WorkflowRunProvider snapshot={snapshot} workflowId={workflowId} initialRunId={runId} withoutTimeTravel>
          <WorkflowBadgeExtended workflowId={workflowId} workflow={workflow} runId={runId} />
        </WorkflowRunProvider>
      )}

      {isStreaming && <WorkflowBadgeExtended workflowId={workflowId} workflow={workflow} runId={runId} />}

      <ToolApprovalButtons toolCalled={!!status} toolCallId={toolCallId} toolApprovalMetadata={toolApprovalMetadata} />
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
        {runId && (
          <Button as={Link} href={`/workflows/${workflowId}/graph/${runId}`}>
            See run
          </Button>
        )}
      </div>

      <div className="rounded-md overflow-hidden h-[60vh] w-full">
        <WorkflowGraph workflowId={workflowId} workflow={workflow!} />
      </div>
    </>
  );
};

export const useWorkflowStream = (workflowFullState?: WorkflowRunStreamResult) => {
  const { setResult } = useContext(WorkflowRunContext);

  useEffect(() => {
    if (!workflowFullState) return;
    setResult(workflowFullState);
  }, [workflowFullState]);
};
