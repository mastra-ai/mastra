import { SubmitPlanBadge } from './badges/submit-plan-badge';
import type { SubmitPlanResult, SubmitPlanSuspendPayload } from './badges/types';
import type { MessageMetadata } from '@/lib/ai-ui/messages/message-metadata';

export interface SubmitPlanToolProps {
  toolName: string;
  toolCallId: string;
  output: unknown;
  metadata?: MessageMetadata;
}

function isSubmitPlanSuspendPayload(payload: unknown): payload is SubmitPlanSuspendPayload {
  if (typeof payload !== 'object' || payload === null) return false;

  const candidate = payload as Partial<SubmitPlanSuspendPayload>;
  const hasPath = typeof candidate.path === 'string' && candidate.path.length > 0;
  const hasPlan = typeof candidate.plan === 'string' && candidate.plan.length > 0;

  return (
    (hasPath || hasPlan) &&
    (candidate.path === undefined || typeof candidate.path === 'string') &&
    (candidate.title === undefined || typeof candidate.title === 'string') &&
    (candidate.plan === undefined || typeof candidate.plan === 'string')
  );
}

function asSubmitPlanResult(output: unknown): SubmitPlanResult | undefined {
  if (typeof output === 'object' && output !== null && typeof (output as SubmitPlanResult).content === 'string') {
    return output as SubmitPlanResult;
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
