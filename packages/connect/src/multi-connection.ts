import type { ToolsInput } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { MCPClient } from '@mastra/mcp';
import { z } from 'zod';

import type { ConnectClientOptions, ProjectConnection, ResolvedClient } from './client.js';
import { platformMcpTransport } from './client.js';
import { MastraConnectError } from './errors.js';
import type { McpProviderRegistration, ProxyProviderRegistration } from './registry.js';
import { applyToolFilter } from './toolset.js';

/**
 * A resolved candidate connection for one provider, tagged with the display
 * name the agent will use in `connection_name`.
 */
export interface NamedConnection {
  /** Platform connection id. */
  id: string;
  /** Human-readable name the agent supplies as `connection_name`. Falls back to `id` when the platform has no accountLabel. */
  name: string;
  /** Raw accountLabel from the platform, if any (may be null/empty). */
  accountLabel?: string | null;
}

/**
 * Builds the ordered list of named connections for one provider. Called only
 * when the provider has 2+ active connections and no explicit pin resolves the
 * choice, so multi-connection wrapping is required.
 */
export function toNamedConnections(candidates: ProjectConnection[]): NamedConnection[] {
  const active = candidates.filter(candidate => candidate.status === 'active');
  const seenNames = new Map<string, number>();
  const named: NamedConnection[] = [];
  for (const connection of active) {
    const rawLabel = connection.accountLabel?.trim();
    const base = rawLabel && rawLabel.length > 0 ? rawLabel : connection.id;
    // Disambiguate duplicate labels by suffixing with the connection id so the
    // agent still has a unique handle. The list_connections tool returns the
    // suffixed names, so the agent can see the disambiguation.
    const prior = seenNames.get(base) ?? 0;
    seenNames.set(base, prior + 1);
    const name = prior === 0 ? base : `${base} (${connection.id})`;
    named.push({ id: connection.id, name, accountLabel: connection.accountLabel ?? null });
  }
  return named;
}

/**
 * Resolves a caller-supplied `connection_name` to a platform connection id.
 * Accepts either the display name or the raw connection id, so an agent that
 * received an ambiguous label still has a way to disambiguate. Throws a typed
 * error naming the valid names when the input matches nothing.
 */
export function resolveConnectionName(
  integrationId: string,
  connections: NamedConnection[],
  connectionName: string,
): string {
  const trimmed = connectionName.trim();
  if (!trimmed) {
    throw new MastraConnectError(
      'unknown_connection',
      `Missing connection_name for '${integrationId}'. Valid names: ${connections.map(c => c.name).join(', ')}.`,
    );
  }
  const byName = connections.find(candidate => candidate.name === trimmed);
  if (byName) return byName.id;
  const byId = connections.find(candidate => candidate.id === trimmed);
  if (byId) return byId.id;
  throw new MastraConnectError(
    'unknown_connection',
    `Unknown connection_name '${trimmed}' for '${integrationId}'. Valid names: ${connections.map(c => c.name).join(', ')}.`,
  );
}

const connectionNameField = z
  .string()
  .describe(
    'Which connection to use for this provider. Call the provider-specific list_connections tool first to discover the available names.',
  );

/**
 * Extends the underlying tool's zod input schema with `connection_name`. When
 * the underlying tool has no input schema, produces a schema whose only field
 * is `connection_name`. Rebuilds the tool with the same id/description/output
 * but a new execute that resolves the connection and delegates to the
 * per-connection inner tool.
 */
