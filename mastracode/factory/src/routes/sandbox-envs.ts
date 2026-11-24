import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { EnvironmentScope } from '../environment/handlers.js';
import { SandboxEnvHandlers } from '../environment/handlers.js';
import type { AuditEmitter } from '../storage/domains/audit/domain.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { SandboxEnvStore } from '../storage/domains/sandbox-envs/base.js';
import { FACTORY_ROUTE_CONTRACTS, UUID_PATTERN } from './contracts.js';
import type { RouteDependencies } from './route.js';
import { loose, Route } from './route.js';

const UUID_RE = new RegExp(UUID_PATTERN);

export interface SandboxEnvRoutesDeps extends RouteDependencies {
  projects: Pick<FactoryProjectsStorage, 'get'>;
  sandboxEnvs: SandboxEnvStore;
  /**
   * False when auth is on but no secret encryption is configured: values would
   * be stored as plaintext, so writes are refused and the UI says why.
   */
  writable: boolean;
  audit?: AuditEmitter;
  /** Called after a variable changed; Build variables are part of the environment template. */
  onEnvironmentSaved?: (projectId: string) => void;
}

/**
 * Factory-wide sandbox environment variables. Values go in through PUT and
 * never come back out: every response carries names and settings only, and
 * none may be cached.
 */
export class SandboxEnvRoutes extends Route<SandboxEnvRoutesDeps> {
  readonly #handlers: SandboxEnvHandlers;

  constructor(deps: SandboxEnvRoutesDeps) {
    super(deps);
    this.#handlers = new SandboxEnvHandlers(deps);
  }

  async #resolve(context: Context): Promise<EnvironmentScope | { response: Response }> {
    await this.deps.auth.ensureUser(context);
    const tenant = this.deps.auth.tenant(context);
    if (!tenant) return { response: context.json({ error: 'unauthorized' }, 401) };
    if (!tenant.orgId) {
      return {
        response: context.json(
          { error: 'organization_required', message: 'Factory projects require an organization.' },
          403,
        ),
      };
    }
    const projectId = context.req.param('id');
    if (!projectId || !UUID_RE.test(projectId)) return { response: context.json({ error: 'Project not found' }, 404) };
    const project = await this.deps.projects.get({ orgId: tenant.orgId, id: projectId });
    if (!project) return { response: context.json({ error: 'Project not found' }, 404) };
    return { orgId: tenant.orgId, userId: tenant.userId, projectId };
  }

  #route(
    contract: { path: string; method: 'GET' | 'PUT' | 'PATCH' | 'DELETE' },
    handle: (context: Context, scope: EnvironmentScope) => Promise<Response>,
  ): ApiRoute {
    return registerApiRoute(contract.path, {
      method: contract.method,
      requiresAuth: false,
      handler: async routeContext => {
        const context = loose(routeContext);
        const scope = await this.#resolve(context);
        const response = 'response' in scope ? scope.response : await handle(context, scope);
        response.headers.set('Cache-Control', 'no-store');
        return response;
      },
    });
  }

  routes(): ApiRoute[] {
    const contracts = FACTORY_ROUTE_CONTRACTS;
    return [
      this.#route(contracts.projectSandboxEnvsList, (context, scope) => this.#handlers.list(context, scope)),
      this.#route(contracts.projectSandboxEnvSet, (context, scope) => this.#handlers.set(context, scope)),
      this.#route(contracts.projectSandboxEnvUpdate, (context, scope) => this.#handlers.update(context, scope)),
      this.#route(contracts.projectSandboxEnvDelete, (context, scope) => this.#handlers.delete(context, scope)),
    ];
  }
}
