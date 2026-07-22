import type { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { FactorySupervisorService } from '../supervisor/service.js';
import type { FactorySupervisorSignalService } from '../supervisor/signal-service.js';
import type { RouteAuth } from './route.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SupervisorRoutesOptions {
  auth: RouteAuth;
  projects: FactoryProjectsStorage;
  service: FactorySupervisorService;
  signals?: Pick<FactorySupervisorSignalService, 'refresh'>;
}

function loose(value: unknown): Context {
  return value as Context;
}

export class SupervisorRoutes {
  readonly #auth: RouteAuth;
  readonly #projects: FactoryProjectsStorage;
  readonly #service: FactorySupervisorService;
  readonly #signals?: Pick<FactorySupervisorSignalService, 'refresh'>;

  constructor(options: SupervisorRoutesOptions) {
    this.#auth = options.auth;
    this.#projects = options.projects;
    this.#service = options.service;
    this.#signals = options.signals;
  }

  async #resolveProject(
    context: Context,
  ): Promise<{ orgId: string; userId: string; factoryProjectId: string } | { response: Response }> {
    await this.#auth.ensureUser(context);
    const tenant = this.#auth.tenant(context);
    if (!tenant) return { response: context.json({ error: 'unauthorized' }, 401) };
    if (!tenant.orgId) {
      return {
        response: context.json(
          { error: 'organization_required', message: 'The Factory supervisor requires an organization.' },
          403,
        ),
      };
    }
    const factoryProjectId = context.req.param('id');
    if (!factoryProjectId || !UUID_RE.test(factoryProjectId)) {
      return { response: context.json({ error: 'Project not found' }, 404) };
    }
    await this.#projects.ensureReady();
    const project = await this.#projects.get({ orgId: tenant.orgId, id: factoryProjectId });
    if (!project) return { response: context.json({ error: 'Project not found' }, 404) };
    return { orgId: tenant.orgId, userId: tenant.userId, factoryProjectId };
  }

  routes(): ApiRoute[] {
    return [
      registerApiRoute('/web/factory/projects/:id/supervisor/session', {
        method: 'POST',
        requiresAuth: false,
        handler: async c => {
          const context = loose(c);
          const resolved = await this.#resolveProject(context);
          if ('response' in resolved) return resolved.response;
          try {
            const session = await this.#service.ensureSession({
              ...resolved,
              requestContext: context.get('requestContext') as RequestContext | undefined,
            });
            await this.#signals?.refresh(resolved);
            return c.json({ session });
          } catch (error) {
            return c.json(
              {
                error: 'supervisor_session_unavailable',
                message: error instanceof Error ? error.message : 'Factory supervisor session is unavailable.',
              },
              409,
            );
          }
        },
      }),
      registerApiRoute('/web/factory/projects/:id/supervisor/state', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const resolved = await this.#resolveProject(loose(c));
          if ('response' in resolved) return resolved.response;
          return c.json({ state: await this.#service.getState(resolved) });
        },
      }),
    ];
  }
}