function wrapToolForConnection(input: {
  toolKey: string;
  integrationId: string;
  connections: NamedConnection[];
  innerToolsByConnectionId: Map<string, ToolsInput>;
}) {
  const { toolKey, integrationId, connections, innerToolsByConnectionId } = input;
  // Every inner toolset was built the same way, so the schema/description are
  // identical across connections; pull them from the first available one.
  let templateTool: unknown;
  for (const inner of innerToolsByConnectionId.values()) {
    if (inner[toolKey]) {
      templateTool = inner[toolKey];
      break;
    }
  }
  if (!templateTool) {
    throw new MastraConnectError('invalid_options', `Cannot wrap unknown tool '${toolKey}' for '${integrationId}'.`);
  }
  const template = templateTool as {
    id?: string;
    description?: string;
    inputSchema?: unknown;
    outputSchema?: unknown;
    requireApproval?: boolean;
    needsApprovalFn?: (input: unknown, ctx?: unknown) => boolean | Promise<boolean>;
  };

  const wrappedInputSchema = extendInputSchemaWithConnectionName(template.inputSchema);

  // Preserve the inner tool's approval contract. The MCP client attaches
  // `requireApproval` and (when the server-level policy is a function)
  // `needsApprovalFn` to every discovered tool; dropping them here would let
  // the agent invoke wrapped multi-connection tools without the user prompt
  // the single-connection path enforces.
  //
  // At least one inner connection carries the metadata; check them all in
  // case a caller-provided allow/disallow filter leaves an empty toolset on
  // some connections. `requireApproval: true` on ANY inner tool poisons the
  // wrapper (fail-closed): different connections should never disagree in
  // practice since they share the same server policy, but we take the
  // stricter answer if they do.
  let anyRequireApproval = false;
  const perConnectionNeedsApprovalFn = new Map<string, (input: unknown, ctx?: unknown) => boolean | Promise<boolean>>();
  for (const [connectionId, inner] of innerToolsByConnectionId) {
    const candidate = inner[toolKey] as
      | {
          requireApproval?: boolean;
          needsApprovalFn?: (input: unknown, ctx?: unknown) => boolean | Promise<boolean>;
        }
      | undefined;
    if (!candidate) continue;
    if (candidate.requireApproval) anyRequireApproval = true;
    if (typeof candidate.needsApprovalFn === 'function') {
      perConnectionNeedsApprovalFn.set(connectionId, candidate.needsApprovalFn);
    }
  }

  const stripConnectionName = (raw: Record<string, unknown>) => {
    const connectionName = typeof raw.connection_name === 'string' ? raw.connection_name : '';
    const { connection_name: _drop, ...rest } = raw;
    void _drop;
    return { connectionName, rest };
  };

  const wrapper = createTool({
    id: template.id ?? toolKey,
    description:
      template.description !== undefined
        ? `${template.description}\n\nThis provider has multiple connections; pass connection_name to pick one.`
        : `Requires connection_name; call ${integrationId}_list_connections to discover valid names.`,
    inputSchema: wrappedInputSchema as never,
    ...(template.outputSchema ? { outputSchema: template.outputSchema as never } : {}),
    // `requireApproval: true` triggers the agent's approval check; when a
    // `needsApprovalFn` is attached below the runtime consults that for the
    // per-call decision.
    ...(anyRequireApproval ? { requireApproval: true as const } : {}),
    execute: async (inputData, executeContext) => {
      const raw = (inputData ?? {}) as Record<string, unknown>;
      const { connectionName, rest } = stripConnectionName(raw);
      const connectionId = resolveConnectionName(integrationId, connections, connectionName);
      const inner = innerToolsByConnectionId.get(connectionId);
      const innerTool = inner?.[toolKey] as
        | { execute?: (input: unknown, context?: unknown) => Promise<unknown> }
        | undefined;
      if (!innerTool?.execute) {
        throw new MastraConnectError(
          'invalid_options',
          `Inner tool '${toolKey}' for '${integrationId}' has no execute (connection ${connectionId}).`,
        );
      }
      return (await innerTool.execute(rest, executeContext)) as never;
    },
  });

  // Attach `needsApprovalFn` after construction so the wrapper delegates the
  // per-call decision to the resolved inner connection. `createTool` does not
  // expose this as an option — MCPClient and the tool-builder both set it on
  // the instance directly, so we mirror that pattern here.
  if (perConnectionNeedsApprovalFn.size > 0) {
    (wrapper as { needsApprovalFn?: (input: unknown, ctx?: unknown) => boolean | Promise<boolean> }).needsApprovalFn =
      async (input: unknown, ctx?: unknown) => {
        const raw = (input ?? {}) as Record<string, unknown>;
        const { connectionName, rest } = stripConnectionName(raw);
        // Fail closed on resolution failure: an ambiguous or missing
        // connection_name should not skip approval.
        let connectionId: string;
        try {
          connectionId = resolveConnectionName(integrationId, connections, connectionName);
        } catch {
          return true;
        }
        const innerFn = perConnectionNeedsApprovalFn.get(connectionId);
        // If the resolved connection's inner tool has no per-call predicate,
        // fall back to the boolean requireApproval on that connection's
        // inner tool. `anyRequireApproval` gates whether we're here at all.
        if (!innerFn) {
          const innerTool = innerToolsByConnectionId.get(connectionId)?.[toolKey] as
            | { requireApproval?: boolean }
            | undefined;
          return !!innerTool?.requireApproval;
        }
        return await innerFn(rest, ctx);
      };
  }

  return wrapper;
}

