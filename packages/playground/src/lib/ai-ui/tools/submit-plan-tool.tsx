import type { SubmitPlanSuspendPayload } from '@mastra/core/tools';
import { SubmitPlanBadge } from './badges/submit-plan-badge';
import type { SubmitPlanStatus } from './badges/submit-plan-badge';
import type { MessageMetadata } from '@/lib/ai-ui/messages/message-metadata';

export interface SubmitPlanToolProps {
  toolCallId: string;
  output: unknown;
  metadata?: MessageMetadata;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isSubmitPlanSuspendPayload(payload: unknown): payload is SubmitPlanSuspendPayload {
  if (!isRecord(payload)) return false;

  const { path, title, plan } = payload;
  return typeof path === 'string' && path.trim().length > 0 && isOptionalString(title) && isOptionalString(plan);
}

function getResultContent(output: unknown): string | undefined {
  if (!isRecord(output)) return undefined;

  return typeof output.content === 'string' ? output.content : undefined;
}

function getResultStatus(output: unknown): SubmitPlanStatus | undefined {
  if (!isRecord(output)) return undefined;
  if (output.isError === true) return 'failed';
  if (!isRecord(output.submittedPlan)) return undefined;

  const { action } = output.submittedPlan;
  return action === 'approved' || action === 'rejected' ? action : undefined;
}

function getSubmittedPlan(output: unknown): SubmitPlanSuspendPayload | undefined {
  if (!isRecord(output)) return undefined;
  return isSubmitPlanSuspendPayload(output.submittedPlan) ? output.submittedPlan : undefined;
}

export const SubmitPlanTool = ({ toolCallId, output, metadata }: SubmitPlanToolProps) => {
  const metadataPayload = (metadata?.suspendedTools?.[toolCallId] ?? metadata?.suspendedTools?.submit_plan)
    ?.suspendPayload;
  const suspendPayload = getSubmittedPlan(output) ?? metadataPayload;

  if (!isSubmitPlanSuspendPayload(suspendPayload)) {
    return null;
  }

  return (
    <SubmitPlanBadge
      toolCallId={toolCallId}
      suspendPayload={suspendPayload}
      resultContent={getResultContent(output)}
      resultStatus={getResultStatus(output)}
    />
  );
};
