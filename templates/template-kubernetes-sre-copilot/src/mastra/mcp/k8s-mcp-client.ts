import { MCPClient } from '@mastra/mcp';

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
    kubernetes: process.env.KUBE_MCP_SERVER_URL
      ? {
          url: new URL(process.env.KUBE_MCP_SERVER_URL),
        }
      : {
          command: 'npx',
          args: [
            '-y',
            'kubernetes-mcp-server@latest',
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
 * See ../lib/policy.ts for where this list is actually enforced against live tool calls.
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
