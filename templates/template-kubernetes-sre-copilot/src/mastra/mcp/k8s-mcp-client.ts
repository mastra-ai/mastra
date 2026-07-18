import { MCPClient } from '@mastra/mcp';

/**
 * The key this template registers `kubernetes-mcp-server` under in `k8sMcpClient`'s `servers`
 * config below. `MCPClient.listTools()` namespaces every tool it returns as
 * `${SERVER_KEY}_${toolName}` — this constant is the single source of truth for that prefix, so
 * the server registration and the allowlist-matching logic in `unqualifyToolName` below can never
 * drift out of sync with each other.
 */
const SERVER_KEY = 'kubernetes';

/**
 * Connects to `kubernetes-mcp-server` (https://github.com/containers/kubernetes-mcp-server) —
 * an existing, audited Kubernetes MCP server. This template never talks to the Kubernetes API
 * directly and never wraps `kubectl` itself; every cluster read goes through this client.
 *
 * Two ways to point this at a cluster:
 *
 * 1. Default (stdio): launches `kubernetes-mcp-server` locally via `npx` with `--read-only`.
 *    The server resolves your kubeconfig the normal way (`KUBECONFIG` env, `--kubeconfig` flag,
 *    or in-cluster config). This is what `mastra dev` uses out of the box.
 * 2. Remote (HTTP/SSE): set `KUBE_MCP_SERVER_URL` to point at an already-running instance
 *    (e.g. one deployed via the project's Helm chart with `read_only = true` in its config).
 *    Use this in production so the read-only flag is enforced at the server's config file,
 *    not by whoever launches the client.
 *
 * `kubernetes-mcp-server` is a *pinned* dependency in package.json (exact version, no `^`/`~`
 * range), not fetched via `npx -y package@latest` — a bare `@latest` invocation re-resolves
 * against the npm registry on every `mastra dev` start with no integrity check, which is a real
 * supply-chain gap for a security-scoped tool like this one. Pinning it as a normal dependency
 * means `package-lock.json` captures its integrity hash the same way it does for every other
 * dependency here, and `npx kubernetes-mcp-server` below resolves to the locally installed
 * version in `node_modules/.bin` rather than reaching out to the registry at all. Bump the
 * version in package.json deliberately, not implicitly.
 *
 * Either way, read-only is enforced at the MCP server level, not by prompt instruction — the
 * `--read-only` flag (or `read_only = true` in the server's TOML config) makes every write tool
 * (`pods_delete`, `resources_delete`, `resources_create_or_update`, `resources_scale`,
 * `helm_install`, `pods_exec`, ...) reject at the server before it ever reaches the cluster.
 * `READ_ONLY_TOOL_NAMES` below is a second, defense-in-depth layer on the client side — see
 * `../lib/policy.ts` for how it's enforced.
 */
export const k8sMcpClient = new MCPClient({
  id: 'kubernetes-sre-copilot-mcp',
  servers: {
    [SERVER_KEY]: process.env.KUBE_MCP_SERVER_URL
      ? {
          url: new URL(process.env.KUBE_MCP_SERVER_URL),
        }
      : {
          command: 'npx',
          args: [
            'kubernetes-mcp-server',
            '--read-only',
            ...(process.env.KUBECONFIG ? ['--kubeconfig', process.env.KUBECONFIG] : []),
          ],
        },
  },
});

/**
 * Allowlist of `kubernetes-mcp-server` tools this template is allowed to use. All of them are
 * reads (list/get/log/stats) from the server's `core` and `config` toolsets — nothing here can
 * mutate cluster state. Kept explicit (rather than "everything the read-only server exposes")
 * so the allowlist stays correct even if a future server version adds a new tool under `core`.
 *
 * These are *unqualified* names (no server prefix) — see `unqualifyToolName` / `isReadOnlyToolName`
 * below for how they're matched against the qualified names `listTools()` actually returns, and
 * `../lib/policy.ts` for where the match result is enforced against live tool calls.
 */
export const READ_ONLY_TOOL_NAMES = [
  'pods_list',
  'pods_list_in_namespace',
  'pods_get',
  'pods_log',
  'pods_top',
  'events_list',
  'namespaces_list',
  'resources_get',
  'resources_list',
  'nodes_top',
  'nodes_stats_summary',
  'nodes_log',
  'configuration_view',
  'configuration_contexts_list',
] as const;

/**
 * Strips the exact `${SERVER_KEY}_` prefix `MCPClient.listTools()` adds to every tool name.
 * Returns the input unchanged if the prefix isn't present (defensive only — every tool from this
 * client should have it, since exactly one server is registered above).
 *
 * SECURITY: this must stay an exact prefix-strip-then-equality check, never a substring or
 * `endsWith` match. `"kubernetes_malicious_pods_list".endsWith("pods_list")` is true — a
 * suffix-based allowlist check would let a maliciously named tool impersonate `pods_list`. This
 * was flagged in review and is the fix: `unqualifyToolName` + exact `===`/`.includes()` only,
 * everywhere a tool name is checked against the allowlist (`./tools.ts`, `../lib/policy.ts`).
 */
export function unqualifyToolName(qualifiedName: string): string {
  const prefix = `${SERVER_KEY}_`;
  return qualifiedName.startsWith(prefix) ? qualifiedName.slice(prefix.length) : qualifiedName;
}

/**
 * True if a fully-qualified tool name (as returned by `MCPClient.listTools()`) unqualifies to one
 * of `READ_ONLY_TOOL_NAMES`. Used to build the allowlist in `../mcp/tools.ts` — every tool this
 * template ever calls is filtered through this check first.
 */
export function isReadOnlyToolName(qualifiedName: string): boolean {
  return (READ_ONLY_TOOL_NAMES as readonly string[]).includes(unqualifyToolName(qualifiedName));
}
