import type { AgentRunResumeInput } from '../observability';

/** Identity of the tool call a resumed run continues into, when the snapshot records one. */
export interface SuspendedToolInfo {
  toolCallId?: string;
  toolName?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Builds the `input` recorded on a resumed `AGENT_RUN` span.
 *
 * The resume data is always recorded as an object: an object is spread, anything
 * else is kept under `resumeData`. When the suspended tool is known its
 * identity is added; if the resume data names a different tool, the caller's
 * data is nested so the suspended tool's identity stays authoritative.
 */
export function buildResumeSpanInput(resumeData: unknown, suspendedToolInfo?: SuspendedToolInfo): AgentRunResumeInput {
  const resumeInput: AgentRunResumeInput = isRecord(resumeData) ? { ...resumeData } : { resumeData };

  if (!suspendedToolInfo?.toolName && !suspendedToolInfo?.toolCallId) {
    return resumeInput;
  }

  const hasConflictingToolName =
    suspendedToolInfo.toolName &&
    resumeInput.toolName !== undefined &&
    resumeInput.toolName !== suspendedToolInfo.toolName;
  const hasConflictingToolCallId =
    suspendedToolInfo.toolCallId &&
    resumeInput.toolCallId !== undefined &&
    resumeInput.toolCallId !== suspendedToolInfo.toolCallId;
  const spanInput: AgentRunResumeInput =
    hasConflictingToolName || hasConflictingToolCallId ? { resumeData: resumeInput } : resumeInput;

  if (suspendedToolInfo.toolName) {
    spanInput.toolName = suspendedToolInfo.toolName;
  }
  if (suspendedToolInfo.toolCallId) {
    spanInput.toolCallId = suspendedToolInfo.toolCallId;
  }
  return spanInput;
}
