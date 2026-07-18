import type { Tool } from '@mastra/core/tools';

/**
 * Safety/policy gate.
 *
 * v1 has no write tools registered anywhere in this template — there is nothing for this module
 * to "allow." It exists anyway, built and tested now, so that v2's write capability (Phase 4 in
 * the README roadmap: scale/restart behind mandatory human approval) slots into an existing gate
 * instead of getting bolted on under time pressure later.
 *
 * Every tool call this agent makes flows through `enforceReadOnly` before it reaches the MCP
 * server:
 *
 *   tool call -> classifyAction -> reject anything that isn't a read -> log the attempt
 *
 * This is deliberately redundant with `kubernetes-mcp-server --read-only` at the transport layer
 * (see ../mcp/k8s-mcp-client.ts). Defense in depth: if the MCP server were ever misconfigured
 * without `--read-only`, this gate still blocks the call before it leaves the process.
 */

export class PolicyViolationError extends Error {
  constructor(
    public readonly toolName: string,
    public readonly action: ActionType,
  ) {
    super(`Policy denied "${toolName}" (classified as "${action}"). v1 permits read-only actions only.`);
    this.name = 'PolicyViolationError';
  }
}

export type ActionType = 'read' | 'write';

/**
 * A tool name is classified as a write if it doesn't look like one of the known-safe read verbs.
 * This is intentionally conservative: unknown tool names default to "write" and get rejected,
 * rather than silently allowed through.
 *
 * This substring `includes()` check is deliberately loose and is NOT itself a security boundary —
 * `enforceReadOnly` below only allows a call through when this AND an exact-equality allowlist
 * check both pass (`action === 'read' && isAllowlisted`). A tool name could theoretically contain
 * "list" as a substring without being a real read tool, but it would still be rejected unless it
 * exactly matches one of the small, explicit set of qualified names in the allowlist. Don't loosen
 * the allowlist check into a substring/prefix/suffix match to "simplify" this function — that's
 * exactly the mistake this module was fixed for once already (see `../mcp/k8s-mcp-client.ts`).
 */
const READ_VERBS = ['list', 'get', 'log', 'logs', 'top', 'view', 'describe', 'stats', 'contexts'];

/**
 * Classifies a tool name as `'read'` or `'write'` by loose substring match against `READ_VERBS`.
 * See the module comment above `READ_VERBS` for why this is deliberately loose and only safe when
 * combined with the exact-equality allowlist check in `enforceReadOnly` below.
 */
export function classifyAction(toolName: string): ActionType {
  const normalized = toolName.toLowerCase();
  return READ_VERBS.some(verb => normalized.includes(verb)) ? 'read' : 'write';
}

export interface PolicyLogEntry {
  timestamp: string;
  toolName: string;
  action: ActionType;
  allowed: boolean;
}

/** In-memory log of every policy decision made this process. Exposed for the agent/UI to inspect. */
export const policyLog: PolicyLogEntry[] = [];

/** Records one policy decision to `policyLog` and warns on the console if the call was rejected. */
function logAttempt(toolName: string, action: ActionType, allowed: boolean) {
  const entry: PolicyLogEntry = { timestamp: new Date().toISOString(), toolName, action, allowed };
  policyLog.push(entry);
  if (!allowed) {
    console.warn(`[policy] rejected non-read tool call: ${toolName}`);
  }
}

/**
 * Wraps a set of MCP tools so every execution is checked against `allowedNames` and against
 * `classifyAction`. Both checks must pass, or the call is rejected before the underlying tool
 * ever runs. Every attempt, allowed or rejected, is recorded in `policyLog`.
 *
 * `allowedNames` must be the exact, fully-qualified tool names (e.g. `"kubernetes_pods_get"`,
 * as returned by `MCPClient.listTools()` — see `qualifiedAllowlist` in `../mcp/tools.ts`), and
 * the match below is exact equality only. This was previously an `endsWith` suffix check, which
 * is a real vulnerability: `"kubernetes_malicious_pods_list".endsWith("pods_list")` is true, so a
 * compromised or misconfigured MCP server could register a tool under a name crafted to pass the
 * allowlist while not actually being the allowlisted tool. Exact equality closes that off —
 * nothing but the precise qualified name this template expects is ever treated as allowlisted.
 */
export function enforceReadOnly<T extends Record<string, Tool<any, any, any, any>>>(
  tools: T,
  allowedNames: readonly string[],
): T {
  const guarded = {} as T;

  for (const [key, tool] of Object.entries(tools)) {
    const action = classifyAction(key);
    const isAllowlisted = allowedNames.includes(key);

    const originalExecute = tool.execute?.bind(tool);

    (guarded as Record<string, Tool<any, any, any, any>>)[key] = Object.assign(
      Object.create(Object.getPrototypeOf(tool)),
      tool,
      {
        execute: async (inputData: unknown, context: unknown) => {
          const allowed = action === 'read' && isAllowlisted;
          logAttempt(key, action, allowed);

          if (!allowed) {
            throw new PolicyViolationError(key, action);
          }
          if (!originalExecute) {
            throw new Error(`Tool "${key}" has no execute function.`);
          }
          return originalExecute(inputData as never, context as never);
        },
      },
    );
  }

  return guarded;
}
