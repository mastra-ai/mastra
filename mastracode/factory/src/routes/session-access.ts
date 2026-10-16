import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import type { RequestContext } from '@mastra/core/request-context';
import type { Context, MiddlewareHandler } from 'hono';

import type { SourceControlSessionLookup } from '../session/factory-session.js';
import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import type { RouteAuth } from './route.js';

/** Whether a viewer may read or drive a session: same org, and the owner when it is private. */
export function canViewSourceControlSession(
  session: Pick<SourceControlSession, 'orgId' | 'userId' | 'visibility'>,
  viewer: { orgId?: string; userId: string },
): boolean {
  if (session.orgId !== viewer.orgId) return false;
  return session.visibility !== 'private' || session.userId === viewer.userId;
}

const SESSION_PATH = /\/agent-controller\/[^/]+\/sessions\/([^/]+)/;
const CREATE_SESSION_PATH = /\/agent-controller\/[^/]+\/sessions\/?$/;
const SET_RESOURCE_PATH = /\/agent-controller\/[^/]+\/sessions\/[^/]+\/resource\/?$/;
const OM_CONFIG_PATH = /^\/web\/config\/om(\/|$)/;
const MEMORY_PATH = /^\/api\/memory(\/|$)/;

async function bodyField(c: Context, field: string): Promise<string | undefined> {
  // Read a clone: the Mastra adapter clones `c.req.raw` again to parse params,
  // which throws once anything has consumed the original body.
  const body = await c.req.raw
    .clone()
    .json()
    .catch(() => undefined);
  const value = (body as Record<string, unknown> | undefined)?.[field];
  return typeof value === 'string' && value ? value : undefined;
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Every session resource a request addresses, for routes that resolve a session or its memory by resourceId. */
async function addressedResourceIds(c: Context): Promise<string[]> {
  const path = c.req.path;
  const method = c.req.method;
  const sessionMatch = SESSION_PATH.exec(path);
  if (sessionMatch) {
    const resourceId = decodeSegment(sessionMatch[1]!);
    // Re-keying moves the caller's session onto `newResourceId`, so that resource must be reachable too.
    const target = method === 'POST' && SET_RESOURCE_PATH.test(path) ? await bodyField(c, 'newResourceId') : undefined;
    return target ? [resourceId, target] : [resourceId];
  }
  const fromRequest = async () =>
    c.req.query('resourceId') || (method === 'GET' ? undefined : await bodyField(c, 'resourceId'));
  let resourceId: string | undefined;
  if (method === 'POST' && CREATE_SESSION_PATH.test(path)) resourceId = await bodyField(c, 'resourceId');
  else if (OM_CONFIG_PATH.test(path) || MEMORY_PATH.test(path)) resourceId = await fromRequest();
  return resourceId ? [resourceId] : [];
}

/**
 * Keeps private sessions private on routes that address a live controller
 * session by resourceId (stream, messages, threads, state, re-keying, memory
 * settings). Those routes resolve the session from an in-memory map with no
 * ownership check, so an org teammate who learns a session id could otherwise
 * stream or drive it. Memory routes trust a client-supplied resourceId or
 * threadId, so they are checked the same way and bound to the authorized
 * resource. Factory user sessions use their session id as the resourceId;
 * resources that are not source-control sessions (personal, supervisor) pass
 * through untouched. Denials answer 404 so session ids do not leak existence.
 */
export function createSessionAccessGuard({
  auth,
  sessions,
}: {
  auth: RouteAuth;
  sessions: Pick<SourceControlSessionLookup, 'getBySessionId'>;
}): MiddlewareHandler {
  return async (c, next) => {
    const ctx = c as unknown as Context;
    const resourceIds = await addressedResourceIds(ctx);
    for (const resourceId of resourceIds) {
      const session = await sessions.getBySessionId(resourceId);
      if (!session) continue;
      await auth.ensureUser(ctx);
      const viewer = auth.tenant(ctx);
      if (!viewer || !canViewSourceControlSession(session, viewer)) {
        return c.json({ error: 'Session not found' }, 404);
      }
    }

    if (MEMORY_PATH.test(ctx.req.path)) {
      // Memory routes only check that a thread belongs to the request's resource
      // when one is bound server-side. Bind the resource just authorized, or the
      // caller's own user id, so a threadId cannot reach another session's thread.
      if (!resourceIds[0] && auth.enabled()) await auth.ensureUser(ctx);
      const requestContext = ctx.get('requestContext') as RequestContext | undefined;
      const bound = resourceIds[0] ?? (auth.enabled() ? auth.tenant(ctx)?.userId : undefined);
      if (requestContext && bound) requestContext.set(MASTRA_RESOURCE_ID_KEY, bound);
    }
    return next();
  };
}
