import { auth, MCPOAuthClientProvider } from '@mastra/mcp';
import type { OAuthClientInformation, OAuthDiscoveryState, OAuthStorage } from '@mastra/mcp';

import type { McpServerOAuthStorage, McpServerRecord, McpServersStorage } from '../storage/domains/mcp-servers/base.js';
import { findOAuthFailure, safeErrorText } from './errors.js';
import { McpServerNetworkPolicyError } from './url-policy.js';
import type { GuardedFetch } from './url-policy.js';

/**
 * OAuth sign-in for organization MCP servers, driven directly through the MCP
 * SDK's `auth()` with every value (PKCE verifier, discovery state, tokens) in
 * the database. Unlike `MCPClient.authenticate()`/`finishAuth()`, which must
 * finish on the in-memory transport that started the flow, this lets the
 * callback land on any replica.
 *
 * The Factory identifies itself with a pre-registered client ID when the
 * admin saved one, otherwise with its Client ID Metadata Document (served at
 * {@link MCP_OAUTH_CLIENT_METADATA_PATH}, https deployments only). Dynamic
 * client registration is never used.
 */

export const MCP_OAUTH_CALLBACK_PATH = '/auth/mcp-servers/callback';
export const MCP_OAUTH_CLIENT_METADATA_PATH = '/.well-known/oauth-client/mastra-factory.json';
/** A sign-in must finish within the signed `state`'s lifetime. */
export const MCP_OAUTH_FLOW_TTL_MS = 10 * 60 * 1000;

const CLIENT_NAME = 'Mastra Factory';
const GRANT_TYPES = ['authorization_code', 'refresh_token'];
const RESPONSE_TYPES = ['code'];

export interface McpOAuthEndpoints {
  /** Where authorization servers send the browser back. */
  redirectUrl: string;
  /** The Client ID Metadata Document URL; only when the Factory is served over https. */
  clientMetadataUrl?: string;
}

export function mcpOAuthEndpoints(publicOrigin: string): McpOAuthEndpoints {
  const origin = publicOrigin.replace(/\/+$/, '');
  return {
    redirectUrl: `${origin}${MCP_OAUTH_CALLBACK_PATH}`,
    ...(new URL(origin).protocol === 'https:'
      ? { clientMetadataUrl: `${origin}${MCP_OAUTH_CLIENT_METADATA_PATH}` }
      : {}),
  };
}

/** The Client ID Metadata Document authorization servers fetch to learn who the Factory is. */
export function mcpOAuthClientMetadataDocument(endpoints: McpOAuthEndpoints) {
  if (!endpoints.clientMetadataUrl) return undefined;
  return {
    client_id: endpoints.clientMetadataUrl,
    client_name: CLIENT_NAME,
    redirect_uris: [endpoints.redirectUrl],
    grant_types: GRANT_TYPES,
    response_types: RESPONSE_TYPES,
    token_endpoint_auth_method: 'none',
  };
}

/** Whether the server can sign in at all: it needs a saved client ID or the Factory's metadata document. */
export function canSignIn(record: McpServerRecord, endpoints: McpOAuthEndpoints): boolean {
  return record.authType === 'oauth' && Boolean(record.oauthClientId || endpoints.clientMetadataUrl);
}

/**
 * The OAuth client provider for an `oauth` server, reading and writing its
 * state in the database. `undefined` when the server cannot sign in.
 */
export function createMcpOAuthProvider(
  record: McpServerRecord,
  {
    storage,
    endpoints,
    stateGenerator,
    onRedirectToAuthorization,
    forSessions = false,
  }: {
    storage: McpServersStorage;
    endpoints: McpOAuthEndpoints;
    stateGenerator?: () => string;
    onRedirectToAuthorization?: (url: URL) => void;
    /**
     * Sessions and discovery only use and refresh tokens. When a refresh fails
     * the SDK starts an authorization nobody will finish; its PKCE verifier and
     * discovery state must not replace those of an admin's sign-in in progress.
     */
    forSessions?: boolean;
  },
): MCPOAuthClientProvider | undefined {
  if (!canSignIn(record, endpoints)) return undefined;
  const clientInformation: OAuthClientInformation | undefined = record.oauthClientId
    ? {
        client_id: record.oauthClientId,
        ...(record.oauthClientSecret ? { client_secret: record.oauthClientSecret } : {}),
      }
    : undefined;
  return new MCPOAuthClientProvider({
    redirectUrl: endpoints.redirectUrl,
    clientMetadata: {
      ...(clientInformation ? {} : { client_id: endpoints.clientMetadataUrl }),
      client_name: CLIENT_NAME,
      redirect_uris: [endpoints.redirectUrl],
      grant_types: GRANT_TYPES,
      response_types: RESPONSE_TYPES,
      ...(record.oauthScopes.length > 0 ? { scope: record.oauthScopes.join(' ') } : {}),
    },
    ...(clientInformation ? { clientInformation } : { clientMetadataUrl: endpoints.clientMetadataUrl }),
    storage: forSessions ? sessionOAuthStorage(storage.oauthStorage(record)) : storage.oauthStorage(record),
    // Sessions never send anyone to sign in; a refused token surfaces as `needs_auth`.
    onRedirectToAuthorization: onRedirectToAuthorization ?? (() => undefined),
    ...(stateGenerator ? { stateGenerator } : {}),
  });
}

