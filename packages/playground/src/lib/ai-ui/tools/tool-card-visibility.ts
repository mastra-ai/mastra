const TASK_TOOL_NAMES = new Set(['task_write', 'task_update', 'task_complete', 'task_check']);

// Inline-hidden tools must not participate in message-level tool grouping or
// leave separators behind when their ToolCard renders no visible content.
export const isInlineToolCallHidden = (toolName: string) =>
  toolName === 'updateWorkingMemory' || TASK_TOOL_NAMES.has(toolName);
