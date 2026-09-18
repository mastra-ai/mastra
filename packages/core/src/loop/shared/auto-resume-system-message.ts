/**
 * Auto-resume system-message injection.
 *
 * When `autoResumeSuspendedTools` is on, both the non-durable and durable
 * agentic loops scan the latest assistant message for suspended-tool /
 * pending-approval markers and append a directive to the system prompt
 * teaching the model how to construct `resumeData` and resume the tool.
 *
 * The two loops used to inline this logic, which is how the durable path
 * silently lost the system-message rewrite (Bug 2). Centralising it here
 * is the fix.
 */

import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import type { MastraDBMessage } from '../../agent/message-list';

/**
 * Returns the list of suspended (or pending-approval) tool descriptors from the
 * most recent assistant message, or an empty array if none are pending.
 *
 * Looks at `message.content.metadata.suspendedTools`,
 * `message.content.metadata.pendingToolApprovals`, and any
 * `data-tool-call-suspended` / `data-tool-call-approval` parts whose `resumed`
 * flag is falsy.
 */
export function extractSuspendedToolsFromMessages(
  messages: ReadonlyArray<MastraDBMessage>,
): Array<Record<string, unknown>> {
  const assistantMessages = [...messages].reverse().filter(message => message.role === 'assistant');
  const suspendedToolsMessage = assistantMessages.find(message => {
    const metadata = message.content.metadata as
      | { suspendedTools?: Record<string, unknown>; pendingToolApprovals?: Record<string, unknown> }
      | undefined;
    if (
      (metadata?.suspendedTools && Object.keys(metadata.suspendedTools).length > 0) ||
      (metadata?.pendingToolApprovals && Object.keys(metadata.pendingToolApprovals).length > 0)
    ) {
      return true;
    }
    const dataToolSuspendedParts = message.content.parts?.filter(
      part =>
        (part.type === 'data-tool-call-suspended' || part.type === 'data-tool-call-approval') &&
        !(part.data as { resumed?: boolean }).resumed,
    );
    return Boolean(dataToolSuspendedParts && dataToolSuspendedParts.length > 0);
  });

  if (!suspendedToolsMessage) return [];

  const metadata = suspendedToolsMessage.content.metadata as
    | { suspendedTools?: Record<string, unknown>; pendingToolApprovals?: Record<string, unknown> }
    | undefined;
  // Merge both metadata buckets — the same assistant turn can declare both
  // a suspended tool and a pending approval, and we should not lose one when
  // the other exists.
  const metadataEntries =
    metadata && (metadata.suspendedTools || metadata.pendingToolApprovals)
      ? { ...(metadata.suspendedTools ?? {}), ...(metadata.pendingToolApprovals ?? {}) }
      : undefined;
  let suspendedToolObj: Record<string, unknown> | undefined = metadataEntries
    ? Object.fromEntries(
        Object.entries(metadataEntries).map(([toolCallId, entry]) => [
          toolCallId,
          entry && typeof entry === 'object' && !Array.isArray(entry)
            ? { toolCallId, ...(entry as Record<string, unknown>) }
            : entry,
        ]),
      )
    : undefined;

  if (!suspendedToolObj) {
    suspendedToolObj = suspendedToolsMessage.content.parts
      ?.filter(part => part.type === 'data-tool-call-suspended' || part.type === 'data-tool-call-approval')
      ?.reduce(
        (acc, part, index) => {
          if (
            (part.type === 'data-tool-call-suspended' || part.type === 'data-tool-call-approval') &&
            !(part.data as { resumed?: boolean }).resumed
          ) {
            const data = part.data as { toolCallId?: string; toolName?: string };
            if (data.toolName) acc[data.toolCallId ?? `${data.toolName}-${index}`] = data;
          }
          return acc;
        },
        {} as Record<string, unknown>,
      );
  }

  if (!suspendedToolObj) return [];

  // The original tool call identifies the framework-persisted suspension. The
  // delegated run remains visible for diagnostics and backwards compatibility,
  // but the resume leg derives it from the selected suspended tool call.
  return Object.values(suspendedToolObj).map(entry => {
    if (!entry || typeof entry !== 'object') return entry as Record<string, unknown>;
    const { delegatedRunId, parentToolName, parentArgs, ...rest } = entry as Record<string, unknown>;
    const resumableEntry =
      typeof parentToolName === 'string'
        ? {
            ...rest,
            approvalToolName: rest.toolName,
            approvalArgs: rest.args,
            toolName: parentToolName,
            args: parentArgs,
          }
        : rest;
    return typeof delegatedRunId === 'string' ? { ...resumableEntry, runId: delegatedRunId } : resumableEntry;
  });
}

