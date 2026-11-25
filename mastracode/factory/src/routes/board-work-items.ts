/**
 * The board's work items: what each phase lists, what the filter menus offer, filing a card, and moving one.
 * Split from the work-item routes so a host that serves the board needs only auth, the projects,
 * work-items and audit domains, the project's boards, and (for placing a filed card) transitions.
 */

import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { FactoryBoardEngine } from '../board-engine/engine.js';
import type { IntakeRoutesReader } from '../boards/intake-routing.js';
import type { ProjectBoardSource } from '../boards/project-boards.js';
import type { FactoryTransitionRequest } from '../rules/transition-service.js';
import { auditRequestOrigin } from '../storage/domains/audit/domain.js';
import type { AuditEmitter } from '../storage/domains/audit/domain.js';
import type { IntakeEvaluator } from '../storage/domains/boards/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { CreateWorkItemInput, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { WorkItemRelationError } from '../storage/domains/work-items/base.js';
import { workItemFilterOptions } from '../work-items/board-filter-options.js';
import { boardPhases } from '../work-items/board-phases.js';
import { createFactoryWorkItem } from '../work-items/create-work-item.js';
import { hashedBody, namedBody, sendRevalidated } from './board-snapshot.js';
import { toVersionedWireWorkItem, toWireWorkItem, wireVersion } from './card-wire.js';
import { FACTORY_ROUTE_CONTRACTS } from './contracts.js';
import type { RouteDependencies } from './route.js';
import { loose, Route } from './route.js';

export interface BoardWorkItemRoutesDeps extends RouteDependencies {
  audit: AuditEmitter;
  projects: Pick<FactoryProjectsStorage, 'ensureReady' | 'get'>;
  workItems: WorkItemsStorage;
  boards: ProjectBoardSource;
  /** Places a filed card in its first phase and moves cards between phases; both refuse with 503 when absent. */
  boardEngine?: Pick<FactoryBoardEngine, 'requestMove'>;
  intakeRoutes?: IntakeRoutesReader;
  intakeEvaluator?: IntakeEvaluator;
}

