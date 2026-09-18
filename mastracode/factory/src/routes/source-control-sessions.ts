import { randomUUID } from 'node:crypto';
import type { MountedMastraCode } from '@mastra/code-sdk';
import { resolveModel } from '@mastra/code-sdk/agents/model';
import { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute, IUserProvider } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import { UniqueViolationError } from '@mastra/core/storage';
import type { Context } from 'hono';

import { reclaimDeletedSessionSandbox } from '../integrations/github/sandbox-release.js';
import type { SessionRetirementCoordinator } from '../sandbox/session-retirement.js';
import { normalizeSessionTitle } from '../session/session-title.js';
import type { MemorySettingsStorage } from '../storage/domains/memory-settings/base.js';
import type {
  ProjectRepository,
  SourceControlSession,
  SourceControlStorageHandle,
} from '../storage/domains/source-control/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { RouteAuth } from './route.js';

type RouteContext = Context;

function loose(c: unknown): RouteContext {
  return c as RouteContext;
}

const USER_SESSION_BRANCH_PREFIX = 'user/session-';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_SESSION_OWNER_PROFILES = 100;
const MAX_SESSION_OWNER_PROFILE_CACHE_ENTRIES = 500;
const SESSION_OWNER_PROFILE_TTL_MS = 5 * 60_000;

interface SessionOwnerProfile {
  id: string;
  name: string;
  avatarUrl?: string;
}

type SessionOwnerUserProvider = Pick<IUserProvider, 'getUser'> & Partial<Pick<IUserProvider, 'getUsers'>>;

export interface SourceControlSessionRoutesOptions {
  auth: RouteAuth;
  sourceControls: readonly SourceControlStorageHandle[];
  users?: SessionOwnerUserProvider;
  controller?: MountedMastraCode['controller'];
  memorySettings: Pick<MemorySettingsStorage, 'get'>;
  sessionRetirement?: SessionRetirementCoordinator;
  workItems?: Pick<WorkItemsStorage, 'clearSessionReferences'>;
}

interface ResolvedProjectRepository {
  sourceControl: SourceControlStorageHandle;
  project: ProjectRepository;
  defaultBranch: string;
}

async function resolveOrgTenant(
  c: RouteContext,
  auth: RouteAuth,
): Promise<{ tenant: { orgId: string; userId: string } } | { response: Response }> {
  await auth.ensureUser(c);
  const tenant = auth.tenant(c);
  if (!tenant) return { response: c.json({ error: 'unauthorized', reason: 'auth_required' }, 401) };
  if (!tenant.orgId) {
    return {
      response: c.json(
        {
          error: 'organization_required',
          message: 'Source-control sessions require an organization.',
        },
        403,
      ),
    };
  }
  return { tenant: { orgId: tenant.orgId, userId: tenant.userId } };
}

async function resolveProjectRepository(
  sourceControls: readonly SourceControlStorageHandle[],
  orgId: string,
  projectRepositoryId: string,
): Promise<ResolvedProjectRepository | null> {
  const matches = (
    await Promise.all(
      sourceControls.map(async sourceControl => {
        const project = await sourceControl.projectRepositories.get({ orgId, id: projectRepositoryId });
        if (!project) return null;
        const repository = await sourceControl.repositories.get({ orgId, id: project.repositoryId });
        if (!repository) return null;
        return {
          sourceControl,
          project,
          defaultBranch: project.branch ?? repository.defaultBranch,
        };
      }),
    )
  ).filter((match): match is ResolvedProjectRepository => match !== null);
  if (matches.length > 1) {
    throw new Error('Factory project repository exists in multiple source-control providers.');
  }
  return matches[0] ?? null;
}

