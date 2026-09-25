import type { GetWorkflowResponse } from '@mastra/client-js';
import { ToolCallMono } from '@mastra/playground-ui/components/ai/tool-call';
import { Button } from '@mastra/playground-ui/components/Button';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';

import type { MessageMetadata } from '@mastra/playground-ui/domains/chat';
import { BadgeWrapper } from '@mastra/playground-ui/domains/chat/components/badge-wrapper';
import { LoadingBadge } from '@mastra/playground-ui/domains/chat/components/loading-badge';
import { NetworkChoiceMetadataDialogTrigger } from '@mastra/playground-ui/domains/chat/components/network-choice-metadata-dialog';
import { SectionLabel } from '@mastra/playground-ui/domains/chat/components/section-label';
import type { ToolApprovalButtonsProps } from '@mastra/playground-ui/domains/chat/tools/badges/tool-approval-buttons';
import { ToolApprovalButtons } from '@mastra/playground-ui/domains/chat/tools/badges/tool-approval-buttons';
import {
  WorkflowGraph,
  WorkflowRunContext,
  WorkflowSelectedStepProvider,
  WorkflowStepDetailProvider,
  useWorkflowStepDetail,
} from '@mastra/playground-ui/domains/workflows';
import { WorkflowStepDetailContent } from '@mastra/playground-ui/domains/workflows/components/workflow-step-detail';
import type { WorkflowRunStreamResult } from '@mastra/playground-ui/domains/workflows/context/workflow-run-context';
import { useWorkflow } from '@mastra/playground-ui/domains/workflows/hooks/use-workflow';
import { useWorkflowRuns } from '@mastra/playground-ui/domains/workflows/hooks/use-workflow-runs';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { Eye } from 'lucide-react';
import { useContext, useEffect } from 'react';
import { BackgroundTaskMetadataDialogTrigger } from './background-task-metadata-dialog';
import { useMergedRequestContext } from '@/domains/request-context/context/schema-request-context';
import { PlaygroundWorkflowRunProvider } from '@/domains/workflows/playground-workflow-run-provider';
import { usePlaygroundStore } from '@/store/playground-store';

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
  const { data: workflow, isLoading: isWorkflowLoading } = useWorkflow(workflowId, usePlaygroundStore().requestContext);
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
      <ToolCallMono copyText={suspendPayload} className="text-muted-foreground">
        {suspendPayload}
      </ToolCallMono>
    ) : (
      <CodeEditor data={suspendPayload} data-testid="tool-suspend-payload" />
    );

  if (isWorkflowLoading || !workflow) return <LoadingBadge />;

  return (
    <BadgeWrapper
      data-testid="workflow-badge"
      icon={<WorkflowIcon className="text-accent3" />}
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
      {!isStreaming && !isLoading && (
        <PlaygroundWorkflowRunProvider
          snapshot={snapshot}
          workflowId={workflowId}
          initialRunId={runId}
          withoutTimeTravel
        >
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
        toolCalled={toolCalled ?? !!status}
        toolCallId={toolCallId}
        toolApprovalMetadata={toolApprovalMetadata}
        toolName={toolName}
        isNetwork={isNetwork}
        isGenerateMode={metadata?.mode === 'generate'}
      />
    </BadgeWrapper>
  );
};

interface WorkflowBadgeExtendedProps {
  workflowId: string;
  runId?: string;
  workflow: GetWorkflowResponse;
}

const WorkflowBadgeExtended = ({ workflowId, workflow, runId }: WorkflowBadgeExtendedProps) => {
  const requestContext = useMergedRequestContext();
  const { Link } = useLinkComponent();

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
            <WorkflowGraph workflowId={workflowId} workflow={workflow!} requestContext={requestContext} />
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