/**
 * Rebuilds a zod object schema adding a `connection_name` string field. Uses
 * `.extend` when the source is a zod object; otherwise wraps with an
 * intersection so unknown Standard Schema shapes still validate.
 */
function extendInputSchemaWithConnectionName(source: unknown): unknown {
  const candidate = source as
    | { extend?: (shape: Record<string, unknown>) => unknown; _def?: { typeName?: string } }
    | undefined;
  if (!candidate) {
    return z.object({ connection_name: connectionNameField });
  }
  if (typeof candidate.extend === 'function') {
    return candidate.extend({ connection_name: connectionNameField });
  }
  // Fallback: intersect with an object containing connection_name. Not used
  // by the generated proxy providers today (all use z.object) but keeps MCP
  // and hand-authored tools working when their schema shape is unknown.
  // `z.intersection` accepts any zod schema instance; keep the cast targeted
  // to sidestep the peer-dep zod v3/v4 API drift.
  return z.intersection(z.object({ connection_name: connectionNameField }), source as never);
}

/**
 * Builds the `<provider>_list_connections` tool that reports the display names
 * of the active connections. Deterministic, no I/O — reads a captured snapshot.
 */
function buildListConnectionsTool(integrationId: string, connections: NamedConnection[]) {
  const listToolKey = `${integrationId}_list_connections`;
  return createTool({
    id: listToolKey,
    description: `List the available connections for the ${integrationId} provider. Use the returned 'name' values as connection_name on other ${integrationId} tools.`,
    inputSchema: z.object({}),
    outputSchema: z.object({
      connections: z.array(
        z.object({
          name: z.string().describe('Pass this value as connection_name on other tools.'),
          accountLabel: z.string().nullable().describe('Raw account label from the platform, may be null.'),
        }),
      ),
    }),
    execute: async () => ({
      connections: connections.map(candidate => ({
        name: candidate.name,
        accountLabel: candidate.accountLabel ?? null,
      })),
    }),
  });
}

/**
 * Composes a full multi-connection toolset for a proxy provider: one inner
 * toolset per connection, wrapped tools that dispatch by `connection_name`,
 * and the `<provider>_list_connections` tool. `allowTools` and `disallowTools`
 * are honored on the underlying tools (mutually exclusive; connect() validates
 * that up front). The list tool is always included.
 */
export function buildProxyMultiConnectionTools(input: {
  registration: ProxyProviderRegistration;
  connections: NamedConnection[];
  allowTools?: string[];
  disallowTools?: string[];
  client?: ConnectClientOptions;
}): ToolsInput {
  const { registration, connections, allowTools, disallowTools, client } = input;
  // The `<provider>_list_connections` key exists only on the wrapper, not on
  // the underlying provider toolset. Strip it before passing either filter to
  // the inner builder so referencing it never surfaces as an "unknown tool".
  const listToolKey = `${registration.integrationId}_list_connections`;
  const innerAllowTools = allowTools?.filter(name => name !== listToolKey);
  const innerDisallowTools = disallowTools?.filter(name => name !== listToolKey);
  const innerToolsByConnectionId = new Map<string, ToolsInput>();
  // Build one full inner toolset per connection and apply the filter to each.
  // Applied per-inner so unknown-name errors surface exactly once with the
  // same key set the user sees on the wrapped tools.
  const innerFilter =
    innerAllowTools !== undefined ? { allowTools: innerAllowTools } : { disallowTools: innerDisallowTools };
  for (const connection of connections) {
    const inner = registration.createTools({
      connectionId: connection.id,
      client,
      ...innerFilter,
    } as Parameters<typeof registration.createTools>[0]);
    innerToolsByConnectionId.set(connection.id, inner);
  }
  const [firstConnection] = connections;
  if (!firstConnection) return {};
  const firstInner = innerToolsByConnectionId.get(firstConnection.id)!;
  const publicToolKeys = Object.keys(firstInner);
  const wrapped: ToolsInput = {};
  for (const toolKey of publicToolKeys) {
    wrapped[toolKey] = wrapToolForConnection({
      toolKey,
      integrationId: registration.integrationId,
      connections,
      innerToolsByConnectionId,
    }) as never;
  }
  wrapped[`${registration.integrationId}_list_connections`] = buildListConnectionsTool(
    registration.integrationId,
    connections,
  ) as never;
  return wrapped;
}

