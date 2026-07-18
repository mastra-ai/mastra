import { noopObserve } from '@mastra/core/tools';
import { k8sMcpClient, isReadOnlyToolName, unqualifyToolName, READ_ONLY_TOOL_NAMES } from './k8s-mcp-client';
import { enforceReadOnly } from '../lib/policy';

const allTools = await k8sMcpClient.listTools();

// Only the explicitly allowlisted read tools are usable anywhere in this template — by the
// chat agent (via function-calling) and by the diagnosis workflow (via direct `.execute()`
// calls below). Matching is exact (unqualify-then-equality, see isReadOnlyToolName), never a
// substring/endsWith check — a suffix match would let a maliciously named tool from a compromised
// or misconfigured server (e.g. "kubernetes_malicious_pods_list") impersonate an allowlisted one.
const qualifiedAllowlist = Object.keys(allTools).filter(isReadOnlyToolName);

const allowlisted = Object.fromEntries(
  Object.entries(allTools).filter(([name]) => qualifiedAllowlist.includes(name)),
);

export const readOnlyTools = enforceReadOnly(allowlisted, qualifiedAllowlist);

/**
 * Look up one of the guarded read-only tools by its unqualified `kubernetes-mcp-server` name
 * (e.g. `"pods_get"`), regardless of the `${SERVER_KEY}_` namespace prefix `listTools()` adds.
 * Exact match on the unqualified name only (see unqualifyToolName) — not a substring/endsWith
 * check, for the same reason noted above. Throws if the tool isn't present — a missing tool at
 * workflow-build time is a config problem worth failing loudly on, not silently skipping a
 * diagnostic step for.
 */
export function getTool(unqualifiedName: (typeof READ_ONLY_TOOL_NAMES)[number]) {
  const entry = Object.entries(readOnlyTools).find(([name]) => unqualifyToolName(name) === unqualifiedName);
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
