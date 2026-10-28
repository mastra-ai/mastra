import type { Mastra } from '@mastra/core/mastra';
import type { MastraMCPToolset, ServerMCPConfig, ServerMCPPrimitiveFilter } from '@mastra/core/server';

/** Logical id of the built-in MCP server. */
export const BUILTIN_MCP_SERVER_ID = 'mastra';
export const DEFAULT_BUILTIN_MCP_PATH = '/mcp';

const ALL_TOOLSETS: readonly MastraMCPToolset[] = ['agents', 'workflows', 'tools'];
const DEFAULT_ENUM_LIMIT = 25;

export type MCPPrimitiveKind = keyof ServerMCPPrimitiveFilter;

/** The built-in MCP config after defaults and per-request narrowing. */
export interface ResolvedBuiltinMCPConfig {
  toolsets: ReadonlySet<MastraMCPToolset>;
  readOnly: boolean;
  enumLimit: number;
  featured: { agents: string[]; workflows: string[] };
  /** Selection filter from `include` / `exclude`. `exclude` wins. */
  isSelected(kind: MCPPrimitiveKind, id: string): boolean;
  serverInfo: NonNullable<ServerMCPConfig['serverInfo']>;
}

const warnedOpen = new WeakSet<Mastra>();
const warnedReservedId = new WeakSet<Mastra>();
const warnedPath = new WeakSet<Mastra>();

function isDev(): boolean {
  return process.env.MASTRA_DEV === 'true';
}

function getMCPConfig(mastra: Mastra): ServerMCPConfig {
  return mastra.getServer()?.mcp ?? {};
}

/**
 * Whether the built-in MCP endpoint is served.
 *
 * `enabled: 'dev'` (the default) serves it under `mastra dev`, and otherwise only when `server.auth`
 * is configured, so a production build without auth never exposes it.
 */
export function isBuiltinMCPEnabled(mastra: Mastra): boolean {
  const { enabled = 'dev' } = getMCPConfig(mastra);
  if (enabled === false) return false;
  const hasAuth = Boolean(mastra.getServer()?.auth);
  if (enabled === true) {
    if (!hasAuth && !warnedOpen.has(mastra)) {
      warnedOpen.add(mastra);
      mastra
        .getLogger()
        ?.warn(
          'server.mcp.enabled is true but server.auth is not configured: the MCP endpoint lets anyone who can reach this server call your agents, workflows, and tools.',
        );
    }
    return true;
  }
  return isDev() || hasAuth;
}

/** Warns once when a user-registered MCP server uses the id reserved for the built-in one. */
export function warnOnReservedMCPServerId(mastra: Mastra): void {
  if (warnedReservedId.has(mastra)) return;
  warnedReservedId.add(mastra);
  if (mastra.getMCPServerById?.(BUILTIN_MCP_SERVER_ID)) {
    mastra
      .getLogger()
      ?.warn(
        `An MCP server is registered with the id "${BUILTIN_MCP_SERVER_ID}", which is reserved for the built-in Mastra MCP server. Give it another id.`,
      );
  }
}

/**
 * Path of the built-in MCP route (without the API prefix). Paths that could shadow the
 * `/mcp/v0/servers` registry or `/mcp/:serverId/*` routes fall back to `/mcp`.
 */
export function resolveBuiltinMCPPath(mastra: Mastra): string {
  const { path } = getMCPConfig(mastra);
  if (path === undefined) return DEFAULT_BUILTIN_MCP_PATH;
  const segments = path.split('/').filter(Boolean);
  const valid =
    path.startsWith('/') &&
    segments.length > 0 &&
    !/[:*?]/.test(path) &&
    !(segments[0] === 'mcp' && segments.length > 2);
  if (valid) return `/${segments.join('/')}`;
  if (!warnedPath.has(mastra)) {
    warnedPath.add(mastra);
    mastra
      .getLogger()
      ?.error(
        `server.mcp.path "${path}" is invalid or collides with the MCP server registry routes; using "${DEFAULT_BUILTIN_MCP_PATH}".`,
      );
  }
  return DEFAULT_BUILTIN_MCP_PATH;
}

function parseList(value: string | null | undefined): string[] | undefined {
  if (value == null) return undefined;
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function parseFlag(value: string | null | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true';
}

/**
 * Resolves the config for one request. Clients may narrow toolsets with `?toolsets=` / `X-MCP-Toolsets`
 * and request read-only with `?readonly=1` / `X-MCP-Readonly`; neither can widen the configured set.
 */
export function resolveBuiltinMCPConfig(mastra: Mastra, request?: Request): ResolvedBuiltinMCPConfig {
  const config = getMCPConfig(mastra);
  let toolsets = new Set<MastraMCPToolset>((config.toolsets ?? ALL_TOOLSETS).filter(t => ALL_TOOLSETS.includes(t)));
  let readOnly = config.readOnly ?? false;

  if (request) {
    const url = new URL(request.url);
    for (const requested of [
      parseList(url.searchParams.get('toolsets')),
      parseList(request.headers.get('x-mcp-toolsets')),
    ]) {
      if (requested) toolsets = new Set([...toolsets].filter(t => requested.includes(t)));
    }
    readOnly ||= parseFlag(url.searchParams.get('readonly')) || parseFlag(request.headers.get('x-mcp-readonly'));
  }

  const { include, exclude } = config;
  return {
    toolsets,
    readOnly,
    enumLimit: config.enumLimit ?? DEFAULT_ENUM_LIMIT,
    featured: { agents: config.featured?.agents ?? [], workflows: config.featured?.workflows ?? [] },
    isSelected: (kind, id) => !exclude?.[kind]?.includes(id) && (include?.[kind]?.includes(id) ?? true),
    serverInfo: config.serverInfo ?? {},
  };
}

/** DNS-rebinding protection for `mastra dev` only; production hosts sit behind proxies and custom domains. */
export function getBuiltinMCPTransportOptions(mastra: Mastra) {
  if (!isDev()) return undefined;
  const hosts = ['localhost', '127.0.0.1', '[::1]'];
  const configuredHost = mastra.getServer()?.host;
  if (configuredHost && configuredHost !== '0.0.0.0' && configuredHost !== '::') hosts.push(configuredHost);
  return {
    enableDnsRebindingProtection: true,
    allowedHosts: hosts,
    allowedOrigins: hosts.flatMap(host => [`http://${host}`, `https://${host}`]),
  };
}
