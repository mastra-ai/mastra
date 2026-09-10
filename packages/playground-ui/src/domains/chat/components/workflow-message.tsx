import type { GetWorkflowResponse } from '@mastra/client-js';
import type { WorkflowRunState, WorkflowStreamResult } from '@mastra/core/workflows';
import { ToolCallMono } from '../../../ds/components/ai/tool-call';
import { Button } from '../../../ds/components/Button';
import { CodeEditor } from '../../../ds/components/CodeEditor';
import { Skeleton } from '../../../ds/components/Skeleton';
import { Spinner } from '../../../ds/components/Spinner';
import { WorkflowIcon } from '../../../ds/icons/WorkflowIcon';
import type { MessageMetadata } from '../messages/message-metadata';
import { isRecord } from '../messages/signal-data';
import { WorkflowRunContext } from '../workflows/context/workflow-run-context';
import { WorkflowSelectedStepProvider } from '../workflows/context/workflow-selected-step-context';
import { WorkflowStepDetailProvider } from '../workflows/context/workflow-step-detail-provider';
import { WorkflowGraph } from '../workflows/workflow/workflow-graph';
import { BackgroundTaskMetadataDialogTrigger } from './background-task-metadata-dialog';
import type { BackgroundTaskDetails } from './background-task-metadata-dialog';
import { NetworkChoiceMetadataDialogTrigger } from './network-choice-metadata-dialog';
import { SectionLabel } from './section-label';
import { ToolApprovalControls } from './tool-approval-controls';
import type { ToolApprovalControlsProps } from './tool-approval-controls';
import { ToolBadgeDisclosure } from './tool-badge-disclosure';

export interface WorkflowMessageData {
  workflow?: GetWorkflowResponse;
  isLoading?: boolean;
  isRunLoading?: boolean;
  snapshot?: WorkflowRunState;
  runResult?: WorkflowStreamResult<any, any, any, any>;
  waitingStepKey?: string;
}
export interface WorkflowMessageProps extends ToolApprovalControlsProps {
  workflowId: string;
  toolCallId: string;
  result?: WorkflowStreamResult<any, any, any, any> & { runId?: string };
  isStreaming?: boolean;
  metadata?: MessageMetadata;
  data?: WorkflowMessageData;
  suspendPayload?: unknown;
  toolCalled?: boolean;
  approvalRequired?: boolean;
  onNavigate?: (href: string) => void;
  onToolOpen?: (id: string) => void;
  backgroundTaskDetails?: BackgroundTaskDetails;
}
export function WorkflowMessage({
  workflowId,
  toolCallId,
  result,
  isStreaming,
  metadata,
  data,
  suspendPayload,
  toolCalled,
  approvalRequired,
  onNavigate,
  onToolOpen,
  backgroundTaskDetails,
  ...controls
}: WorkflowMessageProps) {
  const workflow = data?.workflow;
  if (data?.isLoading || !workflow)
    return (
      <ToolBadgeDisclosure
        isRunning={controls.isRunning}
        icon={<Spinner className="text-neutral3" />}
        title={<Skeleton className="ml-2 h-2 w-12" />}
        collapsible={false}
      />
    );
  const runId = result?.runId;
  const routingDecision = metadata?.mode === 'network' ? metadata.routingDecision : undefined;
  const selectionReason =
    metadata?.mode === 'network' ? (routingDecision?.selectionReason ?? metadata.selectionReason) : undefined;
  const input = metadata?.mode === 'network' ? (routingDecision ?? metadata.agentInput) : undefined;
  const bgEntry =
    metadata?.mode === 'stream' || metadata?.mode === 'generate' ? metadata.backgroundTasks?.[toolCallId] : undefined;
  return (
    <ToolBadgeDisclosure
      isRunning={controls.isRunning}
      onToolOpen={onToolOpen}
      data-testid="workflow-badge"
      toolCallId={toolCallId}
      icon={<WorkflowIcon className="text-accent3" />}
      title={workflow.name}
      initialCollapsed={false}
      extraInfo={
        metadata?.mode === 'network' ? (
          <NetworkChoiceMetadataDialogTrigger
            selectionReason={selectionReason ?? ''}
            input={typeof input === 'string' || isRecord(input) ? input : undefined}
          />
        ) : bgEntry?.taskId && bgEntry.startedAt ? (
          <BackgroundTaskMetadataDialogTrigger backgroundTask={bgEntry} details={backgroundTaskDetails} />
        ) : null
      }
    >
      {(isStreaming || !data?.isRunLoading) && (
        <WorkflowRunContext.Provider
          value={{
            workflow,
            result: isStreaming ? result : data?.runResult,
            snapshot: data?.snapshot,
            runSnapshot: data?.snapshot,
            runId,
            payload: data?.snapshot?.context?.input,
            waitingStepKey: data?.waitingStepKey,
          }}
        >
          {onNavigate && (
            <div className="flex items-center gap-2 pb-2">
              <Button onClick={() => onNavigate(`/workflows/${workflowId}/graph`)}>Go to workflow</Button>
              {runId && <Button onClick={() => onNavigate(`/workflows/${workflowId}/graph/${runId}`)}>See run</Button>}
            </div>
          )}
          <div className="h-[60vh] w-full overflow-hidden rounded-md">
            <WorkflowSelectedStepProvider>
              <WorkflowStepDetailProvider>
                <WorkflowGraph workflowId={workflowId} workflow={workflow} />
              </WorkflowStepDetailProvider>
            </WorkflowSelectedStepProvider>
          </div>
        </WorkflowRunContext.Provider>
      )}
      {suspendPayload != null && (
        <div>
          <SectionLabel>Workflow suspend payload</SectionLabel>
          {typeof suspendPayload === 'string' ? (
            <ToolCallMono copyText={suspendPayload} className="text-icon3">
              {suspendPayload}
            </ToolCallMono>
          ) : (
            <CodeEditor
              data={isRecord(suspendPayload) ? suspendPayload : undefined}
              data-testid="tool-suspend-payload"
            />
          )}
        </div>
      )}
      {approvalRequired && !(toolCalled ?? !!result?.status) && <ToolApprovalControls {...controls} />}
    </ToolBadgeDisclosure>
  );
}
