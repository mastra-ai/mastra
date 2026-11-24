/**
 * Stands in for Studio's `useLiveToolCalls` in MCP Apps (see `scripts/build-apps.ts`): the real hook draws a trace's
 * tool calls with the chat's live `ToolCard`, which brings the whole chat (forms, workflow graphs, nested MCP App
 * hosting) into the page, and asks the server for the agent's MCP app tools. Returning nothing leaves the trace
 * panels on their default, the cards drawn from what the trace recorded.
 */
export function useLiveToolCalls(_options?: { enabled?: boolean }): Record<string, never> {
  return {};
}
