import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentController } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { InlineSkill } from '@mastra/core/skills';
import type { Context } from 'hono';

import { hashSkillContent, listFactorySkills, readFactorySkillOriginals } from '../skills/catalog.js';
import { formatSkillMessage, resolveSkillInvocation, SkillInvocationError } from '../skills/service.js';
import type { AuditEmitter } from '../storage/domains/audit/domain.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { SkillOverridesStorage } from '../storage/domains/skill-overrides/base.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import { FACTORY_ROUTE_CONTRACTS, skillOverrideSaveRequestSchema } from './contracts.js';
import type { RouteDependencies } from './route.js';
import { Route } from './route.js';

const MAX_SESSION_ID_LENGTH = 512;
const MAX_ARGUMENTS_LENGTH = 16_384;
const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface SkillInvocationBody {
  sessionId: string;
  name: string;
  arguments?: string;
}

interface SessionAuthorizationResult {
  allowed: boolean;
  status?: 400 | 401 | 403;
  code?: 'invalid_request' | 'unauthorized' | 'session_forbidden';
  message?: string;
}

export interface SkillRoutesDeps extends RouteDependencies {
  controllerId: string;
  controller: Pick<AgentController<MastraCodeState>, 'getSession'>;
  sourceControlStorage?: SourceControlStorageHandle;
  ensureSourceControlReady?: () => Promise<void>;
  authorizeSessionAddress?: (context: Context, address: { sessionId: string }) => Promise<SessionAuthorizationResult>;
  /** App skills from `MastraFactory({ skills })`, listed in the catalog alongside folder and bundled skills. */
  skills?: readonly InlineSkill[];
  /** Per-project skill edits. Without it the catalog lists originals only and edit routes are not served. */
  overrides?: {
    projects: Pick<FactoryProjectsStorage, 'ensureReady' | 'get'>;
    storage: Pick<SkillOverridesStorage, 'ensureReady' | 'list' | 'get' | 'upsert' | 'delete'>;
    audit: AuditEmitter;
  };
}

type ProjectAccess = { orgId: string; userId: string; projectId: string } | { response: Response };

function loose(context: unknown): Context {
  return context as Context;
}

function parseBody(value: unknown): SkillInvocationBody | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const input = value as Record<string, unknown>;
  if (typeof input.sessionId !== 'string' || input.sessionId.length === 0) return undefined;
  if (input.sessionId.length > MAX_SESSION_ID_LENGTH) return undefined;
  if (typeof input.name !== 'string' || input.name.length > 64 || !SKILL_NAME_RE.test(input.name)) return undefined;
  if (input.arguments !== undefined) {
    if (typeof input.arguments !== 'string' || input.arguments.length > MAX_ARGUMENTS_LENGTH) return undefined;
  }
  return {
    sessionId: input.sessionId,
    name: input.name,
    ...(input.arguments !== undefined ? { arguments: input.arguments } : {}),
  };
}

const SESSION_FORBIDDEN: SessionAuthorizationResult = {
  allowed: false,
  status: 403,
  code: 'session_forbidden',
  message: 'Session access denied.',
};

