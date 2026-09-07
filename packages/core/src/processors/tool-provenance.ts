/** In-process provenance only. Symbols are omitted from persisted tool schemas. */
export const PROCESSOR_TOOL_OWNER = Symbol('mastra.processorToolOwner');

export function getProcessorToolOwner(tool: unknown): string | undefined {
  return typeof tool === 'object' && tool !== null
    ? (tool as { [PROCESSOR_TOOL_OWNER]?: string })[PROCESSOR_TOOL_OWNER]
    : undefined;
}

export function markProcessorTools<T extends Record<string, object>>(tools: T, processorId: string): T {
  for (const tool of Object.values(tools)) {
    Object.defineProperty(tool, PROCESSOR_TOOL_OWNER, { value: processorId, enumerable: true });
  }
  return tools;
}