async function resolveSession(
  sourceControls: readonly SourceControlStorageHandle[],
  sessionId: string,
): Promise<{ sourceControl: SourceControlStorageHandle; session: SourceControlSession } | null> {
  const matches = (
    await Promise.all(
      sourceControls.map(async sourceControl => ({
        sourceControl,
        session: await sourceControl.sessions.getBySessionId(sessionId),
      })),
    )
  ).filter(
    (match): match is { sourceControl: SourceControlStorageHandle; session: SourceControlSession } =>
      match.session !== null,
  );
  if (matches.length > 1) throw new Error('Factory session exists in multiple source-control providers.');
  return matches[0] ?? null;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidGitRef(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 255 && /^[A-Za-z0-9_./-]+$/.test(value);
}

function createSessionNaming() {
  const inFlight = new Map<string, Promise<string | null>>();
  return (sessionId: string, run: () => Promise<string | null>) => {
    const pending = inFlight.get(sessionId);
    if (pending) return pending;
    const started = run().finally(() => inFlight.delete(sessionId));
    inFlight.set(sessionId, started);
    return started;
  };
}

function titleModel(modelId: string) {
  return ({ requestContext }: { requestContext: RequestContext }) =>
    resolveModel(modelId, { remapForCodexOAuth: true, requestContext });
}

function createSessionOwnerProfileResolver(users: SessionOwnerUserProvider | undefined) {
  const cache = new Map<string, { profile?: SessionOwnerProfile; expiresAt: number }>();
  const cacheProfile = (userId: string, profile: SessionOwnerProfile | undefined, expiresAt: number) => {
    cache.delete(userId);
    cache.set(userId, { profile, expiresAt });
    if (cache.size > MAX_SESSION_OWNER_PROFILE_CACHE_ENTRIES) {
      const oldestUserId = cache.keys().next().value;
      if (oldestUserId !== undefined) cache.delete(oldestUserId);
    }
  };

  return async (userIds: string[]): Promise<Map<string, SessionOwnerProfile>> => {
    if (!users) return new Map();
    const requestedUserIds = [...new Set(userIds)].slice(0, MAX_SESSION_OWNER_PROFILES);
    const profiles = new Map<string, SessionOwnerProfile>();
    const unresolvedUserIds: string[] = [];
    const now = Date.now();

    for (const userId of requestedUserIds) {
      const cached = cache.get(userId);
      if (!cached || cached.expiresAt <= now) {
        cache.delete(userId);
        unresolvedUserIds.push(userId);
      } else if (cached.profile) {
        profiles.set(userId, cached.profile);
      }
    }
    if (unresolvedUserIds.length === 0) return profiles;

    let resolvedUsers: Array<Awaited<ReturnType<SessionOwnerUserProvider['getUser']>>>;
    if (users.getUsers) {
      try {
        resolvedUsers = await users.getUsers(unresolvedUserIds);
      } catch (error) {
        console.warn('[Factory Sessions] Bulk owner profile lookup failed; falling back to individual lookups', {
          error: error instanceof Error ? error.message : String(error),
        });
        resolvedUsers = (await Promise.allSettled(unresolvedUserIds.map(userId => users.getUser(userId))))
          .filter(result => result.status === 'fulfilled')
          .map(result => result.value);
      }
    } else {
      resolvedUsers = (await Promise.allSettled(unresolvedUserIds.map(userId => users.getUser(userId))))
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value);
    }

    for (const user of resolvedUsers) {
      if (!user) continue;
      const name = user.name?.trim() || user.email?.trim();
      if (!name) continue;
      profiles.set(user.id, {
        id: user.id,
        name,
        ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
      });
    }
    const expiresAt = now + SESSION_OWNER_PROFILE_TTL_MS;
    for (const userId of unresolvedUserIds) cacheProfile(userId, profiles.get(userId), expiresAt);
    return profiles;
  };
}