/** Validate an untrusted create body. Unknown keys are dropped. */
export function parseCreateWorkItem(body: unknown): CreateWorkItemInput | null {
  const parsed = FACTORY_ROUTE_CONTRACTS.workItemCreate.bodySchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

function parseTransitionBody(
  body: unknown,
): Omit<FactoryTransitionRequest, 'orgId' | 'factoryProjectId' | 'workItemId' | 'actor'> | null {
  const parsed = FACTORY_ROUTE_CONTRACTS.workItemTransition.bodySchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

async function readJson(c: Context): Promise<unknown | undefined> {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

export class BoardWorkItemRoutes extends Route<BoardWorkItemRoutesDeps> {
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

  routes(): ApiRoute[] {
    const { audit, workItems, boardEngine } = this.deps;
    return [
      // ── What each phase of a board view lists, a page of it at a time ───────
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.boardPhases.path, {
        method: FACTORY_ROUTE_CONTRACTS.boardPhases.method,
        requiresAuth: false,
        handler: async c => {
          const context = loose(c);
          const resolved = await this.#resolve(context);
          if ('response' in resolved) return resolved.response;
          const path = FACTORY_ROUTE_CONTRACTS.boardPhases.pathSchema.safeParse({
            id: resolved.factoryProjectId,
            boardKey: context.req.param('boardKey'),
          });
          if (!path.success) return c.json({ error: 'board_not_found' }, 404);
          const query = FACTORY_ROUTE_CONTRACTS.boardPhases.querySchema.safeParse({
            sort: context.req.query('sort'),
            q: context.req.query('q'),
            source: context.req.queries('source'),
            linearProject: context.req.queries('linearProject'),
            label: context.req.queries('label'),
            pullRequest: context.req.queries('pullRequest'),
            trust: context.req.queries('trust'),
            teammate: context.req.queries('teammate'),
            author: context.req.queries('author'),
            assignee: context.req.queries('assignee'),
            reviewer: context.req.queries('reviewer'),
            worked: context.req.queries('worked'),
            limit: context.req.query('limit'),
            window: context.req.queries('window'),
            item: context.req.query('item'),
            cards: context.req.query('cards'),
          });
          // A view that fails to parse must not answer as another view.
          if (!query.success) return c.json({ error: 'invalid_phases_query' }, 400);
          const { cards: withBodies, ...view } = query.data;
          const project = { orgId: resolved.orgId, factoryProjectId: resolved.factoryProjectId };
          await workItems.ensureReady();
          const [list, boards] = await Promise.all([workItems.listShared(project), this.deps.boards.load(project)]);
          const board = boards.get(path.data.boardKey);
          if (!board) return c.json({ error: 'board_not_found' }, 404);
          const phases = Object.keys(board.phases);
          const { body, named } = boardPhases(
            list,
            { id: path.data.boardKey, phases },
            view,
            resolved.userId,
            wireVersion,
          );
          // The board asks again on each feed frame; most frames change nothing it shows.
          return sendRevalidated(
            context,
            namedBody(body, withBodies ? () => ({ workItems: named.map(toVersionedWireWorkItem) }) : undefined),
          );
        },
      }),

      // ── The labels and people the board's filter menus offer ────────────────
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.workItemFilterOptions.path, {
        method: FACTORY_ROUTE_CONTRACTS.workItemFilterOptions.method,
        requiresAuth: false,
        handler: async c => {
          const context = loose(c);
          const resolved = await this.#resolve(context);
          if ('response' in resolved) return resolved.response;
          await workItems.ensureReady();
          const list = await workItems.listShared({
            orgId: resolved.orgId,
            factoryProjectId: resolved.factoryProjectId,
          });
          return sendRevalidated(context, hashedBody(workItemFilterOptions(list)));
        },
      }),

      // ── Create (upsert on sourceKey) a work item ─────────────────────────────
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.workItemCreate.path, {
        method: FACTORY_ROUTE_CONTRACTS.workItemCreate.method,
        requiresAuth: false,
        handler: async c => {
          const resolved = await this.#resolve(loose(c));
          if ('response' in resolved) return resolved.response;

          const body = await readJson(loose(c));
          if (body === undefined) return c.json({ error: 'Invalid JSON body' }, 400);
          const input = parseCreateWorkItem(body);
          if (!input) return c.json({ error: 'invalid_work_item' }, 400);
          try {
            const created = await createFactoryWorkItem({
              workItems,
              boards: await this.deps.boards.load(resolved),
              boardEngine,
              intakeRoutes: this.deps.intakeRoutes,
              intakeEvaluator: this.deps.intakeEvaluator,
              audit: auditInput => audit.emit({ context: loose(c), input: auditInput }),
              orgId: resolved.orgId,
              userId: resolved.userId,
              factoryProjectId: resolved.factoryProjectId,
              input,
              origin: auditRequestOrigin(loose(c)),
            });
            switch (created.status) {
              case 'refused':
                if (created.code === 'factory_transitions_unavailable') return c.json({ error: created.code }, 503);
                return c.json(
                  { error: created.code, message: created.message },
                  created.code === 'invalid_board' || created.code === 'intake_board_required' ? 422 : 409,
                );
              case 'rejected':
                return c.json({ status: 'rejected', code: created.code, reason: created.reason }, 422);
              case 'reused': {
                // Source-key reuse: the POST updated an existing card, not created one.
                const { stages: _stages, sessions: _sessions, ...boundedPatch } = input;
                await audit.emit({
                  context: loose(c),
                  input: {
                    action: 'factory.work_item.updated',
                    factoryProjectId: created.item.factoryProjectId,
                    targets: [{ type: 'work_item', id: created.item.id, name: created.item.title }],
                    metadata: {
                      fields: Object.keys(boundedPatch).filter(
                        key => (boundedPatch as Record<string, unknown>)[key] !== undefined,
                      ),
                    },
                  },
                });
                return c.json({ workItem: toWireWorkItem(created.item) });
              }
              case 'created':
                return c.json({ workItem: toWireWorkItem(created.item) });
            }
          } catch (error) {
            if (error instanceof WorkItemRelationError) {
              return c.json({ error: error.code, message: error.message }, 400);
            }
            throw error;
          }
        },
      }),

      // ── Authoritative stage transition ──────────────────────────────────────
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.workItemTransition.path, {
        method: FACTORY_ROUTE_CONTRACTS.workItemTransition.method,
        requiresAuth: false,
        handler: async c => {
          const resolved = await this.#resolve(loose(c));
          if ('response' in resolved) return resolved.response;
          const context = loose(c);
          const parsedPath = FACTORY_ROUTE_CONTRACTS.workItemTransition.pathSchema.safeParse({
            id: resolved.factoryProjectId,
            workItemId: context.req.param('workItemId'),
          });
          if (!parsedPath.success) return c.json({ error: 'Work item not found' }, 404);
          const { workItemId } = parsedPath.data;
          const parsed = parseTransitionBody(await readJson(context));
          if (!parsed) return c.json({ error: 'invalid_transition_request' }, 400);
          if (!boardEngine) {
            return c.json({ error: 'factory_transition_unavailable' }, 503);
          }
          await this.deps.workItems.ensureReady();
          const result = await boardEngine.requestMove({
            ...parsed,
            orgId: resolved.orgId,
            factoryProjectId: resolved.factoryProjectId,
            workItemId,
            actor: { type: 'human', id: resolved.userId },
            ...auditRequestOrigin(loose(c)),
            ingress: {
              ...parsed.ingress,
              identity: `human:${resolved.userId}:${parsed.ingress.identity}`,
            },
          });
          if (result.status === 'accepted') return c.json({ result });
          return c.json({ result }, result.code === 'stale' ? 409 : 422);
        },
      }),
    ];
  }
}
