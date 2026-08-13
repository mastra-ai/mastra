import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentController } from '@mastra/core/agent-controller';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import { listFactorySkills } from '../skills/catalog.js';
import { resolveSkillInvocation, SkillInvocationError } from '../skills/service.js';
import type { SkillOverridesStorage } from '../storage/domains/skill-overrides/base.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import { FACTORY_SKILL_NAMES } from '../workspace.js';
import { tenantOrgId } from './provider-credentials.js';
import type { RouteDependencies } from './route.js';
import { Route } from './route.js';

const MAX_RESOURCE_ID_LENGTH = 512;
const MAX_SCOPE_LENGTH = 2048;
const MAX_ARGUMENTS_LENGTH = 16_384;
const MAX_OVERRIDE_DESCRIPTION_LENGTH = 1024;
const MAX_OVERRIDE_CONTENT_LENGTH = 262_144;
const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface SkillInvocationBody {
  resourceId: string;
  projectRepositoryId?: string;
  scope?: string;
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
  controller: Pick<AgentController<MastraCodeState>, 'getSessionByResource'>;
  sourceControlStorage?: SourceControlStorageHandle;
  ensureSourceControlReady?: () => Promise<void>;
  skillOverrides?: Pick<SkillOverridesStorage, 'get' | 'list' | 'upsert' | 'delete'>;
  authorizeSessionAddress?: (
    context: Context,
    address: { resourceId: string; projectRepositoryId?: string; scope?: string },
  ) => Promise<SessionAuthorizationResult>;
}

function loose(context: unknown): Context {
  return context as Context;
}

function parseBody(value: unknown): SkillInvocationBody | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const input = value as Record<string, unknown>;
  if (typeof input.resourceId !== 'string' || input.resourceId.length === 0) return undefined;
  if (input.resourceId.length > MAX_RESOURCE_ID_LENGTH) return undefined;
  if (
    input.projectRepositoryId !== undefined &&
    (typeof input.projectRepositoryId !== 'string' || !UUID_RE.test(input.projectRepositoryId))
  ) {
    return undefined;
  }
  if (input.scope !== undefined && (typeof input.scope !== 'string' || input.scope.length > MAX_SCOPE_LENGTH)) {
    return undefined;
  }
  if (typeof input.name !== 'string' || input.name.length > 64 || !SKILL_NAME_RE.test(input.name)) return undefined;
  if (input.arguments !== undefined) {
    if (typeof input.arguments !== 'string' || input.arguments.length > MAX_ARGUMENTS_LENGTH) return undefined;
  }
  return {
    resourceId: input.resourceId,
    ...(input.projectRepositoryId ? { projectRepositoryId: input.projectRepositoryId } : {}),
    ...(input.scope ? { scope: input.scope } : {}),
    name: input.name,
    ...(input.arguments !== undefined ? { arguments: input.arguments } : {}),
  };
}

