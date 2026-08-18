import type { GetWorkflowResponse } from '@mastra/client-js';
import { Tool, ToolContent, ToolHeader, ToolIcon } from '@mastra/playground-ui/components/ai/tool-call';
import { Button } from '@mastra/playground-ui/components/Button';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';

import { useContext, useEffect } from 'react';
import { BackgroundTaskMetadataDialogTrigger } from './background-task-metadata-dialog';
import { LoadingBadge } from './loading-badge';
import { NetworkChoiceMetadataDialogTrigger } from './network-choice-metadata-dialog';
import { isToolApprovalPending } from './tool-action-state';
import type { ToolApprovalButtonsProps } from './tool-approval-buttons';
import { ToolApprovalButtons } from './tool-approval-buttons';
import {
  WorkflowGraph,
  WorkflowRunContext,
  WorkflowRunProvider,
  WorkflowSelectedStepProvider,
  WorkflowStepDetailProvider,
} from '@/domains/workflows';
import type { WorkflowRunStreamResult } from '@/domains/workflows/context/workflow-run-context';
import { useWorkflow } from '@/hooks';
import { useWorkflowRuns } from '@/hooks/use-workflow-runs';
import type { MessageMetadata } from '@/lib/ai-ui/messages/message-metadata';
import { useLinkComponent } from '@/lib/framework';

export interface WorkflowBadgeProps extends Omit<ToolApprovalButtonsProps, 'toolCalled'> {
  workflowId: string;
  result?: any;
  isStreaming?: boolean;
  metadata?: MessageMetadata;
  suspendPayload?: any;
  toolCalled?: boolean;
}

export const WorkflowBadge = ({
  result,
  workflowId,
  isStreaming,
  metadata,
  toolCallId,
  toolApprovalMetadata,
  suspendPayload,
  toolName,
  isNetwork,
  toolCalled,
}: WorkflowBadgeProps) => {
  const { Link } = useLinkComponent();
  const { runId, status } = result || {};
  const { data: workflow, isLoading: isWorkflowLoading } = useWorkflow(workflowId);
  const { data: runs, isLoading: isRunsLoading } = useWorkflowRuns(workflowId, {
    enabled: Boolean(runId) && !isStreaming,
  });
  const run = runs?.find(run => run.runId === runId);
  const isLoading = isRunsLoading || !run;

  const snapshot = typeof run?.snapshot === 'object' ? run?.snapshot : undefined;

  const routingDecision = metadata?.mode === 'network' ? metadata.routingDecision : undefined;
  const selectionReason =
    metadata?.mode === 'network' ? (routingDecision?.selectionReason ?? metadata.selectionReason) : undefined;
  const agentNetworkInput = metadata?.mode === 'network' ? (routingDecision ?? metadata.agentInput) : undefined;

  const bgEntry =
    (metadata?.mode === 'stream' || metadata?.mode === 'generate') && metadata?.backgroundTasks
      ? metadata.backgroundTasks[toolCallId]
      : undefined;

  let suspendPayloadSlot =
    typeof suspendPayload === 'string' ? (
      <pre className="bg-surface4 overflow-x-auto rounded-md p-4 whitespace-pre">{suspendPayload}</pre>
    ) : (
      <CodeEditor data={suspendPayload} data-testid="tool-suspend-payload" />
    );

  if (isWorkflowLoading || !workflow) return <LoadingBadge />;

  const toolCallStatus = status === 'failed' ? 'error' : result === undefined ? 'running' : 'success';

  const metadataAction =
    metadata?.mode === 'network' ? (
      <NetworkChoiceMetadataDialogTrigger
        selectionReason={selectionReason ?? ''}
        input={agentNetworkInput as string | Record<string, unknown> | undefined}
      />
    ) : bgEntry?.taskId && bgEntry?.startedAt ? (
      <BackgroundTaskMetadataDialogTrigger backgroundTask={bgEntry} />
    ) : null;
  const workflowHref = runId ? `/workflows/${workflowId}/graph/${runId}` : `/workflows/${workflowId}/graph`;
  const hasToolBeenCalled = toolCalled ?? Boolean(status);

  return (
    <Tool
      data-testid="workflow-badge"
      status={toolCallStatus}
      defaultOpen={isToolApprovalPending(toolApprovalMetadata, hasToolBeenCalled) || Boolean(suspendPayload)}
      aria-label={`Tool: ${toolName}`}
    >
      <ToolHeader
        actions={
          <div className="flex items-center gap-1">
            {metadataAction}
            <Button as={Link} href={workflowHref} size="xs" variant="ghost">
              Go to workflow
            </Button>
          </div>
        }
      >
        <ToolIcon tooltip="Workflow">
          <WorkflowIcon className="text-accent3" />
        </ToolIcon>
        {workflow.name}
      </ToolHeader>

      <ToolContent>
        {!isStreaming && !isLoading && (
          <WorkflowRunProvider snapshot={snapshot} workflowId={workflowId} initialRunId={runId} withoutTimeTravel>
            <WorkflowBadgeExtended workflowId={workflowId} workflow={workflow} />
          </WorkflowRunProvider>
        )}

        {isStreaming && <WorkflowBadgeExtended workflowId={workflowId} workflow={workflow} />}

        {suspendPayloadSlot !== undefined && suspendPayload && (
          <div>
            <p className="pb-2 font-medium">Workflow suspend payload</p>
            {suspendPayloadSlot}
          </div>
        )}

        <ToolApprovalButtons
          toolCalled={hasToolBeenCalled}
          toolCallId={toolCallId}
          toolApprovalMetadata={toolApprovalMetadata}
          toolName={toolName}
          isNetwork={isNetwork}
          isGenerateMode={metadata?.mode === 'generate'}
        />
      </ToolContent>
    </Tool>
  );
};

interface WorkflowBadgeExtendedProps {
  workflowId: string;
  workflow: GetWorkflowResponse;
}

const WorkflowBadgeExtended = ({ workflowId, workflow }: WorkflowBadgeExtendedProps) => {
  return (
    <div className="h-[60vh] w-full overflow-hidden rounded-md">
      <WorkflowSelectedStepProvider>
        <WorkflowStepDetailProvider>
          <WorkflowGraph workflowId={workflowId} workflow={workflow!} />
        </WorkflowStepDetailProvider>
      </WorkflowSelectedStepProvider>
    </div>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useWorkflowStream = (workflowFullState?: WorkflowRunStreamResult) => {
  const { setResult } = useContext(WorkflowRunContext);

  useEffect(() => {
    if (!workflowFullState) return;
    setResult(workflowFullState);
  }, [workflowFullState, setResult]);
};
