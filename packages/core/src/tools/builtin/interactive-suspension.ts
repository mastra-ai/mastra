/** Discriminators for built-in interactive tool suspend payloads. */
export const INTERACTIVE_TOOL_SUSPENSION_KINDS = {
  askUser: 'user_question_request',
  submitPlan: 'plan_approval_request',
  requestAccess: 'sandbox_access_request',
} as const;

export type InteractiveToolSuspensionKind =
  (typeof INTERACTIVE_TOOL_SUSPENSION_KINDS)[keyof typeof INTERACTIVE_TOOL_SUSPENSION_KINDS];

/** Payload emitted by the host's `request_access` tool. */
export interface RequestAccessSuspendPayload {
  kind: typeof INTERACTIVE_TOOL_SUSPENSION_KINDS.requestAccess;
  path: string;
  reason: string;
}
