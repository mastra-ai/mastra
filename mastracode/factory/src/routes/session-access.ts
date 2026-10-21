import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import type { RequestContext } from '@mastra/core/request-context';
import type { Context, MiddlewareHandler } from 'hono';

import type { SourceControlSessionLookup } from '../session/factory-session.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import type { RouteAuth } from './route.js';

/**
 * Whether the viewer may read a visible session's conversation. A session on its owner's memory is
 * the owner's alone, whatever its row says.
 */
export function canReadSessionResource(
  session: Pick<SourceControlSession, 'userId'>,
  resourceId: string,
  viewer: { userId: string },
): boolean {
  return viewer.userId === session.userId || resourceId !== session.userId;
}

/** Whether a viewer may read or drive a session: same org, and the owner when it is private. */
export function canViewSourceControlSession(
  session: Pick<SourceControlSession, 'orgId' | 'userId' | 'visibility'>,
  viewer: { orgId?: string; userId: string },
): boolean {
  if (session.orgId !== viewer.orgId) return false;
  return session.visibility !== 'private' || session.userId === viewer.userId;
}

/** A teammate steers a shared session; only its owner changes the model and thinking level its turns run on. */
export function canSwitchSessionModel(
  session: Pick<SourceControlSession, 'userId'>,
  viewer: { userId: string },
): boolean {
  return session.userId === viewer.userId;
}

/** The controller reads the guard needs to find which resource a session runs on. */
export interface SessionResourceLookup {
  getSession(sessionId: string): Promise<{ identity: { getResourceId(): string } } | undefined>;
  queryThreadById(input: { threadId: string }): Promise<{ resourceId: string } | null>;
}

type Viewer = { orgId?: string; userId: string };

const SESSION_PATH = /\/agent-controller\/[^/]+\/sessions\/([^/]+)/;
const CREATE_SESSION_PATH = /\/agent-controller\/[^/]+\/sessions\/?$/;
const SET_RESOURCE_PATH = /\/agent-controller\/[^/]+\/sessions\/[^/]+\/resource\/?$/;
const OM_CONFIG_PATH = /^\/web\/config\/om(\/|$)/;
const MEMORY_PATH = /^\/api\/memory(\/|$)/;
const ACTIVE_RUNS_PATH = /\/agent-controller\/[^/]+\/active-runs\/?$/;
const SWITCH_MODEL_PATH = /\/agent-controller\/[^/]+\/sessions\/[^/]+\/model\/?$/;
const SET_STATE_PATH = /\/agent-controller\/[^/]+\/sessions\/[^/]+\/state\/?$/;

async function bodyValue(c: Context, field: string): Promise<unknown> {
  // Read a clone: the Mastra adapter clones `c.req.raw` again to parse params,
  // which throws once anything has consumed the original body.
  const body = await c.req.raw
    .clone()
    .json()
    .catch(() => undefined);
  return (body as Record<string, unknown> | undefined)?.[field];
}

async function bodyField(c: Context, field: string): Promise<string | undefined> {
  const value = await bodyValue(c, field);
  return typeof value === 'string' && value ? value : undefined;
}

