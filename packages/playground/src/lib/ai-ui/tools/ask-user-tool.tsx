import { AskUserBadge } from './badges/ask-user-badge';
import type { AskUserResult, AskUserSuspendPayload } from './badges/types';
import type { MessageMetadata } from '@/lib/ai-ui/messages/message-metadata';

export interface AskUserToolProps {
  toolName: string;
  toolCallId: string;
  output: unknown;
  metadata?: MessageMetadata;
}

function isAskUserSuspendPayload(payload: unknown): payload is AskUserSuspendPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'question' in payload &&
    typeof (payload as AskUserSuspendPayload).question === 'string'
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

  if (!isAskUserSuspendPayload(suspendPayload)) {
    return null;
  }

  return <AskUserBadge toolCallId={toolCallId} suspendPayload={suspendPayload} result={asAskUserResult(output)} />;
};
