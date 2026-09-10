import { PendingPlanCard, SubmittedPlanCard, getPlanDocument } from '@mastra/playground-ui/domains/chat';
import type { SubmittedPlan } from '@mastra/playground-ui/domains/chat';
import { useAgentPlan } from '@/domains/agents/hooks/use-agent-plan';
import type { MessageMetadata } from '@/lib/ai-ui/messages/message-metadata';
import { useToolCall } from '@/services/tool-call-provider';

export interface SubmitPlanToolProps {
  agentId: string;
  agentVersionId?: string;
  requestContext?: Record<string, unknown>;
  toolName: string;
  toolCallId: string;
  output: unknown;
  metadata?: MessageMetadata;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getSubmittedPlan(output: unknown): SubmittedPlan | undefined {
  if (!isRecord(output) || !isRecord(output.submittedPlan)) return undefined;

  const content = getString(output.submittedPlan.plan);
  if (!content) return undefined;

  const document = getPlanDocument(content);

  return {
    title: getString(output.submittedPlan.title) ?? document.title,
    path: getString(output.submittedPlan.path),
    content,
  };
}

function getSuspendedPlanPath(
  metadata: MessageMetadata | undefined,
  toolName: string,
  toolCallId: string,
): string | undefined {
  const payload = (metadata?.suspendedTools?.[toolName] ?? metadata?.suspendedTools?.[toolCallId])?.suspendPayload;
  if (!isRecord(payload)) return undefined;

  return getString(payload.path);
}

interface PendingPlanCardProps {
  agentId: string;
  agentVersionId?: string;
  requestContext?: Record<string, unknown>;
  toolCallId: string;
  path: string;
}

function ConnectedPendingPlanCard({ agentId, agentVersionId, requestContext, toolCallId, path }: PendingPlanCardProps) {
  const { data, isLoading, isError } = useAgentPlan({ agentId, agentVersionId, requestContext, path });
  const { approveToolcall, isRunning, toolCallApprovals } = useToolCall();
  const content = data?.content;
  const document = content ? getPlanDocument(content) : undefined;
  const isAnswered = toolCallApprovals[toolCallId] !== undefined;

  const resume = (action: 'approved' | 'rejected') => {
    approveToolcall(toolCallId, {
      action,
      path,
      ...(document ? { title: document.title, plan: content } : {}),
    });
  };

  return (
    <PendingPlanCard
      path={path}
      content={content}
      isLoading={isLoading}
      isError={isError}
      isRunning={isRunning}
      isAnswered={isAnswered}
      onApprove={() => resume('approved')}
      onReject={() => resume('rejected')}
    />
  );
}

export function SubmitPlanTool({
  agentId,
  agentVersionId,
  requestContext,
  toolName,
  toolCallId,
  output,
  metadata,
}: SubmitPlanToolProps) {
  const submittedPlan = getSubmittedPlan(output);
  if (submittedPlan) return <SubmittedPlanCard plan={submittedPlan} />;

  const path = getSuspendedPlanPath(metadata, toolName, toolCallId);
  if (!path) return null;

  return (
    <ConnectedPendingPlanCard
      agentId={agentId}
      agentVersionId={agentVersionId}
      requestContext={requestContext}
      toolCallId={toolCallId}
      path={path}
    />
  );
}
