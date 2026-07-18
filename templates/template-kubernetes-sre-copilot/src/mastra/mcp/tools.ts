import { noopObserve } from '@mastra/core/tools';
import { k8sMcpClient, READ_ONLY_TOOL_NAMES } from './k8s-mcp-client';
import { enforceReadOnly } from '../lib/policy';

const allTools = await k8sMcpClient.listTools();

// Only the explicitly allowlisted read tools are usable anywhere in this template — by the
// chat agent (via function-calling) and by the diagnosis workflow (via direct `.execute()`
// calls below). See ../lib/policy.ts for what enforceReadOnly actually checks.
const allowlisted = Object.fromEntries(
  Object.entries(allTools).filter(([name]) => READ_ONLY_TOOL_NAMES.some(allowed => name.endsWith(allowed))),
);

export const readOnlyTools = enforceReadOnly(allowlisted, READ_ONLY_TOOL_NAMES);

/**
 * Look up one of the guarded read-only tools by its unqualified `kubernetes-mcp-server` name
 * (e.g. `"pods_get"`), regardless of the `${serverName}_` namespace prefix `listTools()` adds.
 * Throws if the tool isn't present — a missing tool at workflow-build time is a config problem
 * worth failing loudly on, not silently skipping a diagnostic step for.
 */
export function getTool(unqualifiedName: (typeof READ_ONLY_TOOL_NAMES)[number]) {
  const entry = Object.entries(readOnlyTools).find(([name]) => name.endsWith(unqualifiedName));
  if (!entry) {
    throw new Error(
      `Tool "${unqualifiedName}" was not found among the MCP server's read-only tools. Is kubernetes-mcp-server reachable and running the expected version?`,
    );
  }
  return entry[1];
}

/** Minimal call signature for invoking a guarded tool directly from inside a workflow step. */
export async function callTool(unqualifiedName: (typeof READ_ONLY_TOOL_NAMES)[number], inputData: unknown) {
  const tool = getTool(unqualifiedName);
  if (!tool.execute) {
    throw new Error(`Tool "${unqualifiedName}" has no execute function.`);
  }
  return tool.execute(inputData as never, { observe: noopObserve } as never);
}
