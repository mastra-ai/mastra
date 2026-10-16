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
const ACTIVE_RUNS_PATH = /\/agent-controller\/[^/]+\/active-runs\/?$/;

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

/**
 * Every session resource a request addresses, for routes that resolve a session or its memory by resourceId.
 * `null` when the query and body name different resources: handlers read one or the other, so the request is ambiguous.
 */
async function addressedResourceIds(c: Context): Promise<string[] | null> {
  const path = c.req.path;
  const method = c.req.method;
  const sessionMatch = SESSION_PATH.exec(path);
  if (sessionMatch) {
    const resourceId = decodeSegment(sessionMatch[1]!);
    // Re-keying moves the caller's session onto `newResourceId`, so that resource must be reachable too.
    const target = method === 'POST' && SET_RESOURCE_PATH.test(path) ? await bodyField(c, 'newResourceId') : undefined;
    return target ? [resourceId, target] : [resourceId];
  }
  if (method === 'POST' && CREATE_SESSION_PATH.test(path)) {
    const resourceId = await bodyField(c, 'resourceId');
    return resourceId ? [resourceId] : [];
  }
  if (!OM_CONFIG_PATH.test(path) && !MEMORY_PATH.test(path)) return [];
  const fromQuery = c.req.query('resourceId') || undefined;
  const fromBody = method === 'GET' ? undefined : await bodyField(c, 'resourceId');
  if (fromQuery && fromBody && fromQuery !== fromBody) return null;
  const resourceId = fromQuery ?? fromBody;
  return resourceId ? [resourceId] : [];
}

/** Drops runs on sessions the caller cannot view from the controller-wide active-runs list. */
async function filterActiveRuns(
  c: Context,
  auth: RouteAuth,
  sessions: Pick<SourceControlSessionLookup, 'getBySessionId'>,
): Promise<void> {
  if (!c.res.ok) return;
  const body = (await c.res
    .clone()
    .json()
    .catch(() => undefined)) as { runs?: Array<{ resourceId?: unknown }> } | undefined;
  if (!body || !Array.isArray(body.runs)) return;
  const resourceIds = [
    ...new Set(body.runs.flatMap(run => (typeof run.resourceId === 'string' ? [run.resourceId] : []))),
  ];
  const sessionById = new Map(
    await Promise.all(resourceIds.map(async id => [id, await sessions.getBySessionId(id)] as const)),
  );
  let viewer: ReturnType<RouteAuth['tenant']> | null = null;
  const runs = [];
  for (const run of body.runs) {
    const session = typeof run.resourceId === 'string' ? sessionById.get(run.resourceId) : null;
    if (session) {
      if (viewer === null) {
        await auth.ensureUser(c);
        viewer = auth.tenant(c);
      }
      if (!viewer || !canViewSourceControlSession(session, viewer)) continue;
    }
    runs.push(run);
  }
  if (runs.length === body.runs.length) return;
  const headers = new Headers(c.res.headers);
  headers.delete('content-length');
  c.res.headers.delete('content-length');
  c.res = new Response(JSON.stringify({ ...body, runs }), { status: c.res.status, headers });
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
 * The controller-wide active-runs list is filtered the same way.
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
    if (!resourceIds) return c.json({ error: 'resourceId in the query and body must match' }, 400);
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
    if (ctx.req.method === 'GET' && ACTIVE_RUNS_PATH.test(ctx.req.path)) {
      await next();
      await filterActiveRuns(ctx, auth, sessions);
      return;
    }
    return next();
  };
}
