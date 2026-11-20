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
 * is refused, and Platform refuses tokens issued for a resource, so a leaked
 * or phished MCP token can't reach the rest of the user's account.
 *
 * Signing keys come from each server's `jwks_uri` (RFC 8414 metadata).
 * With `resolveCaller`, a token naming an org is also checked against current
 * membership on every request.
 * Returns `null` for a token that isn't valid here; throws when the signing
 * keys or the caller can't be fetched, so an outage isn't mistaken for a bad
 * sign-in. Fetching metadata or keys gives up after `timeoutMs` (default 5s).
 */
export function createMcpTokenVerifier(options: {
  authorizationServers: string[];
  resource: string;
  resolveCaller?: McpCallerResolver;
  timeoutMs?: number;
}): McpTokenVerifier {
  const timeoutMs = options.timeoutMs ?? 5_000;
  const issuers = new Set(options.authorizationServers.map(trimSlash));
  const keySets = new Map<string, Promise<JWTVerifyGetKey>>();

  const keysFor = (issuer: string) => {
    let keys = keySets.get(issuer);
    if (!keys) {
      keys = (async () => {
        const response = await fetch(`${issuer}/.well-known/oauth-authorization-server`, {
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) throw new Error(`authorization server metadata answered ${response.status}`);
        const { jwks_uri } = (await response.json()) as { jwks_uri?: unknown };
        if (typeof jwks_uri !== 'string') throw new Error('authorization server metadata has no jwks_uri');
        return createRemoteJWKSet(new URL(jwks_uri), { timeoutDuration: timeoutMs });
      })();
      keySets.set(issuer, keys);
      // Retry a failed lookup on the next request instead of caching the failure.
      keys.catch(() => keySets.delete(issuer));
    }
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
      const orgId = typeof payload.org_id === 'string' && payload.org_id ? payload.org_id : undefined;
      return { userId: payload.sub!, ...(orgId ? { orgId } : {}) };
    } catch (error) {
      if (
        error instanceof errors.JOSEError &&
        !(error instanceof errors.JWKSTimeout) &&
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