const SIGN_IN_KEYS = new Set(['code_verifier', 'discovery_state']);
const isTokensKey = (key: string) => key === 'tokens' || key.startsWith('tokens:');

/**
 * Sessions leave an admin's in-progress sign-in alone, and only discard the
 * tokens they used: when replicas race to refresh a rotating refresh token,
 * the loser's `invalid_grant` must not erase the tokens the winner just saved.
 */
function sessionOAuthStorage(storage: McpServerOAuthStorage): OAuthStorage {
  const seen = new Map<string, string | undefined>();
  return {
    get: async key => {
      const value = await storage.get(key);
      seen.set(key, value);
      return value;
    },
    set: async (key, value) => {
      if (SIGN_IN_KEYS.has(key)) return;
      await storage.set(key, value);
      seen.set(key, value);
    },
    delete: async key => {
      if (SIGN_IN_KEYS.has(key)) return;
      if (!isTokensKey(key)) return storage.delete(key);
      // Tokens this session never read aren't its to discard.
      const expected = seen.get(key);
      if (expected !== undefined) await storage.deleteIf(key, expected);
    },
  };
}

export type McpOAuthStartResult =
  | { status: 'redirect'; authorizationUrl: string }
  /** Stored tokens were refreshed; no sign-in is needed. */
  | { status: 'authorized' }
  | { status: 'error'; error: string };

/**
 * Discover the server's authorization server and build the URL the admin's
 * browser goes to. `state` is carried through the authorization server back
 * to the callback.
 */
export async function startMcpOAuth({
  record,
  storage,
  endpoints,
  state,
  fetch,
  allowPrivateNetwork,
}: {
  record: McpServerRecord;
  storage: McpServersStorage;
  endpoints: McpOAuthEndpoints;
  state: string;
  fetch: GuardedFetch;
  allowPrivateNetwork: boolean;
}): Promise<McpOAuthStartResult> {
  let authorizationUrl: URL | undefined;
  const provider = createMcpOAuthProvider(record, {
    storage,
    endpoints,
    stateGenerator: () => state,
    onRedirectToAuthorization: url => {
      authorizationUrl = url;
    },
  });
  if (!provider) return { status: 'error', error: 'This server cannot sign in without a client ID.' };
  try {
    const result = await auth(provider, { serverUrl: record.url, fetchFn: fetch, ...scopeOption(record) });
    if (result === 'AUTHORIZED') return { status: 'authorized' };
    if (!authorizationUrl)
      return { status: 'error', error: 'The authorization server did not return a sign-in address.' };
    // The browser goes there next: never a javascript:, data:, or (outside local development) plain-http URL.
    if (authorizationUrl.protocol !== 'https:' && !(allowPrivateNetwork && authorizationUrl.protocol === 'http:')) {
      return { status: 'error', error: 'The authorization server returned a sign-in address that does not use https.' };
    }
    return { status: 'redirect', authorizationUrl: authorizationUrl.toString() };
  } catch (error) {
    return { status: 'error', error: describeFailure(record, error) };
  }
}

/**
 * Exchange the authorization code from the callback for tokens, validating the
 * authorization server's `iss` (RFC 9207) and the PKCE verifier stored when
 * the sign-in started. Returns the authorization-server hosts the server's
 * connections may reach from now on.
 */
export async function completeMcpOAuth({
  record,
  storage,
  endpoints,
  code,
  iss,
  fetch,
}: {
  record: McpServerRecord;
  storage: McpServersStorage;
  endpoints: McpOAuthEndpoints;
  code: string;
  iss: string | undefined;
  fetch: GuardedFetch;
}): Promise<{ status: 'authorized'; authorizationServerHosts: string[] } | { status: 'error'; error: string }> {
  const provider = createMcpOAuthProvider(record, { storage, endpoints });
  if (!provider) return { status: 'error', error: 'This server cannot sign in without a client ID.' };
  try {
    await auth(provider, {
      serverUrl: record.url,
      authorizationCode: code,
      ...(iss ? { iss } : {}),
      fetchFn: fetch,
      ...scopeOption(record),
    });
    return {
      status: 'authorized',
      authorizationServerHosts: authorizationServerHosts(record.url, await provider.discoveryState()),
    };
  } catch (error) {
    return { status: 'error', error: describeFailure(record, error) };
  }
}

function scopeOption(record: McpServerRecord): { scope?: string } {
  return record.oauthScopes.length > 0 ? { scope: record.oauthScopes.join(' ') } : {};
}

/** The authorization server's own host and its token endpoint's host, when they differ from the server's. */
function authorizationServerHosts(serverUrl: string, discovery: OAuthDiscoveryState | undefined): string[] {
  const own = new URL(serverUrl).host;
  const hosts = new Set<string>();
  for (const value of [discovery?.authorizationServerUrl, discovery?.authorizationServerMetadata?.token_endpoint]) {
    const host = value ? URL.parse(String(value))?.host : undefined;
    if (host && host !== own) hosts.add(host);
  }
  return [...hosts];
}

function describeFailure(record: McpServerRecord, error: unknown): string {
  for (let cause = error, depth = 0; cause && depth < 8; cause = (cause as { cause?: unknown }).cause, depth++) {
    if (cause instanceof McpServerNetworkPolicyError) return cause.message;
  }
  const oauth = findOAuthFailure(error);
  if (oauth) return `Sign-in failed: ${oauth.message}`;
  return `Sign-in failed: ${safeErrorText(record, error instanceof Error ? error.message : String(error))}`;
}
