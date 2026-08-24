import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentController } from '@mastra/core/agent-controller';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import { listFactorySkills } from '../skills/catalog.js';
import { resolveSkillInvocation, SkillInvocationError } from '../skills/service.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import type { RouteDependencies } from './route.js';
import { Route } from './route.js';
import { authorizeSessionAddress } from './session-address.js';
import type { SessionAuthorizationResult, SessionCommandAddress } from './session-address.js';

const MAX_RESOURCE_ID_LENGTH = 512;
const MAX_SCOPE_LENGTH = 2048;
const MAX_ARGUMENTS_LENGTH = 16_384;
const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface SkillInvocationBody {
  resourceId: string;
  projectRepositoryId?: string;
  scope?: string;
  name: string;
  arguments?: string;
}

export interface SkillRoutesDeps extends RouteDependencies {
  controllerId: string;
  controller: Pick<AgentController<MastraCodeState>, 'getSessionByResource'>;
  sourceControlStorage?: SourceControlStorageHandle;
  ensureSourceControlReady?: () => Promise<void>;
  authorizeSessionAddress?: (context: Context, address: SessionCommandAddress) => Promise<SessionAuthorizationResult>;
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
  routes(): ApiRoute[] {
    const {
      controllerId,
      controller,
      auth,
      sourceControlStorage,
      ensureSourceControlReady,
      authorizeSessionAddress: customAuthorize,
    } = this.deps;
    const authorize =
      customAuthorize ??
      ((context: Context, address: SessionCommandAddress) =>
        authorizeSessionAddress({ auth, sourceControlStorage, ensureSourceControlReady }, context, address, {
          invalidRequestMessage: 'Invalid skill invocation request.',
        }));
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

    const handleFactorySkillsList = async (context: unknown) => {
      const c = loose(context);
      if (auth.enabled()) {
        await auth.ensureUser(c);
        if (!auth.tenant(c)) {
          return c.json({ error: 'unauthorized', message: 'Authentication required.' }, 401);
        }
      }
      return c.json({ skills: await listFactorySkills() });
    };

    return [
      registerApiRoute('/web/factory/skills', {
        method: 'GET',
        requiresAuth: false,
        handler: context => handleFactorySkillsList(context),
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
