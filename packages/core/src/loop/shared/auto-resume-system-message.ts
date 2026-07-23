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
      { suspendedTools?: Record<string, unknown>; pendingToolApprovals?: Record<string, unknown> } | undefined;
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
    { suspendedTools?: Record<string, unknown>; pendingToolApprovals?: Record<string, unknown> } | undefined;
  // Merge both metadata buckets — the same assistant turn can declare both
  // a suspended tool and a pending approval, and we should not lose one when
  // the other exists.
  let suspendedToolObj: Record<string, unknown> | undefined =
    metadata && (metadata.suspendedTools || metadata.pendingToolApprovals)
      ? { ...(metadata.suspendedTools ?? {}), ...(metadata.pendingToolApprovals ?? {}) }
      : undefined;

  if (!suspendedToolObj) {
    suspendedToolObj = suspendedToolsMessage.content.parts
      ?.filter(part => part.type === 'data-tool-call-suspended' || part.type === 'data-tool-call-approval')
      ?.reduce(
        (acc, part) => {
          if (
            (part.type === 'data-tool-call-suspended' || part.type === 'data-tool-call-approval') &&
            !(part.data as { resumed?: boolean }).resumed
          ) {
            const data = part.data as { toolName?: string };
            if (data.toolName) acc[data.toolName] = data;
          }
          return acc;
        },
        {} as Record<string, unknown>,
      );
  }

  if (!suspendedToolObj) return [];

  // The auto-resume directive tells the model to pass the entry's `runId` back
  // as `suspendedToolRunId`, which the resume leg uses to resume the suspended
  // (inner) run. Persisted metadata stores the OUTER resumable runId with the
  // inner run as `delegatedRunId`, so surface the inner run under `runId` here.
  return Object.values(suspendedToolObj).map(entry => {
    if (!entry || typeof entry !== 'object') return entry as Record<string, unknown>;
    const { delegatedRunId, ...rest } = entry as Record<string, unknown>;
    return typeof delegatedRunId === 'string' ? { ...rest, runId: delegatedRunId } : rest;
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
  if (suspendedTools.length === 0) return null;
  // parentRunId is internal bookkeeping for channel resume routing; the model
  // only needs runId (as suspendedToolRunId). Omitting it keeps the prompt
  // byte-identical to existing LLM recordings.
  const toolsForPrompt = suspendedTools.map(({ parentRunId: _parentRunId, ...rest }) => rest);
  return `\n\nAnalyse the suspended tools: ${JSON.stringify(toolsForPrompt)}, using the messages available to you and the resumeSchema of each suspended tool, find the tool whose resumeData you can construct properly.
                      resumeData can not be an empty object nor null/undefined.
                      When you find that and call that tool, add the resumeData to the tool call arguments/input.
                      Also, add the runId of the suspended tool as suspendedToolRunId to the tool call arguments/input.
                      If the suspendedTool.type is 'approval', resumeData will be an object that contains 'approved' which can either be true or false depending on the user's message. If you can't construct resumeData from the message for approval type, set approved to true and add resumeData: { approved: true } to the tool call arguments/input.

                      IMPORTANT: If you're able to construct resumeData and get suspendedToolRunId, get the previous arguments/input of the tool call from args in the suspended tool, and spread it in the new arguments/input created, do not add duplicate data. 
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
