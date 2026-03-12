const TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export const FALLBACK_TOOL_NAME = 'unknown_tool';

export function sanitizeToolName(toolName: unknown): string {
  if (typeof toolName !== 'string') {
    return FALLBACK_TOOL_NAME;
  }

  return TOOL_NAME_PATTERN.test(toolName) ? toolName : FALLBACK_TOOL_NAME;
}
