import type { SubmitPlanSuspendPayload } from '@mastra/core/tools';
import { SubmitPlanBadge } from './badges/submit-plan-badge';
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

function isSubmitPlanSuspendPayload(payload: unknown): payload is SubmitPlanSuspendPayload {
  if (!isRecord(payload)) return false;

  const { path, title, plan } = payload;
  return typeof path === 'string' && path.trim().length > 0 && isOptionalString(title) && isOptionalString(plan);
}

function getResultContent(output: unknown): string | undefined {
  if (!isRecord(output)) return undefined;

  return typeof output.content === 'string' ? output.content : undefined;
}

export const SubmitPlanTool = ({ toolName, toolCallId, output, metadata }: SubmitPlanToolProps) => {
  const suspendPayload = (metadata?.suspendedTools?.[toolCallId] ?? metadata?.suspendedTools?.[toolName])
    ?.suspendPayload;

  if (!isSubmitPlanSuspendPayload(suspendPayload)) {
    return null;
  }

  return (
    <SubmitPlanBadge toolCallId={toolCallId} suspendPayload={suspendPayload} resultContent={getResultContent(output)} />
  );
};
