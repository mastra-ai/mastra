export type ToolCallTrajectoryStep = {
  stepType?: string;
  name?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  children?: ToolCallTrajectoryStep[];
};

export type DerivedToolMock = {
  toolName: string;
  args: Record<string, unknown>;
  output: unknown;
  matchArgs?: 'strict' | 'ignore';
};

/**
 * Sub-agent delegation is exposed to the parent as a tool named `agent-<name>`
 * (see `Agent.listAgentTools`). Its `args.prompt` is free LLM-authored text plus
 * runtime-injected fields (threadId, resourceId, suspendedToolRunId), so strict
 * deep-equality almost never matches on replay. Derive these as `ignore` mocks
 * so the saved mock works out of the box; the user can tighten it to `strict`.
 */
function isSubAgentDelegation(toolName: string): boolean {
  return toolName.startsWith('agent-');
}

/**
 * Tool-call trajectory steps carry a display label as their `name`, not the bare
 * tool name. Tool spans are named `tool: '<name>'` and MCP tool spans are named
 * `mcp_tool: '<name>' on '<server>'` (see tool-builder). The tool-mock matcher
 * keys on the registered tool name, so we recover `<name>` from the label.
 */
function extractToolName(label: string): string {
  const match = label.match(/^(?:mcp_)?tool:\s*'(.*?)'/);
  return match ? match[1] : label;
}

/**
 * Walk trajectory steps in order, collecting tool/MCP-tool calls as item-level
 * tool mocks. Nested children of non-tool container steps (e.g. workflow steps)
 * are walked depth-first so the mock order mirrors the recorded call order.
 *
 * A tool-call step's OWN children are NOT collected: for a delegated sub-agent,
 * those children are the sub-agent's internal tool calls (e.g. `lookupBalance`
 * under `agent-balanceAgent`). Those run inside the sub-agent and never reach
 * the target agent's tool-mock matcher, so a mock for them can never be served.
 * We only collect top-level calls the target agent itself makes — including the
 * sub-agent delegation call, which mocks the sub-agent's whole response.
 */
export function collectToolMocks(
  steps: ToolCallTrajectoryStep[] | undefined,
  acc: DerivedToolMock[] = [],
): DerivedToolMock[] {
  if (!steps) return acc;
  for (const step of steps) {
    const isToolCall = step.stepType === 'tool_call' || step.stepType === 'mcp_tool_call';
    if (isToolCall && step.name) {
      const toolName = extractToolName(step.name);
      acc.push({
        toolName,
        args: step.toolArgs ?? {},
        output: step.toolResult,
        // Sub-agent delegation args are LLM-authored + runtime-injected; default
        // to ignore-args matching so the saved mock matches on replay.
        ...(isSubAgentDelegation(toolName) ? { matchArgs: 'ignore' as const } : {}),
      });
    }
    // Skip a tool call's own children (sub-agent internals); only recurse into
    // non-tool container steps to preserve nested top-level call order.
    if (!isToolCall && step.children?.length) {
      collectToolMocks(step.children, acc);
    }
  }
  return acc;
}
