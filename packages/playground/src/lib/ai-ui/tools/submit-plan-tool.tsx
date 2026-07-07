import { SubmitPlanBadge } from './badges/submit-plan-badge';
import type { SubmitPlanResult, SubmitPlanSuspendPayload } from './badges/types';
import type { MessageMetadata } from '@/lib/ai-ui/messages/message-metadata';

export interface SubmitPlanToolProps {
  toolName: string;
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

function isOptionalNonEmptyString(value: unknown): value is string | undefined {
  return value === undefined || (typeof value === 'string' && value.length > 0);
}

function isSubmitPlanSuspendPayload(payload: unknown): payload is SubmitPlanSuspendPayload {
  if (!isRecord(payload)) return false;

  const { path, title, plan } = payload;
  const hasPath = typeof path === 'string' && path.length > 0;
  const hasPlan = typeof plan === 'string' && plan.length > 0;

  return (
    (hasPath || hasPlan) &&
    isOptionalNonEmptyString(path) &&
    isOptionalNonEmptyString(title) &&
    isOptionalNonEmptyString(plan)
  );
}

function asSubmitPlanResult(output: unknown): SubmitPlanResult | undefined {
  if (!isRecord(output)) return undefined;

  const { content, isError, action, feedback, submittedPlan } = output;

  const hasValidSubmittedPlan =
    submittedPlan === undefined ||
    (isRecord(submittedPlan) &&
      isOptionalString(submittedPlan.path) &&
      isOptionalString(submittedPlan.title) &&
      isOptionalString(submittedPlan.plan));

  if (
    typeof content === 'string' &&
    typeof isError === 'boolean' &&
    (action === undefined || action === 'approved' || action === 'rejected') &&
    isOptionalString(feedback) &&
    hasValidSubmittedPlan
  ) {
    return {
      content,
      isError,
      ...(action !== undefined ? { action } : {}),
      ...(feedback !== undefined ? { feedback } : {}),
      ...(submittedPlan !== undefined ? { submittedPlan } : {}),
    };
  }

  return undefined;
}

export const SubmitPlanTool = ({ toolName, toolCallId, output, metadata }: SubmitPlanToolProps) => {
  const suspendPayload = (metadata?.suspendedTools?.[toolCallId] ?? metadata?.suspendedTools?.[toolName])
    ?.suspendPayload;

  if (!isSubmitPlanSuspendPayload(suspendPayload)) {
    return null;
  }

  return (
    <SubmitPlanBadge toolCallId={toolCallId} suspendPayload={suspendPayload} result={asSubmitPlanResult(output)} />
  );
};
