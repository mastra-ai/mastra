/** Maximum time to retain a running tool's result after caller cancellation. */
export const TOOL_ABORT_GRACE_MS = 250;

export const TOOL_ABORT_NOTICE =
  'Tool execution was aborted while running. The tool may still be running and its effects are unknown. Check its status before retrying.';
