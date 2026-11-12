import type { Mastra } from '@mastra/core/mastra';
import type { MastraMCPToolset } from '@mastra/core/server';
import { z } from 'zod/v4';
import type { ServerRoute } from '../server-adapter/routes';
import { createRoute } from '../server-adapter/routes/route-builder';
import { getBuiltinMCPCapabilities } from './capabilities';
import { isBuiltinMCPEnabled, resolveBuiltinMCPConfig } from './config';
import { getBuiltinMCPMountedPath, isMissingMCPPackage } from './route';

const toolsetSchema = z.enum([
  'agents',
  'workflows',
  'tools',
  'memory',
  'observability',
  'observability_analytics',
  'stored_agents',
]);

export const builtinMcpDescriptorResponseSchema = z.discriminatedUnion('enabled', [
  z.object({
    enabled: z.literal(false),
    disabledReason: z
      .enum(['config', 'production-without-auth'])
      .describe(
        "'config': server.mcp.enabled is false. 'production-without-auth': not under mastra dev and no server.auth",
      ),
  }),
  z.object({
    enabled: z.literal(true),
    path: z.string().describe('Endpoint path including the API prefix, e.g. /api/mcp'),
    mcpPackageInstalled: z.boolean().describe('Whether @mastra/mcp is installed; the endpoint answers 501 without it'),
    toolsets: z.array(toolsetSchema).describe('Configured toolsets this server can serve'),
    readOnly: z.boolean(),
    auth: z.discriminatedUnion('type', [
      z.object({
        type: z.literal('open'),
        devOnly: z.boolean().describe('Open because of the mastra dev default, not server.mcp.enabled: true'),
      }),
      z.object({ type: z.literal('protected'), provider: z.string().nullable() }),
    ]),
  }),
]);

type BuiltinMcpDescriptor = z.infer<typeof builtinMcpDescriptorResponseSchema>;

/** Toolsets served by agents/workflows/tools code paths rather than only `mcp`-tagged routes. */
const PRIMITIVE_TOOLSETS: ReadonlySet<MastraMCPToolset> = new Set(['agents', 'workflows', 'tools']);

let mcpPackageInstalled: Promise<boolean> | undefined;

function isMCPPackageInstalled(): Promise<boolean> {
  mcpPackageInstalled ??= (async () => {
    try {
      // Kept directly inside `try` for bundlers, like `loadBuiltinMCP` in ./route.
      await import('@mastra/mcp');
      return true;
    } catch (error) {
      if (isMissingMCPPackage(error)) return false;
      // Don't cache other failures, so the route recovers once the package loads.
      mcpPackageInstalled = undefined;
      throw error;
    }
  })();
  return mcpPackageInstalled;
}

/**
 * Configured toolsets with at least one tool this server can serve (same capability checks as the catalogue).
 * Doesn't reflect `include`/`exclude`, which narrow tools within a toolset.
 */
async function getServedToolsets(mastra: Mastra, configured: ReadonlySet<MastraMCPToolset>) {
  const [{ SERVER_ROUTES }, capabilities] = await Promise.all([
    import('../server-adapter/routes'),
    getBuiltinMCPCapabilities(mastra),
  ]);
  return [...configured].filter(
    toolset =>
      PRIMITIVE_TOOLSETS.has(toolset) ||
      SERVER_ROUTES.some(route => route.mcp?.toolset === toolset && (route.mcp.requires?.(capabilities) ?? true)),
  );
}

export async function describeBuiltinMCP(mastra: Mastra, routePrefix = ''): Promise<BuiltinMcpDescriptor> {
  const server = mastra.getServer();
  if (!isBuiltinMCPEnabled(mastra)) {
    return { enabled: false, disabledReason: server?.mcp?.enabled === false ? 'config' : 'production-without-auth' };
  }
  const config = resolveBuiltinMCPConfig(mastra);
  const auth = server?.auth;
  return {
    enabled: true,
    path: `${routePrefix}${getBuiltinMCPMountedPath(mastra)}`,
    mcpPackageInstalled: await isMCPPackageInstalled(),
    toolsets: await getServedToolsets(mastra, config.toolsets),
    readOnly: config.readOnly,
    // Only the provider's name; never its config (issuer, keys, client ids).
    auth: auth
      ? { type: 'protected', provider: ('name' in auth && typeof auth.name === 'string' && auth.name) || null }
      : { type: 'open', devOnly: server?.mcp?.enabled !== true },
  };
}

/**
 * Describes the built-in MCP server for Studio. Studio can't use `/api/mcp` itself (bearer-only, per-caller
 * catalogue), so this returns only server-level facts any `mcp:read` caller could learn by connecting.
 */
export const BUILTIN_MCP_DESCRIPTOR_ROUTE: ServerRoute = createRoute({
  method: 'GET',
  path: '/mcp/builtin',
  responseType: 'json',
  responseSchema: builtinMcpDescriptorResponseSchema,
  summary: 'Describe the built-in MCP server',
  description: 'Returns whether the built-in Mastra MCP server is served, its endpoint path, toolsets, and auth mode',
  tags: ['MCP'],
  requiresAuth: true,
  requiresPermission: 'mcp:read',
  handler: async ({ mastra, routePrefix }) => describeBuiltinMCP(mastra, routePrefix),
});
