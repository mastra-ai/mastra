/**
 * Mastra `apiRoutes` for managing a project's intake routes: the ordered rules that place new
 * cards on a board and phase and decide whether an agent may start on them without a person.
 *
 * Reads need project membership; writes need an organization admin in tenant mode. A route's
 * target must be an installed board and a non-terminal phase when it is written; a target that
 * stops existing later is reported in `problems` and skipped when cards arrive.
 */

import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';
import type { z } from 'zod';

import { intakeTargetProblem, UNTRUSTED_AUTHOR_WHEN } from '../boards/intake-routing.js';
import type { ProjectBoardCache } from '../boards/project-boards.js';
import type { BoardRegistry } from '../boards/registry.js';
import type { AuditEmitter } from '../storage/domains/audit/domain.js';
import { StoredBoardError } from '../storage/domains/boards/base.js';
import type { StoredBoardScope, StoredBoardsStorage, StoredIntakeRouteRecord } from '../storage/domains/boards/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import { FACTORY_ROUTE_CONTRACTS } from './contracts.js';
import type { RouteDependencies } from './route.js';
import { Route } from './route.js';

export interface IntakeRouteRoutesDeps extends RouteDependencies {
  audit: AuditEmitter;
  projects: FactoryProjectsStorage;
  storage: StoredBoardsStorage;
  /** The project's installed boards, to check route targets against. */
  boards: Pick<ProjectBoardCache, 'describe'>;
}

type Resolved = StoredBoardScope & { userId: string };

/** A response the handler returns as is: a refusal or an error. */
class Refusal {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 422,
    readonly body: Record<string, unknown>,
  ) {}
}

function loose(context: unknown): Context {
  return context as Context;
}

