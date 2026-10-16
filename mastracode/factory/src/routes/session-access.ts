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
const OM_CONFIG_PATH = /^\/web\/config\/om(\/|$)/;

async function bodyResourceId(c: Context): Promise<string | undefined> {
  // Read a clone: the Mastra adapter clones `c.req.raw` again to parse params,
  // which throws once anything has consumed the original body.
  const body = await c.req.raw
    .clone()
    .json()
    .catch(() => undefined);
  const resourceId = (body as { resourceId?: unknown } | undefined)?.resourceId;
  return typeof resourceId === 'string' && resourceId ? resourceId : undefined;
}

/** The session resource a request addresses, for routes that resolve a session by resourceId. */
async function addressedResourceId(c: Context): Promise<string | undefined> {
  const path = c.req.path;
  const sessionMatch = SESSION_PATH.exec(path);
  if (sessionMatch) {
    try {
      return decodeURIComponent(sessionMatch[1]!);
    } catch {
      return sessionMatch[1];
    }
  }
  if (c.req.method === 'POST' && CREATE_SESSION_PATH.test(path)) return bodyResourceId(c);
  if (OM_CONFIG_PATH.test(path)) {
    return c.req.method === 'GET' ? c.req.query('resourceId') || undefined : bodyResourceId(c);
  }
  return undefined;
}

/**
 * Keeps private sessions private on routes that address a live controller
 * session by resourceId (stream, messages, threads, state, memory settings).
 * Those routes resolve the session from an in-memory map with no ownership
 * check, so an org teammate who learns a session id could otherwise stream or
 * drive it. Factory user sessions use their session id as the resourceId;
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
    const resourceId = await addressedResourceId(c as unknown as Context);
    if (!resourceId) return next();

    const session = await sessions.getBySessionId(resourceId);
    if (!session) return next();

    await auth.ensureUser(c as unknown as Context);
    const viewer = auth.tenant(c as unknown as Context);
    if (!viewer || !canViewSourceControlSession(session, viewer)) {
      return c.json({ error: 'Session not found' }, 404);
    }
    return next();
  };
}