async function switchesModel(c: Context): Promise<boolean> {
  const { method, path } = c.req;
  if (method === 'POST' && SWITCH_MODEL_PATH.test(path)) return true;
  if (method !== 'PUT' || !SET_STATE_PATH.test(path)) return false;
  const state = await bodyValue(c, 'state');
  return typeof state === 'object' && state !== null && 'thinkingLevel' in state;
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** The value of `field` from the query or the body; `null` when they differ, since handlers read one or the other. */
async function queryOrBody(c: Context, field: string): Promise<string | undefined | null> {
  const fromQuery = c.req.query(field) || undefined;
  const fromBody = c.req.method === 'GET' ? undefined : await bodyField(c, field);
  if (fromQuery && fromBody && fromQuery !== fromBody) return null;
  return fromQuery ?? fromBody;
}

/** The sessions and memory resources a request addresses. `null` when it names one ambiguously. */
async function addressed(c: Context): Promise<{ sessionIds: string[]; resourceIds: string[] } | null> {
  const path = c.req.path;
  const method = c.req.method;
  const sessionMatch = SESSION_PATH.exec(path);
  if (sessionMatch) {
    const sessionId = decodeSegment(sessionMatch[1]!);
    // Re-keying moves the session onto `newResourceId`, so that resource must be reachable too.
    const target = method === 'POST' && SET_RESOURCE_PATH.test(path) ? await bodyField(c, 'newResourceId') : undefined;
    return { sessionIds: [sessionId], resourceIds: target ? [target] : [] };
  }
  if (method === 'POST' && CREATE_SESSION_PATH.test(path)) {
    // Get-or-create: without a `sessionId` the session is addressed by its resourceId.
    const [sessionId, resourceId] = await Promise.all([bodyField(c, 'sessionId'), bodyField(c, 'resourceId')]);
    const id = sessionId ?? resourceId;
    return { sessionIds: id ? [id] : [], resourceIds: resourceId ? [resourceId] : [] };
  }
  if (OM_CONFIG_PATH.test(path)) {
    const sessionId = await queryOrBody(c, 'sessionId');
    if (sessionId === null) return null;
    return { sessionIds: sessionId ? [sessionId] : [], resourceIds: [] };
  }
  if (MEMORY_PATH.test(path)) {
    const resourceId = await queryOrBody(c, 'resourceId');
    if (resourceId === null) return null;
    return { sessionIds: [], resourceIds: resourceId ? [resourceId] : [] };
  }
  return { sessionIds: [], resourceIds: [] };
}

/**
 * Keeps private sessions private. A memory resource says who may read it: a
 * private session runs on its owner's user id, a shared one on its Factory's
 * id, and a session from before resources were shared on its own id. So a
 * caller reaches a resource only when it is their own user id, a Factory in
 * their organization, or a session id whose session they can view; any other
 * resource (another person's user id) answers 404.
 *
 * Session routes (stream, messages, threads, state, OM settings) resolve the
 * session from an in-memory map or its stored thread with no ownership check,
 * so both the session row and the resource it runs on are checked. Memory
 * routes trust a client-supplied resourceId or threadId, so they are bound to
 * the authorized resource, or the caller's own user id when none is named. The
 * controller-wide active-runs list drops runs on unreachable resources.
 * Denials answer 404 so ids do not leak existence. A teammate who can see a
 * session but tries to change its model or thinking level gets 403. With auth
 * disabled there is no tenant to protect and everything passes through.
 */
export function createSessionAccessGuard({
  auth,
  sessions,
  projects,
  controller,
}: {
  auth: RouteAuth;
  sessions: Pick<SourceControlSessionLookup, 'getBySessionId'>;
  projects: Pick<FactoryProjectsStorage, 'get'>;
  /** Resolved per request: the controller is built after the server config. */
  controller: () => SessionResourceLookup | undefined;
}): MiddlewareHandler {
  const canReachResource = async (resourceId: string, viewer: Viewer): Promise<boolean> => {
    if (resourceId === viewer.userId) return true;
    const session = await sessions.getBySessionId(resourceId);
    if (session) return canViewSourceControlSession(session, viewer);
    if (!viewer.orgId) return false;
    return (await projects.get({ orgId: viewer.orgId, id: resourceId })) !== null;
  };

  const sessionResourceId = async (sessionId: string): Promise<string> => {
    const lookup = controller();
    if (!lookup) return sessionId;
    const live = await lookup.getSession(sessionId);
    if (live) return live.identity.getResourceId();
    return (await lookup.queryThreadById({ threadId: sessionId }))?.resourceId ?? sessionId;
  };

  const canReachSession = async (sessionId: string, viewer: Viewer): Promise<boolean> => {
    const session = await sessions.getBySessionId(sessionId);
    if (session && !canViewSourceControlSession(session, viewer)) return false;
    const resourceId = await sessionResourceId(sessionId);
    // A session on its own id was just checked by its row; one without a row is nobody's private session.
    if (resourceId === sessionId) return true;
    return canReachResource(resourceId, viewer);
  };

  return async (c, next) => {
    if (!auth.enabled()) return next();
    const ctx = c as unknown as Context;
    const target = await addressed(ctx);
    if (!target) return c.json({ error: 'The query and body must name the same session' }, 400);
    const isMemory = MEMORY_PATH.test(ctx.req.path);
    const isActiveRuns = ctx.req.method === 'GET' && ACTIVE_RUNS_PATH.test(ctx.req.path);
    if (!target.sessionIds.length && !target.resourceIds.length && !isMemory && !isActiveRuns) return next();

    await auth.ensureUser(ctx);
    const viewer = auth.tenant(ctx);
    if (!viewer) return c.json({ error: 'Session not found' }, 404);
    for (const sessionId of target.sessionIds) {
      if (!(await canReachSession(sessionId, viewer))) return c.json({ error: 'Session not found' }, 404);
    }
    for (const resourceId of target.resourceIds) {
      if (!(await canReachResource(resourceId, viewer))) return c.json({ error: 'Session not found' }, 404);
    }
    if (await switchesModel(ctx)) {
      for (const sessionId of target.sessionIds) {
        const session = await sessions.getBySessionId(sessionId);
        if (session && !canSwitchSessionModel(session, viewer)) {
          return c.json({ error: 'Only the session’s owner can change its model' }, 403);
        }
      }
    }

    if (isMemory) {
      // Memory routes only check that a thread belongs to the request's resource
      // when one is bound server-side. Bind the resource just authorized, or the
      // caller's own user id, so a threadId cannot reach another resource's thread.
      const requestContext = ctx.get('requestContext') as RequestContext | undefined;
      requestContext?.set(MASTRA_RESOURCE_ID_KEY, target.resourceIds[0] ?? viewer.userId);
    }
    if (!isActiveRuns) return next();
    await next();
    await filterActiveRuns(ctx, resourceId => canReachResource(resourceId, viewer));
  };
}

/** Drops runs on resources the caller cannot reach from the controller-wide active-runs list. */
async function filterActiveRuns(c: Context, canReach: (resourceId: string) => Promise<boolean>): Promise<void> {
  if (!c.res.ok) return;
  const body = (await c.res
    .clone()
    .json()
    .catch(() => undefined)) as { runs?: Array<{ resourceId?: unknown }> } | undefined;
  if (!body || !Array.isArray(body.runs)) return;
  const resourceIds = [
    ...new Set(body.runs.flatMap(run => (typeof run.resourceId === 'string' ? [run.resourceId] : []))),
  ];
  const reachable = new Map(await Promise.all(resourceIds.map(async id => [id, await canReach(id)] as const)));
  const runs = body.runs.filter(run => typeof run.resourceId !== 'string' || reachable.get(run.resourceId));
  if (runs.length === body.runs.length) return;
  const headers = new Headers(c.res.headers);
  headers.delete('content-length');
  c.res.headers.delete('content-length');
  c.res = new Response(JSON.stringify({ ...body, runs }), { status: c.res.status, headers });
}