/**
 * Composes a full multi-connection toolset for an MCP-backed provider: one
 * MCPClient per connection, wrapped tools that dispatch by `connection_name`,
 * and the `<provider>_list_connections` tool. The caller passes in the MCP
 * client cache so stale clients can be reaped elsewhere.
 */
export async function buildMcpMultiConnectionTools(input: {
  registration: McpProviderRegistration;
  connections: NamedConnection[];
  allowTools?: string[];
  disallowTools?: string[];
  autoApproveTools?: string[];
  client: ResolvedClient;
  mcpClients: Map<string, { integrationId: string; connectionId: string; client: MCPClient }>;
  resolverId: number;
}): Promise<ToolsInput> {
  const { registration, connections, allowTools, disallowTools, autoApproveTools, client, mcpClients, resolverId } =
    input;
  const autoApproved = new Set(autoApproveTools ?? []);
  // The `<provider>_list_connections` key exists only on the wrapper; strip
  // it from either filter that reaches MCP discovery so a caller that
  // references it never trips the unknown-tool guard.
  const listToolKey = `${registration.integrationId}_list_connections`;
  const innerAllowTools = allowTools?.filter(name => name !== listToolKey);
  const innerDisallowTools = disallowTools?.filter(name => name !== listToolKey);
  const innerToolsByConnectionId = new Map<string, ToolsInput>();
  for (const connection of connections) {
    const cacheKey = `${registration.integrationId}::${connection.id}`;
    let entry = mcpClients.get(cacheKey);
    if (!entry) {
      const transport = platformMcpTransport(client, connection.id);
      entry = {
        integrationId: registration.integrationId,
        connectionId: connection.id,
        client: new MCPClient({
          id: `mastra-connect-${resolverId}-${registration.integrationId}-${connection.id}`,
          servers: {
            [registration.integrationId]: {
              ...transport,
              requireToolApproval: ({ toolName }) =>
                !autoApproved.has(`${registration.integrationId}_${String(toolName)}`),
            },
          },
        }),
      };
      mcpClients.set(cacheKey, entry);
    }
    const discovery = await entry.client.listToolsWithErrors();
    const error = discovery.errors[registration.integrationId];
    if (error) {
      throw new Error(`MCP tool discovery failed for connection ${connection.id}: ${error}`);
    }
    const unknown = [...autoApproved].filter(name => !(name in discovery.tools));
    if (unknown.length > 0) {
      throw new MastraConnectError(
        'invalid_options',
        `Unknown tool name(s) in autoApproveTools for '${registration.integrationId}': ${unknown.join(
          ', ',
        )}. Known tools: ${Object.keys(discovery.tools).join(', ')}.`,
      );
    }
    const filtered = applyToolFilter(discovery.tools, {
      allowTools: innerAllowTools,
      disallowTools: innerDisallowTools,
    });
    innerToolsByConnectionId.set(connection.id, filtered);
  }
  const [firstConnection] = connections;
  if (!firstConnection) return {};
  const firstInner = innerToolsByConnectionId.get(firstConnection.id)!;
  const publicToolKeys = Object.keys(firstInner);
  const wrapped: ToolsInput = {};
  for (const toolKey of publicToolKeys) {
    wrapped[toolKey] = wrapToolForConnection({
      toolKey,
      integrationId: registration.integrationId,
      connections,
      innerToolsByConnectionId,
    }) as never;
  }
  wrapped[`${registration.integrationId}_list_connections`] = buildListConnectionsTool(
    registration.integrationId,
    connections,
  ) as never;
  return wrapped;
}
