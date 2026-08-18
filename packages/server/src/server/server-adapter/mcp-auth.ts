import type { IncomingMessage } from 'node:http';
import type { RequestContext } from '@mastra/core/request-context';

import { MASTRA_AUTH_TOKEN_KEY, MASTRA_USER_KEY } from '../constants';

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
    token: hasToken ? (token as string) : '',
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
 * 1. An already-set `req.auth` is left untouched.
 * 2. A configured `setRequestAuth` hook runs and fully owns the result.
 * 3. Otherwise the principal resolved by Mastra server auth is bridged from the
 *    request context using the default mapping.
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
  if (request.auth) return;
  if (!requestContext) return;

  if (setRequestAuth) {
    await setRequestAuth(req, requestContext);
    return;
  }

  const authInfo = buildMcpAuthInfoFromRequestContext(requestContext);
  if (authInfo) {
    request.auth = authInfo;
  }
}