/**
 * Build the suffix to append to the leading system message when there are
 * suspended tools to auto-resume. Returns `null` when there are none, so
 * callers can skip the rewrite entirely.
 */
export function buildAutoResumeSystemMessageSuffix(
  suspendedTools: ReadonlyArray<Record<string, unknown>>,
): string | null {
  // Approval is a consent boundary and must only be resolved through the
  // explicit approval APIs, never reconstructed by the model from a message.
  const resumableTools = suspendedTools.filter(tool => tool.type !== 'approval');
  if (resumableTools.length === 0) return null;
  // parentRunId is internal bookkeeping for channel resume routing. The model
  // uses the original toolCallId to identify the suspension; runId remains
  // visible only for compatibility and diagnostics.
  const toolsForPrompt = resumableTools.map(({ parentRunId: _parentRunId, ...rest }) => rest);
  return `\n\nAnalyse the suspended tools: ${JSON.stringify(toolsForPrompt)}, using the messages available to you and the resumeSchema of each suspended tool, find the tool whose resumeData you can construct properly.
                      resumeData can not be an empty object nor null/undefined.
                      When you find that and call that tool, add the resumeData to the tool call arguments/input.
                      Also, add the toolCallId of the suspended tool as suspendedToolCallId to the tool call arguments/input. This identifies the exact framework-persisted suspension to resume.
                      You may also add the runId as suspendedToolRunId for compatibility, but it does not select the suspension and must match the runId associated with suspendedToolCallId.
                      If the suspendedTool.type is 'approval', resumeData will be an object that contains 'approved' which can either be true or false depending on the user's message. If you can't construct resumeData from the message for approval type, set approved to true and add resumeData: { approved: true } to the tool call arguments/input.

                      IMPORTANT: If you're able to construct resumeData and get suspendedToolCallId, get the previous arguments/input of the tool call from args in the suspended tool, and spread it in the new arguments/input created, do not add duplicate data.
                      `;
}

/**
 * Append `suffix` to the first system message in `inputMessages`, returning a
 * new array. No-ops (returns the input unchanged) when `suffix` is null or
 * there is no leading system message.
 */
export function appendSuffixToLeadingSystemMessage(
  inputMessages: LanguageModelV2Prompt,
  suffix: string | null,
): LanguageModelV2Prompt {
  if (!suffix) return inputMessages;
  return inputMessages.map((message, index) => {
    if (message.role === 'system' && index === 0) {
      return { ...message, content: message.content + suffix };
    }
    return message;
  });
}

/**
 * Convenience wrapper: scan `messages` for suspended tools, and if any are
 * present, append the auto-resume directive to the leading system message.
 * Pass-through when `autoResume` is false or no suspended tools are found.
 */
export function applyAutoResumeSystemMessage({
  autoResume,
  inputMessages,
  messages,
}: {
  autoResume: boolean | undefined;
  inputMessages: LanguageModelV2Prompt;
  messages: ReadonlyArray<MastraDBMessage>;
}): LanguageModelV2Prompt {
  if (!autoResume) return inputMessages;
  const suspendedTools = extractSuspendedToolsFromMessages(messages);
  const suffix = buildAutoResumeSystemMessageSuffix(suspendedTools);
  return appendSuffixToLeadingSystemMessage(inputMessages, suffix);
}