export class SkillRoutes extends Route<SkillRoutesDeps> {
  async #authorizeSessionAddress(
    context: Context,
    address: { sessionId: string },
  ): Promise<SessionAuthorizationResult> {
    const { auth, sourceControlStorage: storage, ensureSourceControlReady } = this.deps;
    if (!auth.enabled()) return { allowed: true };

    await auth.ensureUser(context);
    const tenant = auth.tenant(context);
    if (!tenant) {
      return { allowed: false, status: 401, code: 'unauthorized', message: 'Authentication required.' };
    }

    // Personal sessions created without a session id are addressed by the
    // authenticated WorkOS user id and need no app DB.
    if (address.sessionId === tenant.userId) return { allowed: true };

    // Factory sessions are addressed by their source-control session id.
    if (!UUID_RE.test(address.sessionId)) {
      return { allowed: false, status: 400, code: 'invalid_request', message: 'Invalid skill invocation request.' };
    }
    if (!tenant.orgId || !storage) return SESSION_FORBIDDEN;
    if (ensureSourceControlReady) {
      try {
        await ensureSourceControlReady();
      } catch {
        return SESSION_FORBIDDEN;
      }
    }
    const row = await storage.sessions.getBySessionId(address.sessionId);
    if (!row || row.orgId !== tenant.orgId || !row.projectRepositoryId) return SESSION_FORBIDDEN;
    // The session must be one the viewer can see under its repository.
    const visible = await storage.sessions.list({
      projectRepositoryId: row.projectRepositoryId,
      viewerUserId: tenant.userId,
    });
    return visible.some(session => session.sessionId === address.sessionId) ? { allowed: true } : SESSION_FORBIDDEN;
  }

  /** Resolves the signed-in tenant and a project of its organization, or the error response. */
  async #projectAccess(c: Context, projectId: string | undefined): Promise<ProjectAccess> {
    const { auth, overrides } = this.deps;
    await auth.ensureUser(c);
    const tenant = auth.tenant(c);
    if (!tenant) return { response: c.json({ error: 'unauthorized', message: 'Authentication required.' }, 401) };
    if (!tenant.orgId) {
      return {
        response: c.json({ error: 'organization_required', message: 'Factory projects require an organization.' }, 403),
      };
    }
    if (!overrides || !projectId) return { response: c.json({ error: 'Project not found' }, 404) };
    await overrides.projects.ensureReady();
    const project = await overrides.projects.get({ orgId: tenant.orgId, id: projectId });
    if (!project) return { response: c.json({ error: 'Project not found' }, 404) };
    return { orgId: tenant.orgId, userId: tenant.userId, projectId };
  }

  /** Org admins edit skills; with auth disabled the single local user does. */
  async #canEdit(c: Context, orgId: string): Promise<boolean> {
    const { auth } = this.deps;
    return !auth.enabled() || (await auth.isOrganizationAdmin(c, orgId));
  }

  async #catalogEntry(scope: { orgId: string; projectId: string }, name: string) {
    const { overrides, skills } = this.deps;
    const edits = overrides ? await overrides.storage.list(scope) : [];
    return (await listFactorySkills(skills, edits)).find(skill => skill.name === name);
  }

  routes(): ApiRoute[] {
    const { controllerId, controller, authorizeSessionAddress: customAuthorize } = this.deps;
    const authorize =
      customAuthorize ??
      ((context: Context, address: { sessionId: string }) => this.#authorizeSessionAddress(context, address));
    const handleSkillRequest = async (context: unknown, dispatch: boolean) => {
      const c = loose(context);
      if (c.req.param('controllerId') !== controllerId) {
        return c.json({ error: 'controller_not_found', message: 'Agent controller not found.' }, 404);
      }

      let rawBody: unknown;
      try {
        rawBody = await c.req.json();
      } catch {
        return c.json({ error: 'invalid_request', message: 'Invalid JSON body.' }, 400);
      }
      const body = parseBody(rawBody);
      if (!body) {
        return c.json({ error: 'invalid_request', message: 'Invalid skill invocation request.' }, 400);
      }

      const authorization = await authorize(c, { sessionId: body.sessionId });
      if (!authorization.allowed) {
        return c.json({ error: authorization.code, message: authorization.message }, authorization.status ?? 403);
      }

      try {
        const resolved = await resolveSkillInvocation(controller, body);
        const message = formatSkillMessage(resolved.skillName, resolved.contents);
        if (dispatch) {
          const requestContext = c.get('requestContext' as never) as RequestContext | undefined;
          void resolved.session
            .sendMessage({ content: message, ...(requestContext ? { requestContext } : {}) })
            .catch((error: unknown) => {
              console.error('Workspace skill dispatch failed after acceptance', error);
            });
        }
        return c.json({ ok: true, skill: resolved.skillName, message });
      } catch (error) {
        if (error instanceof SkillInvocationError) {
          return c.json({ error: error.code, message: error.message }, 404);
        }
        throw error;
      }
    };

    const handleFactorySkillsList = async (context: unknown) => {
      const c = loose(context);
      const { auth, overrides } = this.deps;
      const query = FACTORY_ROUTE_CONTRACTS.skillList.querySchema.safeParse(c.req.query());
      if (!query.success) return c.json({ error: 'invalid_request', message: 'Invalid project id.' }, 400);
      const { projectId } = query.data;
      if (projectId !== undefined) {
        const access = await this.#projectAccess(c, projectId);
        if ('response' in access) return access.response;
        await overrides!.storage.ensureReady();
        const edits = await overrides!.storage.list(access);
        return c.json({
          skills: await listFactorySkills(this.deps.skills, edits),
          canEdit: await this.#canEdit(c, access.orgId),
        });
      }
      if (auth.enabled()) {
        await auth.ensureUser(c);
        if (!auth.tenant(c)) {
          return c.json({ error: 'unauthorized', message: 'Authentication required.' }, 401);
        }
      }
      return c.json({ skills: await listFactorySkills(this.deps.skills) });
    };

    const handleSkillEdit = async (context: unknown, revert: boolean) => {
      const c = loose(context);
      const { overrides } = this.deps;
      const contract = revert ? FACTORY_ROUTE_CONTRACTS.skillOverrideRevert : FACTORY_ROUTE_CONTRACTS.skillOverrideSave;
      const path = contract.pathSchema.safeParse({ id: c.req.param('id'), name: c.req.param('name') });
      if (!path.success) return c.json({ error: 'not_found', message: 'Skill not found.' }, 404);
      const access = await this.#projectAccess(c, path.data.id);
      if ('response' in access) return access.response;
      if (!(await this.#canEdit(c, access.orgId))) {
        return c.json(
          { error: 'forbidden', message: 'Organization administrator access is required to edit skills.' },
          403,
        );
      }
      const name = path.data.name;
      const original = (await readFactorySkillOriginals(this.deps.skills)).get(name);
      if (!original) return c.json({ error: 'not_found', message: `Skill "${name}" not found.` }, 404);
      const scope = { orgId: access.orgId, projectId: access.projectId, skillName: name };
      await overrides!.storage.ensureReady();

      if (revert) {
        if (await overrides!.storage.delete(scope)) {
          await overrides!.audit.emit({
            context: c,
            input: {
              action: 'factory.skill.reverted',
              targets: [{ type: 'skill', id: name }],
              factoryProjectId: access.projectId,
            },
          });
        }
        return c.json({ skill: await this.#catalogEntry(access, name) });
      }

      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        return c.json({ error: 'invalid_request', message: 'Invalid JSON body.' }, 400);
      }
      const request = skillOverrideSaveRequestSchema.safeParse({
        ...(body && typeof body === 'object' ? body : {}),
        ...path.data,
      });
      if (!request.success) {
        return c.json(
          { error: 'invalid_skill', message: request.error.issues.map(issue => issue.message).join('\n') },
          400,
        );
      }
      await overrides!.storage.upsert({
        ...scope,
        content: request.data.content,
        baseHash: hashSkillContent(original.raw),
        updatedBy: access.userId,
      });
      await overrides!.audit.emit({
        context: c,
        input: {
          action: 'factory.skill.updated',
          targets: [{ type: 'skill', id: name }],
          factoryProjectId: access.projectId,
          metadata: { origin: original.origin },
        },
      });
      return c.json({ skill: await this.#catalogEntry(access, name) });
    };

    return [
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.skillList.path, {
        method: FACTORY_ROUTE_CONTRACTS.skillList.method,
        requiresAuth: false,
        handler: context => handleFactorySkillsList(context),
      }),
      ...(this.deps.overrides
        ? [
            registerApiRoute(FACTORY_ROUTE_CONTRACTS.skillOverrideSave.path, {
              method: FACTORY_ROUTE_CONTRACTS.skillOverrideSave.method,
              requiresAuth: false,
              handler: context => handleSkillEdit(context, false),
            }),
            registerApiRoute(FACTORY_ROUTE_CONTRACTS.skillOverrideRevert.path, {
              method: FACTORY_ROUTE_CONTRACTS.skillOverrideRevert.method,
              requiresAuth: false,
              handler: context => handleSkillEdit(context, true),
            }),
          ]
        : []),
      registerApiRoute('/web/agent-controller/:controllerId/skills/prepare', {
        method: 'POST',
        requiresAuth: false,
        handler: context => handleSkillRequest(context, false),
      }),
      registerApiRoute('/web/agent-controller/:controllerId/skills/invoke', {
        method: 'POST',
        requiresAuth: false,
        handler: context => handleSkillRequest(context, true),
      }),
    ];
  }
}
