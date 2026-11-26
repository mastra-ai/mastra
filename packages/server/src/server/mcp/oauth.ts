import type { Mastra } from '@mastra/core/mastra';
import type { IMastraAuthProvider } from '@mastra/core/server';
import type { ServerRoute } from '../server-adapter/routes';
import { createRoute } from '../server-adapter/routes/route-builder';
import { isBuiltinMCPEnabled, resolveBuiltinMCPPath } from './config';

/** RFC 9728 well-known path for OAuth protected-resource metadata. */
export const OAUTH_PROTECTED_RESOURCE_PATH = '/.well-known/oauth-protected-resource';

const warnedAudience = new WeakSet<Mastra>();
const resourceValidity = new WeakMap<Mastra, boolean>();
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

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

/** RFC 9728 resource identifier: absolute https URL (http only for loopback hosts) without a fragment. */
function isValidResourceUrl(resource: string): boolean {
  let url: URL;
  try {
    url = new URL(resource);
  } catch {
    return false;
  }
  if (resource.includes('#')) return false;
  return url.protocol === 'https:' || (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname));
}

/** Whether `server.mcp.oauth.resource` is unset or valid. Logs one error per instance when it isn't. */
function hasValidResource(mastra: Mastra): boolean {
  const { resource } = getOAuthConfig(mastra);
  if (resource === undefined) return true;
  let valid = resourceValidity.get(mastra);
  if (valid === undefined) {
    valid = isValidResourceUrl(resource);
    resourceValidity.set(mastra, valid);
    if (!valid) {
      mastra
        .getLogger()
        ?.error(
          `server.mcp.oauth.resource "${resource}" is not an absolute https URL without a fragment ` +
            '(http is only allowed for localhost). OAuth discovery for the built-in MCP server is disabled. ' +
            'Token audience checks still use this value, so MCP requests are rejected unless the token audience matches it exactly.',
        );
    }
  }
  return valid;
}

function isBuiltinMCPAuthenticated(mastra: Mastra): boolean {
  return Boolean(mastra.getServer()?.auth) && isBuiltinMCPEnabled(mastra);
}

/**
 * Whether OAuth discovery applies: the built-in MCP endpoint is on, requires auth, and any configured
 * `server.mcp.oauth.resource` is valid. Gates the well-known routes and the `resource_metadata` challenge.
 */
export function isMCPOAuthDiscoveryEnabled(mastra: Mastra): boolean {
  return isBuiltinMCPAuthenticated(mastra) && hasValidResource(mastra);
}

/**
 * Whether the built-in MCP endpoint checks token audience: `server.mcp.oauth.resource` is set. An invalid value
 * only turns discovery off; the audience is still checked against it, so a config typo fails closed.
 */
export function isMCPAudienceEnforced(mastra: Mastra): boolean {
  return isBuiltinMCPAuthenticated(mastra) && getOAuthConfig(mastra).resource !== undefined;
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
export function resolveMCPResourceMetadata(mastra: Mastra, prefix: string, requestUrl: string) {
  const config = getOAuthConfig(mastra);
  const hints = getAuthProvider(mastra)?.getOAuthMetadata?.();
  const authorizationServers = config.authorizationServers ?? hints?.authorizationServers;
  const scopesSupported = config.scopesSupported ?? hints?.scopesSupported;
  // Built here rather than with @mastra/mcp's helpers: @mastra/mcp is an optional peer, and discovery must work
  // (and 401s must not fail) without it.
  return {
    resource: resolveMCPResource(mastra, prefix, requestUrl),
    ...(authorizationServers?.length ? { authorization_servers: authorizationServers } : {}),
    ...(scopesSupported?.length ? { scopes_supported: scopesSupported } : {}),
    bearer_methods_supported: ['header'],
  };
}

/**
 * `WWW-Authenticate` value for a 401 from the built-in MCP endpoint (RFC 6750 §3 auth-params, quoted and escaped).
 * `resource_metadata` is only included while discovery is enabled.
 */
export function mcpWWWAuthenticate(
  mastra: Mastra,
  prefix: string,
  requestUrl: string,
  error?: { error: string; error_description?: string },
): string {
  const params = {
    ...(isMCPOAuthDiscoveryEnabled(mastra)
      ? { resource_metadata: mcpResourceMetadataUrl(mastra, prefix, requestUrl) }
      : {}),
    ...error,
  };
  const quoted = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}="${value!.replace(/[\\"]/g, '\\$&')}"`);
  return `Bearer ${quoted.join(', ')}`;
}

type CompositeProvider = IMastraAuthProvider & {
  getProviders?: () => readonly IMastraAuthProvider[];
  getAuthenticatedProvider?: (user: unknown) => IMastraAuthProvider | undefined;
};

/** The innermost provider that authenticated `user`, looking through `CompositeAuth`. Undefined when unknown. */
function authenticatingLeaf(provider: IMastraAuthProvider, user: unknown): IMastraAuthProvider | undefined {
  const composite = provider as CompositeProvider;
  if (typeof composite.getAuthenticatedProvider !== 'function') return provider;
  const inner = composite.getAuthenticatedProvider(user);
  return inner && authenticatingLeaf(inner, user);
}

/**
 * When `server.mcp.oauth.resource` is set, the token's audience must include it. A provider that can't check the
 * audience is accepted, unless `requireAudience` is on: then the request is rejected.
 */
export async function checkMCPAudience(mastra: Mastra, user: unknown): Promise<boolean> {
  const { resource, requireAudience } = getOAuthConfig(mastra);
  if (resource === undefined) return true;
  const provider = getAuthProvider(mastra);
  if (requireAudience) {
    const leaf = provider && authenticatingLeaf(provider, user);
    if (typeof leaf?.verifyAudience !== 'function') return false;
  }
  if (typeof provider?.verifyAudience !== 'function') return true;
  return provider.verifyAudience(user, resource);
}

function leafProviders(provider: IMastraAuthProvider): IMastraAuthProvider[] {
  const inner = (provider as CompositeProvider).getProviders?.();
  return inner ? inner.flatMap(leafProviders) : [provider];
}

/** Warns once when `server.mcp.oauth.resource` is set but some provider cannot check token audience. */
export function warnOnUnenforcedMCPAudience(mastra: Mastra): void {
  if (warnedAudience.has(mastra) || getOAuthConfig(mastra).resource === undefined) return;
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
  const consequence = getOAuthConfig(mastra).requireAudience
    ? 'requireAudience is on, so MCP requests authenticated by them are rejected.'
    : 'MCP requests authenticated by them are accepted for any audience. Set server.mcp.oauth.requireAudience to reject them.';
  mastra
    .getLogger()
    ?.warn(
      `server.mcp.oauth.resource is set, but ${unenforced.join(', ')} cannot check the token audience: ${consequence}`,
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
      // A Response so the metadata can carry `Cache-Control: no-store` (its `resource` may echo the Host header).
      responseType: 'datastream-response',
      summary: 'OAuth protected-resource metadata',
      description: 'RFC 9728 metadata for the built-in MCP endpoint',
      tags: ['MCP'],
      requiresAuth: false,
      handler: async ({ mastra, request }) =>
        Response.json(resolveMCPResourceMetadata(mastra, prefix, request?.url ?? `http://localhost${path}`), {
          headers: { 'Cache-Control': 'no-store' },
        }),
    }),
  );
}
