import type { IncomingMessage } from 'node:http';
import type { RequestContext } from '@mastra/core/request-context';

import { MASTRA_AUTH_TOKEN_KEY, MASTRA_USER_KEY, RESERVED_REQUEST_CONTEXT_KEYS } from '../constants';

/**
 * Key under which `applyMcpRequestAuth` attaches the trusted request context to
 * `req.auth`. `@mastra/mcp` reads the same registered symbol and copies the
 * values into the request context its tools receive. A symbol cannot come out
 * of a token or JSON payload, so only server code can supply it.
 */
export const MCP_TRUSTED_REQUEST_CONTEXT = Symbol.for('mastra.mcp.trustedRequestContext');

/**
 * Shape the MCP SDK expects on `req.auth`.
 */
export interface McpAuthInfo {
  token: string;
  clientId: string;
  scopes: string[];
  extra?: Record<string, unknown>;
}

/**
 * Hook that sets `req.auth` before the MCP transport reads it.
 *
 * Receives the Node request handed to the MCP transport plus the Mastra
 * request context, which carries whatever server auth or your own middleware
 * resolved for this request. Setting `req.auth` is the caller's job; leaving it
 * unset is an explicit opt-out of the default bridge.
 *
 * The hook only owns `authInfo`. Whenever `req.auth` ends up set, the reserved
 * request context values (user, permissions, roles, resource, organization)
 * are still attached to it, so tools' `requestContext` reflects Mastra server
 * auth even if the hook's `authInfo` names a different principal.
 */
export type SetMcpRequestAuth = (req: IncomingMessage, requestContext: RequestContext) => void | Promise<void>;

function normalizeScopes(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((s): s is string => typeof s === 'string');
  if (typeof value === 'string') return value.split(/[\s,]+/).filter(Boolean);
  return [];
}

function resolveClientId(user: Record<string, unknown>): string {
  for (const key of ['id', 'sub', 'userId', 'email']) {
    const value = user[key];
    if (typeof value === 'string' && value) return value;
  }
  return '';
}

/**
 * Build the default `AuthInfo` from the Mastra request context.
 *
 * Returns `undefined` when the request carries no identity at all, so servers
 * without auth keep behaving exactly as before.
 */
export function buildMcpAuthInfoFromRequestContext(requestContext: RequestContext): McpAuthInfo | undefined {
  const user = requestContext.get(MASTRA_USER_KEY);
  const token = requestContext.get(MASTRA_AUTH_TOKEN_KEY);
  const hasUser = !!user && typeof user === 'object';
  const hasToken = typeof token === 'string' && token.length > 0;

  if (!hasUser && !hasToken) return undefined;

  const userRecord = (hasUser ? user : {}) as Record<string, unknown>;

  return {
    token: hasToken ? token : '',
    clientId: resolveClientId(userRecord),
    scopes: normalizeScopes(userRecord.scopes ?? userRecord.scope ?? userRecord.permissions),
    ...(hasUser ? { extra: { user: userRecord } } : {}),
  };
}

/**
 * Populate `req.auth` on the Node request that is about to be handed to an MCP
 * transport.
 *
 * Resolution order:
 * 1. An already-set `req.auth` keeps its identity.
 * 2. A configured `setRequestAuth` hook runs and fully owns the result.
 * 3. Otherwise the principal resolved by Mastra server auth is bridged from the
 *    request context using the default mapping.
 *
 * Whichever way `req.auth` is set, the trusted request context is attached to
 * it so MCP tools see the same principal as Mastra routes.
 */
export async function applyMcpRequestAuth({
  req,
  requestContext,
  setRequestAuth,
}: {
  req: IncomingMessage;
  requestContext?: RequestContext;
  setRequestAuth?: SetMcpRequestAuth;
}): Promise<void> {
  const request = req as IncomingMessage & { auth?: unknown };
  if (!requestContext) return;

  if (!request.auth) {
    if (setRequestAuth) {
      await setRequestAuth(req, requestContext);
    } else {
      const authInfo = buildMcpAuthInfoFromRequestContext(requestContext);
      if (authInfo) request.auth = authInfo;
    }
  }

  if (request.auth && typeof request.auth === 'object') {
    attachTrustedRequestContext(request.auth, requestContext);
  }
}

/**
 * Hands MCP tools the values Mastra server auth resolved for this request
 * (user, permissions, roles, resource id, tenant, auth mode), so a tool called
 * over MCP is authorized the same way as the matching HTTP route. The token is
 * left out; it is already on `authInfo`.
 */
function attachTrustedRequestContext(auth: object, requestContext: RequestContext): void {
  const trusted: Record<string, unknown> = {};
  for (const key of RESERVED_REQUEST_CONTEXT_KEYS) {
    if (key === MASTRA_AUTH_TOKEN_KEY || !requestContext.has(key)) continue;
    trusted[key] = requestContext.get(key);
  }
  Object.defineProperty(auth, MCP_TRUSTED_REQUEST_CONTEXT, { value: trusted, configurable: true });
}