export class SkillRoutes extends Route<SkillRoutesDeps> {
  async #authorizeSessionAddress(
    context: Context,
    address: { resourceId: string; projectRepositoryId?: string; scope?: string },
  ): Promise<SessionAuthorizationResult> {
    const { auth, sourceControlStorage: storage, ensureSourceControlReady } = this.deps;
    if (!auth.enabled()) return { allowed: true };

    await auth.ensureUser(context);
    const tenant = auth.tenant(context);
    if (!tenant) {
      return { allowed: false, status: 401, code: 'unauthorized', message: 'Authentication required.' };
    }

    // Personal sessions are keyed by the authenticated WorkOS user id. Their
    // scope is a client-managed local/user-session worktree and needs no app DB.
    if (address.resourceId === tenant.userId) return { allowed: true };

    // Factory sessions are keyed by factoryProjectId and explicitly identify the
    // linked repository whose user-owned worktree supplies the session scope.
    if (
      !UUID_RE.test(address.resourceId) ||
      !address.projectRepositoryId ||
      !UUID_RE.test(address.projectRepositoryId)
    ) {
      return { allowed: false, status: 400, code: 'invalid_request', message: 'Invalid skill invocation request.' };
    }
    if (!tenant.orgId || !address.scope) {
      return { allowed: false, status: 403, code: 'session_forbidden', message: 'Session access denied.' };
    }
    if (!storage) {
      return { allowed: false, status: 403, code: 'session_forbidden', message: 'Session access denied.' };
    }
    if (ensureSourceControlReady) {
      try {
        await ensureSourceControlReady();
      } catch {
        return { allowed: false, status: 403, code: 'session_forbidden', message: 'Session access denied.' };
      }
    }
    const projectRepository = await storage.projectRepositories.get({
      orgId: tenant.orgId,
      id: address.projectRepositoryId,
    });
    if (!projectRepository) {
      return { allowed: false, status: 403, code: 'session_forbidden', message: 'Session access denied.' };
    }
    const connection = await storage.connections.get({ orgId: tenant.orgId, id: projectRepository.connectionId });
    if (!connection || connection.factoryProjectId !== address.resourceId) {
      return { allowed: false, status: 403, code: 'session_forbidden', message: 'Session access denied.' };
    }
    const worktree = await storage.worktrees.findByPath({
      projectRepositoryId: address.projectRepositoryId,
      userId: tenant.userId,
      worktreePath: address.scope,
    });
    return worktree
      ? { allowed: true }
      : { allowed: false, status: 403, code: 'session_forbidden', message: 'Session access denied.' };
  }

  routes(): ApiRoute[] {
    const { controllerId, controller, authorizeSessionAddress: customAuthorize } = this.deps;
    const authorize =
      customAuthorize ??
      ((context: Context, address: { resourceId: string; projectRepositoryId?: string; scope?: string }) =>
        this.#authorizeSessionAddress(context, address));
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

      const authorization = await authorize(c, {
        resourceId: body.resourceId,
        projectRepositoryId: body.projectRepositoryId,
        scope: body.scope,
      });
      if (!authorization.allowed) {
        return c.json({ error: authorization.code, message: authorization.message }, authorization.status ?? 403);
      }

      try {
        const resolved = await resolveSkillInvocation(controller, body);
        if (dispatch) {
          void resolved.session.sendMessage({ content: resolved.message }).catch((error: unknown) => {
            console.error('Workspace skill dispatch failed after acceptance', error);
          });
        }
        return c.json({ ok: true, skill: resolved.skillName, message: resolved.message });
      } catch (error) {
        if (error instanceof SkillInvocationError) {
          return c.json({ error: error.code, message: error.message }, 404);
        }
        throw error;
      }
    };

    const { skillOverrides } = this.deps;

    // Resolve the org the skill overrides are scoped under, or an error
    // response. Mirrors the org-scoped settings routes: tenant org in auth
    // mode, sentinel `local` org otherwise.
    const resolveOverrideOrg = async (c: Context): Promise<{ orgId: string } | { error: Response }> => {
      const { auth } = this.deps;
      if (!auth.enabled()) return { orgId: 'local' };
      await auth.ensureUser(c);
      const tenant = auth.tenant(c);
      if (!tenant) {
        return { error: c.json({ error: 'unauthorized', message: 'Authentication required.' }, 401) };
      }
      return { orgId: tenantOrgId(tenant) };
    };

    const handleFactorySkillsList = async (context: unknown) => {
      const c = loose(context);
      const org = await resolveOverrideOrg(c);
      if ('error' in org) return org.error;
      const overrides = skillOverrides ? await skillOverrides.list({ orgId: org.orgId }) : [];
      return c.json({ skills: await listFactorySkills(overrides) });
    };

    const handleFactorySkillUpdate = async (context: unknown) => {
      const c = loose(context);
      const org = await resolveOverrideOrg(c);
      if ('error' in org) return org.error;
      if (!skillOverrides) {
        return c.json({ error: 'unavailable', message: 'Skill customization is not available.' }, 503);
      }
      const name = c.req.param('name');
      if (!name || !FACTORY_SKILL_NAMES.has(name)) {
        return c.json({ error: 'skill_not_found', message: 'Unknown factory skill.' }, 404);
      }
      let rawBody: unknown;
      try {
        rawBody = await c.req.json();
      } catch {
        return c.json({ error: 'invalid_request', message: 'Invalid JSON body.' }, 400);
      }
      const body = rawBody as { description?: unknown; content?: unknown } | null;
      const description = body?.description;
      const content = body?.content;
      if (
        typeof description !== 'string' ||
        description.length === 0 ||
        description.length > MAX_OVERRIDE_DESCRIPTION_LENGTH ||
        description.includes('\n') ||
        typeof content !== 'string' ||
        content.trim().length === 0 ||
        content.length > MAX_OVERRIDE_CONTENT_LENGTH
      ) {
        return c.json({ error: 'invalid_request', message: 'Invalid skill override.' }, 400);
      }
      const record = await skillOverrides.upsert({ orgId: org.orgId, name, description, content });
      return c.json({
        skill: { name: record.name, description: record.description, content: record.content, isCustomized: true },
      });
    };

    const handleFactorySkillReset = async (context: unknown) => {
      const c = loose(context);
      const org = await resolveOverrideOrg(c);
      if ('error' in org) return org.error;
      if (!skillOverrides) {
        return c.json({ error: 'unavailable', message: 'Skill customization is not available.' }, 503);
      }
      const name = c.req.param('name');
      if (!name || !FACTORY_SKILL_NAMES.has(name)) {
        return c.json({ error: 'skill_not_found', message: 'Unknown factory skill.' }, 404);
      }
      await skillOverrides.delete({ orgId: org.orgId, name });
      const skills = await listFactorySkills();
      const skill = skills.find(entry => entry.name === name);
      if (!skill) {
        return c.json({ error: 'skill_not_found', message: 'Unknown factory skill.' }, 404);
      }
      return c.json({ skill });
    };

    return [
      registerApiRoute('/web/factory/skills', {
        method: 'GET',
        requiresAuth: false,
        handler: context => handleFactorySkillsList(context),
      }),
      registerApiRoute('/web/factory/skills/:name', {
        method: 'PUT',
        requiresAuth: false,
        handler: context => handleFactorySkillUpdate(context),
      }),
      registerApiRoute('/web/factory/skills/:name', {
        method: 'DELETE',
        requiresAuth: false,
        handler: context => handleFactorySkillReset(context),
      }),
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
