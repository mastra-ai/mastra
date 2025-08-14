/**
 * Helper functions for AI SDK v5 compatibility
 */

/**
 * Extract tool name from AI SDK v5 tool type string
 *
 * V5 format: "tool-${toolName}" or "dynamic-tool"
 * V4 format: "tool-invocation"
 *
 * @param type - The tool type string from AI SDK v5
 * @returns The tool name or 'dynamic-tool' if it's a dynamic tool
 */
export function getToolName(type: string | { type: string }): string {
  // Handle objects with type property
  if (typeof type === 'object' && type && 'type' in type) {
    type = type.type;
  }

  // Ensure type is a string
  if (typeof type !== 'string') {
    return 'unknown';
  }

  if (type === 'dynamic-tool') {
    return 'dynamic-tool';
  }

  // Extract tool name from "tool-${toolName}" format
  if (type.startsWith('tool-')) {
    return type.slice('tool-'.length); // Remove "tool-" prefix
  }

  // Fallback for unexpected formats
  return type;
}
