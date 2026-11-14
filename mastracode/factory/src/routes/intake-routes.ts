/**
 * Mastra `apiRoutes` for managing a project's intake routes: the ordered rules that place new
 * cards on a board and phase when they arrive.
 *
 * Reads need a signed-in user of the project's organization; writes need an organization admin in
 * tenant mode. A route's target must be an installed board and a phase new cards can reach when it
 * is written; a target that
 * stops existing later is reported in `problems` and skipped when cards arrive.
 */

import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';
import type { z } from 'zod';
import { DEFAULT_ROUTE_EVENTS } from '../boards/board-events.js';

import type { StatusEvent } from '../boards/board-events.js';
import {
  arrivalRuleFacts,
  compareIntakeOrder,
  intakeTargetProblem,
  resolveIntake,
  ROUTE_AGAIN_KEY_PREFIX,
} from '../boards/intake-routing.js';
import type { ProjectBoardCache } from '../boards/project-boards.js';
import type { BoardRegistry } from '../boards/registry.js';
import { applyReroute, planReroute, summarizeReroute } from '../boards/reroute.js';
import type { FactoryCommitDecision } from '../rules/types.js';
import type { AuditEmitter } from '../storage/domains/audit/domain.js';
import { StoredBoardError } from '../storage/domains/boards/base.js';
import type {
  IntakeEvaluator,
  StoredBoardScope,
  StoredBoardsStorage,
  StoredIntakeDecisionRecord,
  StoredIntakeRouteRecord,
} from '../storage/domains/boards/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { FACTORY_ROUTE_CONTRACTS } from './contracts.js';
import type { RouteDependencies } from './route.js';
import { loose, Route } from './route.js';

export interface IntakeRouteRoutesDeps extends RouteDependencies {
  audit: AuditEmitter;
  projects: FactoryProjectsStorage;
  storage: StoredBoardsStorage;
  /** Cards an intake route change may move to another board. */
  workItems: Pick<
    WorkItemsStorage,
    'listShared' | 'update' | 'supersedeDecisionsForWorkItem' | 'get' | 'commitRuleEvaluation'
  >;
  /** The project's installed boards, to check route targets against. */
  boards: Pick<ProjectBoardCache, 'describe'>;
  /** Which evaluator places new items; the old `route-list` by default. */
  intakeEvaluator?: IntakeEvaluator;
  /** The rule set a Route again commits under. */
  configVersion?: string;
}

type LinkedDecision = Extract<FactoryCommitDecision, { type: 'upsertLinkedWorkItem' }>;

function presentDecision(decision: StoredIntakeDecisionRecord) {
  const { boardKey, routeId, reason, sourceKey, title, url, decidedAt, id, outcome, evaluator } = decision;
  return { id, outcome, evaluator, boardKey, routeId, reason, sourceKey, title, url, decidedAt };
}

type Resolved = StoredBoardScope & { userId: string };

/** A response the handler returns as is: a refusal or an error. */
class Refusal {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 422,
    readonly body: Record<string, unknown>,
  ) {}
}

