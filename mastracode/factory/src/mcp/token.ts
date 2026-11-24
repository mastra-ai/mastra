import { createRemoteJWKSet, decodeJwt, errors, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import type { McpCallerResolver } from './caller.js';

/** The person an MCP access token was issued to, in the org they chose when signing in. */
export interface McpCaller {
  userId: string;
  orgId?: string;
  /** Name and picture for audit entries, when the caller was looked up. */
  profile?: { name?: string; email?: string; avatarUrl?: string };
}

export type McpTokenVerifier = (token: string) => Promise<McpCaller | null>;

/**
 * Verifies MCP access tokens as JWTs issued for this endpoint alone: signed by
 * one of `authorizationServers`, with `aud` naming `resource`. A token issued
 * for anything else (a Platform login, another Factory, Platform's own MCP)
 * is refused, and the Factory's auth gate refuses tokens issued for this one.
 *
 * Signing keys come from each server's `jwks_uri`, read from its RFC 8414
 * metadata, or from its OpenID Connect discovery document when it has none.
 * With `resolveCaller`, a token naming an org is also checked against current
 * membership on every request.
 * Returns `null` for a token that isn't valid here; throws when the signing
 * keys or the caller can't be fetched, so an outage isn't mistaken for a bad
 * sign-in. Fetching metadata or keys gives up after `timeoutMs` (default 5s).
 * Metadata is read again after `metadataMaxAgeMs` (default 10 minutes), so a
 * server that moves its keys to a new URL is followed without a restart.
 */
export function createMcpTokenVerifier(options: {
  authorizationServers: string[];
  resource: string;
  resolveCaller?: McpCallerResolver;
  timeoutMs?: number;
  metadataMaxAgeMs?: number;
}): McpTokenVerifier {
  const timeoutMs = options.timeoutMs ?? 5_000;
  const metadataMaxAgeMs = options.metadataMaxAgeMs ?? 10 * 60_000;
  const issuers = new Set(options.authorizationServers.map(trimSlash));
  const keySets = new Map<string, { keys: Promise<JWTVerifyGetKey>; readAt: number }>();

  const keysFor = (issuer: string) => {
    const cached = keySets.get(issuer);
    if (cached && Date.now() - cached.readAt < metadataMaxAgeMs) return cached.keys;
    // Concurrent requests share one lookup: it's cached before it settles.
    const keys = (async () => {
      const discover = (url: string) => fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      // RFC 8414 puts the well-known segment before the issuer's path; OpenID
      // Connect discovery appends it.
      const { origin, pathname } = new URL(issuer);
      let response = await discover(`${origin}/.well-known/oauth-authorization-server${trimSlash(pathname)}`);
      if (response.status === 404) response = await discover(`${issuer}/.well-known/openid-configuration`);
      if (!response.ok) throw new Error(`authorization server metadata answered ${response.status}`);
      const metadata = (await response.json()) as { issuer?: unknown; jwks_uri?: unknown };
      if (typeof metadata.issuer !== 'string' || trimSlash(metadata.issuer) !== issuer) {
        throw new Error('authorization server metadata names another issuer');
      }
      const { jwks_uri } = metadata;
      if (typeof jwks_uri !== 'string') throw new Error('authorization server metadata has no jwks_uri');
      return createRemoteJWKSet(new URL(jwks_uri), { timeoutDuration: timeoutMs });
    })();
    // The lifetime starts once the lookup answers, so a slow lookup is never repeated.
    const entry = { keys, readAt: Infinity };
    keySets.set(issuer, entry);
    keys.then(
      () => (entry.readAt = Date.now()),
      // Retry a failed lookup on the next request instead of caching the failure.
      () => keySets.get(issuer) === entry && keySets.delete(issuer),
    );
    return keys;
  };

  const verify = async (token: string): Promise<McpCaller | null> => {
    let issuer: string;
    try {
      const { iss } = decodeJwt(token);
      if (typeof iss !== 'string') return null;
      issuer = trimSlash(iss);
    } catch {
      return null;
    }
    if (!issuers.has(issuer)) return null;
    try {
      const { payload } = await jwtVerify(token, await keysFor(issuer), {
        issuer: [issuer, `${issuer}/`],
        audience: options.resource,
        requiredClaims: ['sub', 'exp'],
      });
      // `jose` accepts an audience list that merely includes ours.
      const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (audience.some(aud => aud !== options.resource)) return null;
      // `requiredClaims` checks that `sub` is present, not that it's a string.
      if (typeof payload.sub !== 'string' || !payload.sub) return null;
      const orgId = typeof payload.org_id === 'string' && payload.org_id ? payload.org_id : undefined;
      return { userId: payload.sub, ...(orgId ? { orgId } : {}) };
    } catch (error) {
      // A bad token is refused; keys that can't be fetched or read are an outage.
      if (
        error instanceof errors.JOSEError &&
        !(error instanceof errors.JWKSTimeout) &&
        !(error instanceof errors.JWKSInvalid) &&
        error.code !== 'ERR_JOSE_GENERIC'
      ) {
        return null;
      }
      throw error;
    }
  };

  return async token => {
    const claimed = await verify(token);
    if (!claimed?.orgId || !options.resolveCaller) return claimed;
    return options.resolveCaller({ userId: claimed.userId, orgId: claimed.orgId });
  };
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}
