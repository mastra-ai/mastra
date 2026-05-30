import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { MastraDBMessageMetadata } from './types';

/**
 * Reload normalization for persisted messages handed to `useChat` via
 * `initialMessages`.
 *
 * The old `resolveInitialMessages` layer performed two reload-only conversions
 * that the live streaming path does not cover. They are reinstated here so a
 * reloaded thread behaves like a streamed one:
 *
 *  1. The server persists pending tool approvals as
 *     `content.metadata.pendingToolApprovals`, but the approval UI reads
 *     `content.metadata.requireApprovalMetadata` (gated on `mode`). Without the
 *     conversion the Approve/Decline buttons vanish on refresh and the run cannot
 *     be resumed.
 *  2. Completion-feedback assistant messages flagged `suppressFeedback` are
 *     persisted to memory but meant to stay hidden in the UI; without the filter
 *     they reappear after a reload.
 */

type ApprovalEntry = { toolCallId?: string; toolName?: string; args?: unknown; runId?: string };

const isToolResolved = (message: MastraDBMessage, toolCallId: string): boolean =>
  message.content.parts.some(part => {
    if (part.type === 'tool-invocation') {
      const inv = part.toolInvocation as { toolCallId?: string; state?: string; result?: unknown };
      return (
        inv.toolCallId === toolCallId &&
        (inv.state === 'result' || inv.state === 'output-error' || inv.state === 'output-denied' || inv.result != null)
      );
    }
    const dyn = part as { type?: string; toolCallId?: string; output?: unknown };
    return dyn.type === 'dynamic-tool' && dyn.toolCallId === toolCallId && dyn.output != null;
  });

const restorePendingApprovalMetadata = (message: MastraDBMessage): MastraDBMessage => {
  if (message.role !== 'assistant') return message;

  const metadata = message.content.metadata as
    | (MastraDBMessageMetadata & { pendingToolApprovals?: Record<string, ApprovalEntry> })
    | undefined;
  if (!metadata) return message;

  const pendingToolApprovals = metadata.pendingToolApprovals;
  const suspendedTools = metadata.suspendedTools;
  if (!pendingToolApprovals && !suspendedTools) return message;

  const stillPending: Record<string, ApprovalEntry> = {};
  if (pendingToolApprovals) {
    for (const [key, approval] of Object.entries(pendingToolApprovals)) {
      if (!approval || typeof approval !== 'object' || !approval.toolCallId) continue;
      if (!isToolResolved(message, approval.toolCallId)) stillPending[key] = approval;
    }
  }

  const hasPending = Object.keys(stillPending).length > 0;
  if (!hasPending && !suspendedTools) return message;

  return {
    ...message,
    content: {
      ...message.content,
      metadata: {
        ...metadata,
        mode: metadata.mode ?? 'stream',
        ...(hasPending
          ? {
              requireApprovalMetadata: {
                ...metadata.requireApprovalMetadata,
                ...stillPending,
              },
            }
          : {}),
      },
    },
  };
};

const isSuppressedFeedbackMessage = (message: MastraDBMessage): boolean => {
  if (message.role !== 'assistant') return false;
  const metadata = message.content.metadata as
    | { completionResult?: { suppressFeedback?: boolean }; isTaskCompleteResult?: { suppressFeedback?: boolean } }
    | undefined;
  return Boolean(metadata?.completionResult?.suppressFeedback || metadata?.isTaskCompleteResult?.suppressFeedback);
};

/**
 * Apply the reload-only conversions to persisted `initialMessages`: drop
 * suppressed completion-feedback messages and derive `requireApprovalMetadata`
 * from persisted `pendingToolApprovals`.
 */
export const normalizeReloadedMessages = (messages: MastraDBMessage[]): MastraDBMessage[] =>
  messages.filter(message => !isSuppressedFeedbackMessage(message)).map(restorePendingApprovalMetadata);