function issueMessage(issues: readonly z.core.$ZodIssue[]): string {
  return issues
    .map(issue => (issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
    .join('; ');
}

function present(route: StoredIntakeRouteRecord, registry: BoardRegistry) {
  const { orgId: _orgId, factoryProjectId: _project, ...fields } = route;
  const problem = intakeTargetProblem(registry, route);
  return { ...fields, problems: problem ? [problem.message] : [] };
}

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

  /** Refuses a target that isn't an installed board and phase, or, for a route placing new cards, one they can't land in. */
  async #checkTarget(
    scope: Resolved,
    route: {
      target: { boardKey: string; phaseKey?: string | null; joinClosedIssue?: boolean };
      on: readonly StatusEvent[];
    },
  ) {
    const problem = intakeTargetProblem(await this.#registry(scope), route);
    if (problem) throw new Refusal(422, { error: problem.code, message: problem.message });
  }

  get #evaluator(): IntakeEvaluator {
    return this.deps.intakeEvaluator ?? 'route-list';
  }

  async #order(scope: Resolved, registry: BoardRegistry, evaluator = this.#evaluator): Promise<string[]> {
    if (evaluator !== 'intake-order') return [];
    const order = await this.deps.storage.readIntakeOrder(scope, { boards: [...registry.keys()] });
    return order.boardKeys.filter(key => registry.has(key));
  }

  async #planReroute(scope: Resolved) {
    const [registry, routes, items] = await Promise.all([
      this.#registry(scope),
      this.deps.storage.listIntakeRoutes(scope),
      this.deps.workItems.listShared(scope),
    ]);
    return planReroute(routes, items, registry, {
      evaluator: this.#evaluator,
      order: await this.#order(scope, registry),
    });
  }

  async #canEdit(c: Context, scope: Resolved): Promise<boolean> {
    const { auth } = this.deps;
    return !auth.enabled() || (await auth.isOrganizationAdmin(c, scope.orgId));
  }

  async #list(c: Context, scope: Resolved, routes?: StoredIntakeRouteRecord[]) {
    const registry = await this.#registry(scope);
    routes ??= await this.deps.storage.listIntakeRoutes(scope);
    return c.json({
      intakeRoutes: routes.map(route => present(route, registry)),
      canEdit: await this.#canEdit(c, scope),
    });
  }

  /** The project's boards in intake order: the stored order, with any board it lacks slotted in as a new one is. */
  async #intakeOrder(c: Context, scope: Resolved) {
    const registry = await this.#registry(scope);
    const [stored, routes, cards] = await Promise.all([
      this.deps.storage.readIntakeOrder(scope, { boards: [...registry.keys()] }),
      this.deps.storage.listIntakeRoutes(scope),
      this.deps.workItems.listShared(scope),
    ]);
    const listed = stored.boardKeys.filter(key => registry.has(key));
    const order = [...listed, ...[...registry.keys()].filter(key => !listed.includes(key))];
    return c.json({
      boards: order.map(boardKey => ({ boardKey, name: registry.get(boardKey)!.name })),
      origin: stored.origin,
      evaluator: this.#evaluator,
      // Worked out on every read, so it always describes the order in force and today's rules.
      comparison: compareIntakeOrder({ routes, order, registry, cards }),
      canEdit: await this.#canEdit(c, scope),
    });
  }

  #decisionId(c: Context): string {
    const parsed = FACTORY_ROUTE_CONTRACTS.intakeRouteAgain.pathSchema.safeParse({
      id: c.req.param('id'),
      decisionId: c.req.param('decisionId'),
    });
    if (!parsed.success) throw new Refusal(404, { error: 'intake_decision_not_found' });
    return parsed.data.decisionId;
  }

  /**
   * Runs intake again for an item no board took. Refuses while no board's rules take it; otherwise
   * commits the item's arrival afresh, so the dispatcher files it as a new arrival would be.
   */
  async #routeAgain(c: Context, scope: Resolved) {
    const { storage, workItems, configVersion } = this.deps;
    const decision = await storage.getIntakeDecision(scope, this.#decisionId(c));
    if (!decision || decision.outcome !== 'not_routed' || !decision.arrival) {
      throw new Refusal(404, { error: 'intake_decision_not_found' });
    }
    if (decision.resolvedAt) {
      throw new Refusal(409, { error: 'intake_decision_resolved', message: 'This item has been filed since.' });
    }
    if (!configVersion) {
      throw new Refusal(409, {
        error: 'factory_rules_unavailable',
        message: 'Factory rules are not available right now.',
      });
    }
    const arrival = decision.arrival as unknown as LinkedDecision;
    const [registry, routes] = await Promise.all([this.#registry(scope), storage.listIntakeRoutes(scope)]);
    // Only intake order leaves an item Not routed, so it decides again whatever this replica runs.
    const resolution = resolveIntake({
      evaluator: 'intake-order',
      routes,
      order: await this.#order(scope, registry, 'intake-order'),
      facts: await arrivalRuleFacts(arrival, {
        factoryProjectId: scope.factoryProjectId,
        registry,
        card: id => workItems.get({ orgId: scope.orgId, id }),
      }),
      registry,
    });
    if (resolution.outcome === 'not_routed') {
      throw new Refusal(422, { error: 'intake_not_routed', message: resolution.reason });
    }
    if (resolution.routeId === null) {
      throw new Refusal(422, { error: 'intake_not_routed', message: "No board's intake rules match it." });
    }
    const attempt = `${ROUTE_AGAIN_KEY_PREFIX}${decision.id}:${globalThis.crypto.randomUUID()}`;
    await workItems.commitRuleEvaluation({
      orgId: scope.orgId,
      factoryProjectId: scope.factoryProjectId,
      workItemId: null,
      ingress: { identity: attempt, triggerType: 'intake.route_again' },
      configVersion,
      expectedRevision: null,
      actor: { type: 'system', id: 'factory-intake-route-again' },
      outcome: { status: 'accepted' },
      decisions: [{ ...arrival, idempotencyKey: attempt }],
      causalChain: [],
      now: new Date(),
    });
    await this.deps.audit.emit({
      context: c,
      input: {
        action: 'factory.intake.routed_again',
        factoryProjectId: scope.factoryProjectId,
        targets: [{ type: 'intake_decision', id: decision.id, name: decision.title }],
        metadata: { sourceKey: decision.sourceKey, boardKey: resolution.board, routeId: resolution.routeId },
      },
    });
    return c.json(
      { status: 'queued', boardKey: resolution.board, phaseKey: resolution.phase, routeId: resolution.routeId },
      202,
    );
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
    contract: { path: string; method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' },
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
              error.code === 'intake_route_not_found' || error.code === 'intake_decision_not_found'
                ? 404
                : error.code === 'invalid_intake_route' ||
                    error.code === 'intake_route_limit' ||
                    error.code === 'invalid_intake_cursor'
                  ? 422
                  : 409,
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
      this.#route(contracts.intakeRouteList, async c => {
        const scope = await this.#resolve(c);
        const query = contracts.intakeRouteList.querySchema.safeParse({ boardKey: c.req.query('boardKey') });
        if (!query.success) {
          throw new Refusal(422, { error: 'invalid_request', message: issueMessage(query.error.issues) });
        }
        const { boardKey } = query.data;
        return this.#list(
          c,
          scope,
          boardKey === undefined ? undefined : await storage.listIntakeRoutes(scope, { boardKey }),
        );
      }),

      this.#route(contracts.intakeOrderGet, async c => this.#intakeOrder(c, await this.#resolve(c))),

      this.#route(contracts.intakeOrderUpdate, async c => {
        const scope = await this.#resolve(c);
        await this.#requireAdmin(c, scope);
        const { boardKeys } = await this.#body(c, contracts.intakeOrderUpdate.bodySchema);
        const registry = await this.#registry(scope);
        const before = await storage.readIntakeOrder(scope, { boards: [...registry.keys()] });
        await storage.setIntakeOrder(scope, boardKeys, { boards: [...registry.keys()] });
        await this.deps.audit.emit({
          context: c,
          input: {
            action: 'factory.intake_order.updated',
            factoryProjectId: scope.factoryProjectId,
            targets: [{ type: 'factory_project', id: scope.factoryProjectId }],
            metadata: { before: before.boardKeys, after: boardKeys },
          },
        });
        return this.#intakeOrder(c, scope);
      }),

      this.#route(contracts.intakeNotRoutedList, async c => {
        const scope = await this.#resolve(c);
        const query = contracts.intakeNotRoutedList.querySchema.safeParse({
          limit: c.req.query('limit'),
          cursor: c.req.query('cursor'),
        });
        if (!query.success) {
          throw new Refusal(422, { error: 'invalid_request', message: issueMessage(query.error.issues) });
        }
        const page = await storage.listNotRouted(scope, query.data);
        return c.json({
          notRouted: page.notRouted.map(presentDecision),
          nextCursor: page.nextCursor,
          canEdit: await this.#canEdit(c, scope),
        });
      }),

      this.#route(contracts.intakeRouteAgain, async c => {
        const scope = await this.#resolve(c);
        await this.#requireAdmin(c, scope);
        return this.#routeAgain(c, scope);
      }),

      this.#route(contracts.intakeRouteReroutePreview, async c => {
        const scope = await this.#resolve(c);
        const moves = await this.#planReroute(scope);
        return c.json({ total: moves.length, moves: summarizeReroute(moves) });
      }),

      this.#route(contracts.intakeRouteRerouteApply, async c => {
        const scope = await this.#resolve(c);
        await this.#requireAdmin(c, scope);
        const moves = await this.#planReroute(scope);
        const result = await applyReroute({
          moves,
          workItems: this.deps.workItems,
          registry: await this.#registry(scope),
          userId: scope.userId,
        });
        await this.deps.audit.emit({
          context: c,
          input: {
            action: 'factory.intake_route.rerouted',
            factoryProjectId: scope.factoryProjectId,
            targets: [...new Set(moves.map(move => move.routeId))].map(id => ({ type: 'intake_route', id })),
            metadata: { ...result, moves: summarizeReroute(moves) },
          },
        });
        return c.json(result);
      }),

      this.#route(contracts.intakeRouteReorder, async c => {
        const scope = await this.#resolve(c);
        await this.#requireAdmin(c, scope);
        const { ids, boardKey } = await this.#body(c, contracts.intakeRouteReorder.bodySchema);
        const routes = await storage.reorderIntakeRoutes(
          scope,
          ids,
          scope.userId,
          boardKey === undefined ? {} : { boardKey },
        );
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
        await this.#checkTarget(scope, { target: input.target, on: input.on ?? DEFAULT_ROUTE_EVENTS });
        const route = await storage.createIntakeRoute(scope, input, scope.userId);
        await this.#audit(c, scope, 'created', [route]);
        return this.#respond(c, scope, route, 201);
      }),

      this.#route(contracts.intakeRouteUpdate, async c => {
        const scope = await this.#resolve(c);
        await this.#requireAdmin(c, scope);
        const id = this.#routeId(c);
        const { expectedRevision, ...patch } = await this.#body(c, contracts.intakeRouteUpdate.bodySchema);
        if (patch.target || patch.on) {
          // Narrowing or widening `on` changes which targets are allowed, so check the route as it will be.
          const current = await storage.getIntakeRoute(scope, id);
          if (!current) throw new Refusal(404, { error: 'intake_route_not_found' });
          // Under intake order a rule belongs to its board: it moves with it, never to another.
          if (this.#evaluator === 'intake-order' && patch.target && patch.target.boardKey !== current.target.boardKey) {
            throw new Refusal(422, {
              error: 'intake_route_board_fixed',
              message: `This rule belongs to board "${current.target.boardKey}"; add a rule on the other board instead.`,
            });
          }
          await this.#checkTarget(scope, { target: patch.target ?? current.target, on: patch.on ?? current.on });
        }
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
