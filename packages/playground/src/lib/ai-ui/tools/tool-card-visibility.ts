import type { AskUserSuspendPayload } from './badges/types';

const TASK_TOOL_NAMES = new Set(['task_write', 'task_update', 'task_complete', 'task_check']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isAskUserSuspendPayload = (payload: unknown): payload is AskUserSuspendPayload =>
  isRecord(payload) && typeof payload.question === 'string';

// Inline-hidden tools must not participate in message-level tool grouping or
// leave separators behind when their ToolCard renders no visible content.
export const isInlineToolCallHidden = (toolName: string) =>
  toolName === 'updateWorkingMemory' || TASK_TOOL_NAMES.has(toolName);

export const getAskUserSuspendPayload = (
  metadata: unknown,
  toolName: string,
  toolCallId: string,
): AskUserSuspendPayload | undefined => {
  if (!isRecord(metadata) || !isRecord(metadata.suspendedTools)) return undefined;

  const suspendedTool = metadata.suspendedTools[toolName] ?? metadata.suspendedTools[toolCallId];
  if (!isRecord(suspendedTool)) return undefined;

  return isAskUserSuspendPayload(suspendedTool.suspendPayload) ? suspendedTool.suspendPayload : undefined;
};