function issueMessage(issues: readonly z.core.$ZodIssue[]): string {
  return issues
    .map(issue => (issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
    .join('; ');
}

function present(route: StoredIntakeRouteRecord, registry: BoardRegistry) {
  const { orgId: _orgId, factoryProjectId: _project, ...fields } = route;
  const problem = route.target ? intakeTargetProblem(registry, route.target) : undefined;
  return { ...fields, problems: problem ? [problem.message] : [] };
}

const FALLBACK = { hold: 'untrusted', untrustedWhen: UNTRUSTED_AUTHOR_WHEN } as const;

export class IntakeRouteRoutes extends Route<IntakeRouteRoutesDeps> {
  async #resolve(c: Context): Promise<Resolved> {
    const { auth, projects } = this.deps;
    await auth.ensureUser(c);
    const tenant = auth.tenant(c);
    if (!tenant) throw new Refusal(401, { error: 'unauthorized' });
    if (!tenant.orgId) {
      throw new Refusal(403, { error: 'organization_required', message: 'Intake routes belong to an organization.' });
    }
    const parsed = FACTORY_ROUTE_CONTRACTS.intakeRouteList.pathSchema.safeParse({ id: c.req.param('id') });
    if (!parsed.success) throw new Refusal(404, { error: 'Project not found' });
    await projects.ensureReady();
    if (!(await projects.get({ orgId: tenant.orgId, id: parsed.data.id }))) {
      throw new Refusal(404, { error: 'Project not found' });
    }
    return { orgId: tenant.orgId, userId: tenant.userId, factoryProjectId: parsed.data.id };
  }

  async #requireAdmin(c: Context, scope: Resolved): Promise<void> {
    const { auth } = this.deps;
    if (auth.enabled() && !(await auth.isOrganizationAdmin(c, scope.orgId))) {
      throw new Refusal(403, {
        error: 'organization_admin_required',
        message: 'Organization administrator access is required to change intake routes.',
      });
    }
  }

  async #body<T>(c: Context, schema: z.ZodType<T>): Promise<T> {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new Refusal(400, { error: 'invalid_request', message: 'Invalid JSON body.' });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new Refusal(422, { error: 'invalid_intake_route', message: issueMessage(parsed.error.issues) });
    }
    return parsed.data;
  }

  #routeId(c: Context): string {
    const parsed = FACTORY_ROUTE_CONTRACTS.intakeRouteGet.pathSchema.safeParse({
      id: c.req.param('id'),
      routeId: c.req.param('routeId'),
    });
    if (!parsed.success) throw new Refusal(404, { error: 'intake_route_not_found' });
    return parsed.data.routeId;
  }

  async #registry(scope: Resolved): Promise<BoardRegistry> {
    return (await this.deps.boards.describe(scope)).registry;
  }

  /** Refuses a target that isn't an installed board and a phase new cards can land in. */
  async #checkTarget(scope: Resolved, target: { boardKey: string; phaseKey?: string | null } | null | undefined) {
    if (!target) return;
    const problem = intakeTargetProblem(await this.#registry(scope), target);
    if (problem) throw new Refusal(422, { error: problem.code, message: problem.message });
  }

  async #list(c: Context, scope: Resolved, routes?: StoredIntakeRouteRecord[]) {
    const registry = await this.#registry(scope);
    routes ??= await this.deps.storage.listIntakeRoutes(scope);
    return c.json({ intakeRoutes: routes.map(route => present(route, registry)), fallback: FALLBACK });
  }

  async #respond(c: Context, scope: Resolved, route: StoredIntakeRouteRecord, status: 200 | 201 = 200) {
    return c.json({ intakeRoute: present(route, await this.#registry(scope)) }, status);
  }

  async #audit(
    c: Context,
    scope: Resolved,
    action: 'created' | 'updated' | 'deleted' | 'reordered',
    targets: { id: string; name: string }[],
  ) {
    await this.deps.audit.emit({
      context: c,
      input: {
        action: `factory.intake_route.${action}`,
        factoryProjectId: scope.factoryProjectId,
        targets: targets.map(route => ({ type: 'intake_route', id: route.id, name: route.name })),
      },
    });
  }

  #route(
    contract: { path: string; method: 'GET' | 'POST' | 'PATCH' | 'DELETE' },
    handle: (c: Context) => Promise<Response>,
  ): ApiRoute {
    return registerApiRoute(contract.path, {
      method: contract.method,
      requiresAuth: false,
      handler: async c => {
        const context = loose(c);
        try {
          return await handle(context);
        } catch (error) {
          if (error instanceof Refusal) return context.json(error.body, error.status);
          if (error instanceof StoredBoardError) {
            return context.json(
              { error: error.code, message: error.message },
              error.code === 'intake_route_not_found' ? 404 : 409,
            );
          }
          throw error;
        }
      },
    });
  }

  routes(): ApiRoute[] {
    const { storage } = this.deps;
    const contracts = FACTORY_ROUTE_CONTRACTS;
    return [
      this.#route(contracts.intakeRouteList, async c => this.#list(c, await this.#resolve(c))),

      this.#route(contracts.intakeRouteReorder, async c => {
        const scope = await this.#resolve(c);
        await this.#requireAdmin(c, scope);
        const { ids } = await this.#body(c, contracts.intakeRouteReorder.bodySchema);
        const routes = await storage.reorderIntakeRoutes(scope, ids, scope.userId);
        await this.#audit(c, scope, 'reordered', routes);
        return this.#list(c, scope, routes);
      }),

      this.#route(contracts.intakeRouteGet, async c => {
        const scope = await this.#resolve(c);
        const route = await storage.getIntakeRoute(scope, this.#routeId(c));
        if (!route) throw new Refusal(404, { error: 'intake_route_not_found' });
        return this.#respond(c, scope, route);
      }),

      this.#route(contracts.intakeRouteCreate, async c => {
        const scope = await this.#resolve(c);
        await this.#requireAdmin(c, scope);
        const input = await this.#body(c, contracts.intakeRouteCreate.bodySchema);
        await this.#checkTarget(scope, input.target);
        const route = await storage.createIntakeRoute(scope, input, scope.userId);
        await this.#audit(c, scope, 'created', [route]);
        return this.#respond(c, scope, route, 201);
      }),

      this.#route(contracts.intakeRouteUpdate, async c => {
        const scope = await this.#resolve(c);
        await this.#requireAdmin(c, scope);
        const id = this.#routeId(c);
        const { expectedRevision, ...patch } = await this.#body(c, contracts.intakeRouteUpdate.bodySchema);
        await this.#checkTarget(scope, patch.target);
        const route = await storage.updateIntakeRoute(scope, id, patch, { expectedRevision, actor: scope.userId });
        await this.#audit(c, scope, 'updated', [route]);
        return this.#respond(c, scope, route);
      }),

      this.#route(contracts.intakeRouteDelete, async c => {
        const scope = await this.#resolve(c);
        await this.#requireAdmin(c, scope);
        const id = this.#routeId(c);
        const parsed = contracts.intakeRouteDelete.querySchema.safeParse({
          expectedRevision: c.req.query('expectedRevision'),
        });
        if (!parsed.success) {
          throw new Refusal(422, { error: 'invalid_request', message: issueMessage(parsed.error.issues) });
        }
        const route = await storage.getIntakeRoute(scope, id);
        if (!route) throw new Refusal(404, { error: 'intake_route_not_found' });
        await storage.deleteIntakeRoute(scope, id, { expectedRevision: parsed.data.expectedRevision });
        await this.#audit(c, scope, 'deleted', [route]);
        return c.body(null, 204);
      }),
    ];
  }
}
