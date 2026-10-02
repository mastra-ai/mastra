import type { MessageMetadata } from '../messages/message-metadata';
import { AskUserBadge } from './badges/ask-user-badge';
import type { AskUserPayload, AskUserResult } from '@/ds/components/ai/ask-user';

export interface AskUserToolProps {
  toolName: string;
  toolCallId: string;
  output: unknown;
  metadata?: MessageMetadata;
}

function isAskUserPayload(payload: unknown): payload is AskUserPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'question' in payload &&
    typeof (payload as AskUserPayload).question === 'string'
  );
}

function asAskUserResult(output: unknown): AskUserResult | undefined {
  if (typeof output === 'object' && output !== null && typeof (output as AskUserResult).content === 'string') {
    return output as AskUserResult;
  }
  return undefined;
}

/**
 * Factory-level tool component for the `ask_user` tool. `ToolCard` delegates here
 * when `toolName === 'ask_user'`, and this component resolves the suspend payload
 * and renders the interactive {@link AskUserBadge}.
 *
 * The suspend payload is read from `metadata.suspendedTools` directly (bypassing
 * the `mode` check `ToolCard` applies to other suspended tools) because when
 * messages are loaded from the database, `metadata.mode` may not be persisted.
 * The payload may be keyed by `toolName` (legacy core) or by `toolCallId`
 * (new core), so both keys are tried.
 */
export const AskUserTool = ({ toolName, toolCallId, output, metadata }: AskUserToolProps) => {
  const suspendPayload = (metadata?.suspendedTools?.[toolName] ?? metadata?.suspendedTools?.[toolCallId])
    ?.suspendPayload;

  if (!isAskUserPayload(suspendPayload)) {
    return null;
  }

  return <AskUserBadge toolCallId={toolCallId} suspendPayload={suspendPayload} result={asAskUserResult(output)} />;
};
