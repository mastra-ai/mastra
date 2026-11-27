/**
 * What the board shows about rule decisions and queued runs, read from storage.
 * Split from the work-item routes so a host that serves the board needs only auth, audit, the
 * projects and work-items domains, the project's boards, and (when it runs Factory work) its run slots.
 * Also settles decisions from the board: approve or dismiss a proposed run, retry a failed one.
 */

import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { ProjectBoardSource } from '../boards/project-boards.js';
import { overtakenDecisionIds } from '../rules/decision-applicability.js';
import type { AuditEmitter } from '../storage/domains/audit/domain.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { resolveFactoryProposal, retryFactoryDecision } from '../work-items/decision-actions.js';
import { FACTORY_ROUTE_CONTRACTS } from './contracts.js';
import { decisionSummary, encodeDecisionCursor } from './decision-wire.js';
import type { RouteDependencies } from './route.js';
import { loose, Route } from './route.js';
import { readRunQueue } from './run-queue.js';

export interface BoardLiveStateRoutesDeps extends RouteDependencies {
  projects: Pick<FactoryProjectsStorage, 'ensureReady' | 'get'>;
  workItems: WorkItemsStorage;
  audit: AuditEmitter;
  boards: ProjectBoardSource;
  /** Run-slot usage; a host that runs no Factory work leaves it out and the queue reports no slots. */
  runSlots?: () => Parameters<typeof readRunQueue>[0]['slots'];
}

export class BoardLiveStateRoutes extends Route<BoardLiveStateRoutesDeps> {
  async #resolve(
    c: Context,
  ): Promise<{ orgId: string; userId: string; factoryProjectId: string } | { response: Response }> {
    await this.deps.auth.ensureUser(c);
    const tenant = this.deps.auth.tenant(c);
    if (!tenant) return { response: c.json({ error: 'unauthorized' }, 401) };
    if (!tenant.orgId) {
      return {
        response: c.json(
          { error: 'organization_required', message: 'The Factory board requires an organization.' },
          403,
        ),
      };
    }
    const parsed = FACTORY_ROUTE_CONTRACTS.projectGet.pathSchema.safeParse({ id: c.req.param('id') });
    if (!parsed.success) return { response: c.json({ error: 'Project not found' }, 404) };
    await this.deps.projects.ensureReady();
    if (!(await this.deps.projects.get({ orgId: tenant.orgId, id: parsed.data.id }))) {
      return { response: c.json({ error: 'Project not found' }, 404) };
    }
    return { orgId: tenant.orgId, userId: tenant.userId, factoryProjectId: parsed.data.id };
  }

  /** Releasing a parked run and dropping it: same request, opposite outcomes, both audited as consent. */
  #proposalRoute(verb: 'approve' | 'dismiss'): ApiRoute {
    const { audit, workItems, boards } = this.deps;
    const contract =
      verb === 'approve' ? FACTORY_ROUTE_CONTRACTS.decisionApprove : FACTORY_ROUTE_CONTRACTS.decisionDismiss;
    return registerApiRoute(contract.path, {
      method: contract.method,
      requiresAuth: false,
      handler: async c => {
        const context = loose(c);
        const resolved = await this.#resolve(context);
        if ('response' in resolved) return resolved.response;
        const parsedPath = contract.pathSchema.safeParse({
          id: resolved.factoryProjectId,
          decisionId: context.req.param('decisionId'),
        });
        if (!parsedPath.success) return c.json({ error: 'invalid_decision_id' }, 422);
        await workItems.ensureReady();
        const settled = await resolveFactoryProposal({
          workItems,
          audit: input => audit.emit({ context, input }),
          orgId: resolved.orgId,
          factoryProjectId: resolved.factoryProjectId,
          userId: resolved.userId,
          decisionId: parsedPath.data.decisionId,
          action: verb,
        });
        if (!settled.ok) return c.json({ error: settled.code }, 409);
        return c.json({ decision: decisionSummary(await boards.load(resolved), settled.decision) });
      },
    });
  }

  routes(): ApiRoute[] {
    const { workItems, boards } = this.deps;
    return [
      this.#proposalRoute('approve'),
      this.#proposalRoute('dismiss'),

      registerApiRoute(FACTORY_ROUTE_CONTRACTS.decisionRetry.path, {
        method: FACTORY_ROUTE_CONTRACTS.decisionRetry.method,
        requiresAuth: false,
        handler: async c => {
          const context = loose(c);
          const resolved = await this.#resolve(context);
          if ('response' in resolved) return resolved.response;
          const parsedPath = FACTORY_ROUTE_CONTRACTS.decisionRetry.pathSchema.safeParse({
            id: resolved.factoryProjectId,
            decisionId: context.req.param('decisionId'),
          });
          if (!parsedPath.success) return c.json({ error: 'invalid_decision_id' }, 422);
          await workItems.ensureReady();
          const registry = await boards.load(resolved);
          const retried = await retryFactoryDecision({
            workItems,
            boards: registry,
            orgId: resolved.orgId,
            factoryProjectId: resolved.factoryProjectId,
            decisionId: parsedPath.data.decisionId,
          });
          if (!retried.ok) return c.json({ error: retried.code }, 409);
          return c.json({ decision: decisionSummary(registry, retried.decision) });
        },
      }),

      // ── Bounded durable rule-decision status ────────────────────────────────
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.decisionList.path, {
        method: FACTORY_ROUTE_CONTRACTS.decisionList.method,
        requiresAuth: false,
        handler: async c => {
          const context = loose(c);
          const resolved = await this.#resolve(context);
          if ('response' in resolved) return resolved.response;

          const query = FACTORY_ROUTE_CONTRACTS.decisionList.querySchema.safeParse({
            statuses: context.req.query('statuses'),
            before: context.req.query('before'),
            limit: context.req.query('limit'),
          });
          if (!query.success) {
            const field = query.error.issues[0]?.path[0];
            return c.json({ error: field === 'before' ? 'invalid_cursor' : 'invalid_decision_query' }, 400);
          }
          await workItems.ensureReady();
          const page = await workItems.listDeferredDecisionPage({
            orgId: resolved.orgId,
            factoryProjectId: resolved.factoryProjectId,
            statuses: query.data.statuses,
            before: query.data.before,
            limit: query.data.limit,
          });
          const last = page.decisions.at(-1);
          const registry = await boards.load(resolved);
          const overtaken = await overtakenDecisionIds(
            workItems,
            registry,
            resolved,
            page.decisions.filter(decision => decision.status === 'failed'),
          );
          return c.json({
            decisions: page.decisions.map(decision => decisionSummary(registry, decision, overtaken.has(decision.id))),
            ...(page.hasMore && last ? { nextCursor: encodeDecisionCursor(last) } : {}),
          });
        },
      }),

      // ── Automated runs waiting for a run slot ───────────────────────────────
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.runQueue.path, {
        method: FACTORY_ROUTE_CONTRACTS.runQueue.method,
        requiresAuth: false,
        handler: async c => {
          const resolved = await this.#resolve(loose(c));
          if ('response' in resolved) return resolved.response;
          await workItems.ensureReady();
          return c.json(
            await readRunQueue({
              workItems,
              orgId: resolved.orgId,
              factoryProjectId: resolved.factoryProjectId,
              slots: this.deps.runSlots?.(),
              now: new Date(),
            }),
          );
        },
      }),
    ];
  }
}