function projectSessionRoutes(
  path: '/web/source-control/projects/:id/sessions' | '/web/github/projects/:id/sessions',
  options: SourceControlSessionRoutesOptions,
  resolveOwnerProfiles: ReturnType<typeof createSessionOwnerProfileResolver>,
): ApiRoute[] {
  return [
    registerApiRoute(path, {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveOrgTenant(loose(c), options.auth);
        if ('response' in resolved) return resolved.response;
        const { orgId, userId } = resolved.tenant;
        const projectRepositoryId = c.req.param('id');
        const project = projectRepositoryId
          ? await resolveProjectRepository(options.sourceControls, orgId, projectRepositoryId)
          : null;
        if (!project) return c.json({ error: 'Project repository not found' }, 404);
        const sessions = await project.sourceControl.sessions.list({
          projectRepositoryId: project.project.id,
          viewerUserId: userId,
        });
        const owners = await resolveOwnerProfiles(sessions.map(session => session.userId));
        return c.json({
          sessions: sessions.map(session => {
            const owner = owners.get(session.userId);
            return { ...session, ...(owner ? { owner } : {}) };
          }),
        });
      },
    }),
    registerApiRoute(path, {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveOrgTenant(loose(c), options.auth);
        if ('response' in resolved) return resolved.response;
        const { orgId, userId } = resolved.tenant;
        const projectRepositoryId = c.req.param('id');
        const project = projectRepositoryId
          ? await resolveProjectRepository(options.sourceControls, orgId, projectRepositoryId)
          : null;
        if (!project) return c.json({ error: 'Project repository not found' }, 404);
        let body: unknown;
        try {
          body = await c.req.json();
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }
        if (!isJsonObject(body)) return c.json({ error: 'Invalid JSON body' }, 400);
        if (body.baseBranch !== undefined && typeof body.baseBranch !== 'string') {
          return c.json({ error: 'Invalid baseBranch' }, 400);
        }
        const baseBranch = body.baseBranch ?? project.defaultBranch;
        if (!isValidGitRef(baseBranch)) return c.json({ error: 'Invalid baseBranch' }, 400);
        if (
          body.sessionId !== undefined &&
          (typeof body.sessionId !== 'string' || !UUID_PATTERN.test(body.sessionId))
        ) {
          return c.json({ error: 'Invalid sessionId' }, 400);
        }
        const requestedSessionId = body.sessionId as string | undefined;
        const sessionId = requestedSessionId ?? randomUUID();
        if (body.title !== undefined && typeof body.title !== 'string') {
          return c.json({ error: 'Invalid title' }, 400);
        }
        const normalizedTitle = body.title === undefined ? null : normalizeSessionTitle(body.title as string);
        let branch: string;
        if (body.branch === undefined) branch = `${USER_SESSION_BRANCH_PREFIX}${sessionId}`;
        else if (isValidGitRef(body.branch)) branch = body.branch;
        else return c.json({ error: 'Invalid branch' }, 400);

        if (requestedSessionId) {
          const existing = await project.sourceControl.sessions.getBySessionId(sessionId);
          if (existing) {
            if (
              existing.projectRepositoryId !== project.project.id ||
              existing.orgId !== orgId ||
              existing.userId !== userId ||
              existing.branch !== branch
            ) {
              return c.json({ error: 'Session ID conflict' }, 409);
            }
            return c.json({ session: existing });
          }
        }

        const session = await project.sourceControl.sessions
          .create({
            sessionId,
            projectRepositoryId: project.project.id,
            orgId,
            userId,
            branch,
            baseBranch,
            title: normalizedTitle,
            visibility: 'org',
          })
          .catch(async error => {
            if (!(error instanceof UniqueViolationError) || !requestedSessionId) throw error;
            const conflict = await project.sourceControl.sessions.getBySessionId(sessionId);
            if (!conflict) throw error;
            return conflict;
          });
        if (
          requestedSessionId &&
          (session.sessionId !== sessionId ||
            session.projectRepositoryId !== project.project.id ||
            session.orgId !== orgId ||
            session.userId !== userId ||
            session.branch !== branch)
        ) {
          return c.json({ error: 'Session ID conflict' }, 409);
        }
        return c.json({ session });
      },
    }),
  ];
}

