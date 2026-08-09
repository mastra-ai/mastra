/**
 * Shared helpers for the tool-call approval / decline flow.
 *
 * The decline reason is persisted on `approval.reason` and is read back by the
 * message-list adapters, the network loop and the memory processors. Callers can
 * supply a custom reason (see `Agent.declineToolCall({ reason })`); when they
 * don't, this default keeps the historical message.
 */
export const DEFAULT_TOOL_DECLINE_REASON = 'Tool call was not approved by the user';

/**
 * Extracts a caller-supplied decline reason from approval resume data.
 *
 * Accepts both `{ approved: false, reason }` (the `declineToolCall` shape) and
 * `{ approved: false, declineContext: { reason } }`-flattened variants produced
 * by `sendToolApproval`. Falls back to {@link DEFAULT_TOOL_DECLINE_REASON}.
 */
export function resolveDeclineReason(resumeData: unknown): string {
  if (!resumeData || typeof resumeData !== 'object') return DEFAULT_TOOL_DECLINE_REASON;
  const reason = (resumeData as { reason?: unknown }).reason;
  if (typeof reason === 'string' && reason.trim().length > 0) return reason;
  return DEFAULT_TOOL_DECLINE_REASON;
}
