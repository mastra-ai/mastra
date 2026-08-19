import { Tool, ToolContent, ToolHeader, ToolIcon } from '@mastra/playground-ui/components/ai/tool-call';
import { ToolsIcon } from '@mastra/playground-ui/icons/ToolsIcon';
import { AskUserBadge } from './badges/ask-user-badge';
import type { AskUserResult } from './badges/types';
import { getAskUserSuspendPayload } from './tool-card-visibility';
import type { MessageMetadata } from '@/lib/ai-ui/messages/message-metadata';

export interface AskUserToolProps {
  toolName: string;
  toolCallId: string;
  output: unknown;
  metadata?: MessageMetadata;
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
  const suspendPayload = getAskUserSuspendPayload(metadata, toolName, toolCallId);

  if (!suspendPayload) {
    return null;
  }

  const result = asAskUserResult(output);

  return (
    <Tool status={result ? 'success' : 'running'} defaultOpen aria-label={`Tool: ${toolName}`}>
      <ToolHeader>
        <ToolIcon tooltip="Tool">
          <ToolsIcon className="text-accent6" />
        </ToolIcon>
        Ask user
      </ToolHeader>
      <ToolContent>
        <AskUserBadge toolCallId={toolCallId} suspendPayload={suspendPayload} result={result} />
      </ToolContent>
    </Tool>
  );
};