export function buildSourceControlSessionRoutes(options: SourceControlSessionRoutesOptions): ApiRoute[] {
  const nameSession = createSessionNaming();
  const resolveOwnerProfiles = createSessionOwnerProfileResolver(options.users);
  return [
    ...projectSessionRoutes('/web/source-control/projects/:id/sessions', options, resolveOwnerProfiles),
    // Compatibility for existing clients; new code uses the provider-neutral path.
    ...projectSessionRoutes('/web/github/projects/:id/sessions', options, resolveOwnerProfiles),
    registerApiRoute('/web/user-sessions/:sessionId', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveOrgTenant(loose(c), options.auth);
        if ('response' in resolved) return resolved.response;
        const match = await resolveSession(options.sourceControls, c.req.param('sessionId'));
        const session = match?.session;
        if (
          !session ||
          session.orgId !== resolved.tenant.orgId ||
          (session.visibility === 'private' && session.userId !== resolved.tenant.userId)
        ) {
          return c.json({ error: 'Session not found' }, 404);
        }
        return c.json({ session });
      },
    }),
    registerApiRoute('/web/user-sessions/:sessionId', {
      method: 'DELETE',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveOrgTenant(loose(c), options.auth);
        if ('response' in resolved) return resolved.response;
        const match = await resolveSession(options.sourceControls, c.req.param('sessionId'));
        const session = match?.session;
        if (
          !match ||
          !session ||
          session.orgId !== resolved.tenant.orgId ||
          session.userId !== resolved.tenant.userId
        ) {
          return c.json({ error: 'Session not found' }, 404);
        }
        try {
          await options.controller?.deleteSession({ resourceId: session.sessionId });
        } catch (error) {
          console.error('[Factory Sessions] Failed to tear down live controller session', {
            sessionId: session.sessionId,
            error,
          });
        }
        if (options.sessionRetirement) {
          await options.sessionRetirement.retireSession({
            sourceControl: match.sourceControl,
            ...(options.workItems ? { workItems: options.workItems } : {}),
            orgId: session.orgId,
            sessionId: session.sessionId,
            deleteSession: true,
          });
        } else {
          await options.workItems?.clearSessionReferences({ orgId: session.orgId, sessionId: session.sessionId });
          await match.sourceControl.sessions.delete(session.id);
          void reclaimDeletedSessionSandbox({ session }).catch((error: unknown) => {
            console.error('[Factory Sessions] Failed to reclaim sandbox for deleted session', {
              sessionId: session.sessionId,
              sandboxId: session.sandboxId,
              error,
            });
          });
        }
        return c.json({ removed: true });
      },
    }),
    registerApiRoute('/web/user-sessions/:sessionId/title', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveOrgTenant(loose(c), options.auth);
        if ('response' in resolved) return resolved.response;
        const sessionId = c.req.param('sessionId');
        const match = await resolveSession(options.sourceControls, sessionId);
        const row = match?.session;
        if (!match || !row || row.orgId !== resolved.tenant.orgId || row.userId !== resolved.tenant.userId) {
          return c.json({ error: 'Session not found' }, 404);
        }
        if (!options.controller) return c.json({ error: 'Sessions are not available on this server.' }, 503);
        const threads = await options.controller.queryThreads({ resourceId: sessionId });
        const thread = threads.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
        if (!thread) return c.json({ error: 'This session has no conversation to name yet.' }, 409);
        const stored = await options.memorySettings.get({ orgId: row.orgId, userId: row.userId });
        const requestContext = new RequestContext();
        requestContext.set('user', { workosId: row.userId, organizationId: row.orgId });
        try {
          const title = await nameSession(sessionId, async () => {
            const generated = await options.controller!.generateThreadTitle({
              threadId: thread.id,
              resourceId: sessionId,
              requestContext,
              ...(stored?.observerModelId ? { model: titleModel(stored.observerModelId) } : {}),
            });
            const named = generated ? normalizeSessionTitle(generated) : null;
            if (named) await match.sourceControl.sessions.rename({ sessionId, title: named });
            return named;
          });
          if (!title) return c.json({ error: 'The model returned an empty title. Try again.' }, 502);
          return c.json({ title });
        } catch (error) {
          return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
        }
      },
    }),
  ];
}
