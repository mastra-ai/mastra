import type { GetWorkflowResponse } from '@mastra/client-js';
import { Eye } from 'lucide-react';
import { useContext, useEffect } from 'react';
import { BackgroundTaskMetadataDialogTrigger } from './background-task-metadata-dialog';
import type { MessageMetadata } from '@/domains/chat';

import { BadgeWrapper } from '@/domains/chat/components/badge-wrapper';
import { LoadingBadge } from '@/domains/chat/components/loading-badge';
import { NetworkChoiceMetadataDialogTrigger } from '@/domains/chat/components/network-choice-metadata-dialog';
import { SectionLabel } from '@/domains/chat/components/section-label';
import { awaitsToolApproval } from '@/domains/chat/tools/badges/awaits-tool-approval';
import type { ToolApprovalButtonsProps } from '@/domains/chat/tools/badges/tool-approval-buttons';
import { ToolApprovalButtons } from '@/domains/chat/tools/badges/tool-approval-buttons';
import { useEntityRequestContext } from '@/domains/request-context/hooks/use-entity-request-context';
import {
  WorkflowGraph,
  WorkflowRunContext,
  WorkflowSelectedStepProvider,
  WorkflowStepDetailProvider,
  useWorkflowStepDetail,
} from '@/domains/workflows';
import { WorkflowStepDetailContent } from '@/domains/workflows/components/workflow-step-detail';
import { PlaygroundWorkflowRunProvider } from '@/domains/workflows/context/playground-workflow-run-provider';
import type { WorkflowRunStreamResult } from '@/domains/workflows/context/workflow-run-context';
import { useWorkflow } from '@/domains/workflows/hooks/use-workflow';
import { ToolCallMono } from '@/ds/components/ai/tool-call';
import { Button } from '@/ds/components/Button';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { WorkflowIcon } from '@/ds/icons/WorkflowIcon';
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
  const { runId, status } = result || {};
  const { data: workflow, isLoading: isWorkflowLoading } = useWorkflow(
    workflowId,
    useEntityRequestContext('workflow', workflowId)[0],
  );
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
      <ToolCallMono copyText={suspendPayload} className="text-muted-foreground">
        {suspendPayload}
      </ToolCallMono>
    ) : (
      <CodeEditor data={suspendPayload} data-testid="tool-suspend-payload" />
    );

  if (isWorkflowLoading || !workflow) return <LoadingBadge />;

  const toolCalledOrFinished = toolCalled ?? !!status;
  const showsRun = isStreaming || Boolean(runId);
  const hasBody =
    showsRun ||
    Boolean(suspendPayload) ||
    awaitsToolApproval({ toolApprovalMetadata, toolCalled: toolCalledOrFinished });

  return (
    <BadgeWrapper
      data-testid="workflow-badge"
      icon={<WorkflowIcon className="text-span-workflow" />}
      title={workflow.name}
      initialCollapsed={false}
      extraInfo={
        metadata?.mode === 'network' ? (
          <NetworkChoiceMetadataDialogTrigger
            selectionReason={selectionReason ?? ''}
            input={agentNetworkInput as string | Record<string, unknown> | undefined}
          />
        ) : bgEntry?.taskId && bgEntry?.startedAt ? (
          <BackgroundTaskMetadataDialogTrigger backgroundTask={bgEntry} />
        ) : null
      }
    >
      {hasBody && (
        <>
          {!isStreaming && runId && (
            <PlaygroundWorkflowRunProvider workflowId={workflowId} initialRunId={runId} withoutTimeTravel>
              <WorkflowBadgeExtended workflowId={workflowId} workflow={workflow} runId={runId} />
            </PlaygroundWorkflowRunProvider>
          )}

          {isStreaming && <WorkflowBadgeExtended workflowId={workflowId} workflow={workflow} runId={runId} />}

          {suspendPayloadSlot !== undefined && suspendPayload && (
            <div>
              <SectionLabel>Workflow suspend payload</SectionLabel>
              {suspendPayloadSlot}
            </div>
          )}

          <ToolApprovalButtons
            toolCalled={toolCalledOrFinished}
            toolCallId={toolCallId}
            toolApprovalMetadata={toolApprovalMetadata}
            toolName={toolName}
            isNetwork={isNetwork}
            isGenerateMode={metadata?.mode === 'generate'}
          />
        </>
      )}
    </BadgeWrapper>
  );
};

interface WorkflowBadgeExtendedProps {
  workflowId: string;
  runId?: string;
  workflow: GetWorkflowResponse;
}

const WorkflowBadgeExtended = ({ workflowId, workflow, runId }: WorkflowBadgeExtendedProps) => {
  const requestContext = useEntityRequestContext('workflow', workflowId)[0];
  const { Link } = useLinkComponent();
  const { isLoadingRunExecutionResult } = useContext(WorkflowRunContext);

  return (
    <>
      <div className="flex items-center gap-2 pb-2">
        <Button icon={<WorkflowIcon />} render={<Link href={`/workflows/${workflowId}/graph`} />}>
          Go to workflow
        </Button>
        {runId && (
          <Button icon={<Eye />} render={<Link href={`/workflows/${workflowId}/graph/${runId}`} />}>
            See run
          </Button>
        )}
      </div>

      <WorkflowSelectedStepProvider>
        <WorkflowStepDetailProvider>
          <div className="h-[60vh] w-full overflow-hidden rounded-md">
            <WorkflowGraph
              workflowId={workflowId}
              workflow={workflow}
              isLoading={isLoadingRunExecutionResult}
              requestContext={requestContext}
            />
          </div>
          <WorkflowBadgeStepDetail requestContext={requestContext} />
        </WorkflowStepDetailProvider>
      </WorkflowSelectedStepProvider>
    </>
  );
};

const WorkflowBadgeStepDetail = ({ requestContext }: { requestContext: Record<string, any> }) => {
  const { stepDetail } = useWorkflowStepDetail();
  if (!stepDetail) return null;
  return (
    <div className="mt-2 flex max-h-[60vh] flex-col overflow-hidden rounded-md border border-border bg-background">
      <WorkflowStepDetailContent requestContext={requestContext} />
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
