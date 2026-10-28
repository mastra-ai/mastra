import type { Mastra } from '@mastra/core/mastra';
import type { IMastraAuthProvider } from '@mastra/core/server';
import type { ServerRoute } from '../server-adapter/routes';
import { createRoute } from '../server-adapter/routes/route-builder';
import { isBuiltinMCPEnabled, resolveBuiltinMCPPath } from './config';

/** RFC 9728 well-known path for OAuth protected-resource metadata. */
export const OAUTH_PROTECTED_RESOURCE_PATH = '/.well-known/oauth-protected-resource';

const warnedAudience = new WeakSet<Mastra>();

/** `server.auth` when it is a provider instance (only providers carry the OAuth hooks). */
function getAuthProvider(mastra: Mastra): IMastraAuthProvider | undefined {
  const auth = mastra.getServer()?.auth;
  return auth && typeof (auth as IMastraAuthProvider).authenticateToken === 'function'
    ? (auth as IMastraAuthProvider)
    : undefined;
}

function getOAuthConfig(mastra: Mastra) {
  return mastra.getServer()?.mcp?.oauth ?? {};
}

/**
 * Whether the OAuth discovery routes are served: the built-in MCP endpoint is on and requires auth.
 */
export function isMCPOAuthDiscoveryEnabled(mastra: Mastra): boolean {
  return Boolean(mastra.getServer()?.auth) && isBuiltinMCPEnabled(mastra);
}

/** Canonical URL of the MCP endpoint: `server.mcp.oauth.resource`, else derived from the request. */
export function resolveMCPResource(mastra: Mastra, prefix: string, requestUrl: string): string {
  return getOAuthConfig(mastra).resource ?? `${new URL(requestUrl).origin}${prefix}${resolveBuiltinMCPPath(mastra)}`;
}

/** Absolute URL of the path-suffixed metadata document advertised in `WWW-Authenticate`. */
export function mcpResourceMetadataUrl(mastra: Mastra, prefix: string, requestUrl: string): string {
  const origin = new URL(getOAuthConfig(mastra).resource ?? requestUrl).origin;
  return `${origin}${OAUTH_PROTECTED_RESOURCE_PATH}${prefix}${resolveBuiltinMCPPath(mastra)}`;
}

/** RFC 9728 metadata for the built-in MCP endpoint. Unset optional fields are omitted. */
export async function resolveMCPResourceMetadata(mastra: Mastra, prefix: string, requestUrl: string) {
  const { generateProtectedResourceMetadata } = await import('@mastra/mcp');
  const config = getOAuthConfig(mastra);
  const hints = getAuthProvider(mastra)?.getOAuthMetadata?.();
  const authorizationServers = config.authorizationServers ?? hints?.authorizationServers;
  const scopesSupported = config.scopesSupported ?? hints?.scopesSupported;

  const metadata: Record<string, unknown> = generateProtectedResourceMetadata({
    resource: resolveMCPResource(mastra, prefix, requestUrl),
    authorizationServers: authorizationServers ?? [],
    scopesSupported,
  });
  // The helper defaults scopes to MCP-SDK placeholders; only advertise what the app configured.
  if (!authorizationServers?.length) delete metadata.authorization_servers;
  if (!scopesSupported?.length) delete metadata.scopes_supported;
  return metadata;
}

/** `WWW-Authenticate` value for a 401 from the built-in MCP endpoint. */
export async function mcpWWWAuthenticate(
  mastra: Mastra,
  prefix: string,
  requestUrl: string,
  error?: { error: string; error_description?: string },
): Promise<string> {
  const { generateWWWAuthenticateHeader } = await import('@mastra/mcp');
  return generateWWWAuthenticateHeader({
    resourceMetadataUrl: mcpResourceMetadataUrl(mastra, prefix, requestUrl),
    additionalParams: error,
  });
}

/**
 * D5: when `server.mcp.oauth.resource` is set, the token's audience must include it.
 * Returns false only when the provider can check the audience and it does not match.
 */
export async function checkMCPAudience(mastra: Mastra, user: unknown): Promise<boolean> {
  const { resource } = getOAuthConfig(mastra);
  const provider = getAuthProvider(mastra);
  if (!resource || typeof provider?.verifyAudience !== 'function') return true;
  return provider.verifyAudience(user, resource);
}

function leafProviders(provider: IMastraAuthProvider): IMastraAuthProvider[] {
  const inner = (provider as { getProviders?: () => readonly IMastraAuthProvider[] }).getProviders?.();
  return inner ? inner.flatMap(leafProviders) : [provider];
}

/** Warns once when `server.mcp.oauth.resource` is set but some provider cannot check token audience. */
export function warnOnUnenforcedMCPAudience(mastra: Mastra): void {
  if (warnedAudience.has(mastra) || !getOAuthConfig(mastra).resource) return;
  warnedAudience.add(mastra);
  const auth = mastra.getServer()?.auth;
  if (!auth) return;
  const provider = getAuthProvider(mastra);
  const unenforced = provider
    ? leafProviders(provider)
        .filter(p => typeof p.verifyAudience !== 'function')
        .map(p => p.name || 'server.auth')
    : ['server.auth'];
  if (!unenforced.length) return;
  mastra
    .getLogger()
    ?.warn(
      `server.mcp.oauth.resource is set, but token audience is NOT enforced for ${unenforced.join(', ')}: ` +
        'these auth providers cannot check the token audience, so MCP requests authenticated by them are accepted for any audience.',
    );
}

/**
 * Public routes serving the metadata at `/.well-known/oauth-protected-resource` and its path-suffixed
 * form for the MCP endpoint. Mounted at the server root (outside the API prefix), not in SERVER_ROUTES.
 */
export function createMCPOAuthMetadataRoutes(mastra: Mastra, prefix: string): ServerRoute[] {
  const paths = [
    OAUTH_PROTECTED_RESOURCE_PATH,
    `${OAUTH_PROTECTED_RESOURCE_PATH}${prefix}${resolveBuiltinMCPPath(mastra)}`,
  ];
  return paths.map(path =>
    createRoute({
      method: 'GET',
      path,
      responseType: 'json',
      summary: 'OAuth protected-resource metadata',
      description: 'RFC 9728 metadata for the built-in MCP endpoint',
      tags: ['MCP'],
      requiresAuth: false,
      handler: async ({ mastra, request }) =>
        resolveMCPResourceMetadata(mastra, prefix, request?.url ?? `http://localhost${path}`),
    }),
  );
}
