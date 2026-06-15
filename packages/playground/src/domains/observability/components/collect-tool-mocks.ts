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
};

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
 * tool mocks. Nested children (tool calls inside workflow/agent steps) are
 * included depth-first so the mock order mirrors the recorded call order.
 */
export function collectToolMocks(
  steps: ToolCallTrajectoryStep[] | undefined,
  acc: DerivedToolMock[] = [],
): DerivedToolMock[] {
  if (!steps) return acc;
  for (const step of steps) {
    if ((step.stepType === 'tool_call' || step.stepType === 'mcp_tool_call') && step.name) {
      acc.push({
        toolName: extractToolName(step.name),
        args: step.toolArgs ?? {},
        output: step.toolResult,
      });
    }
    if (step.children?.length) {
      collectToolMocks(step.children, acc);
    }
  }
  return acc;
}
