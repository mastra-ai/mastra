/**
 * The board catalog: each board a project has and its phases. Split from the work-item routes so a
 * host that serves the catalog alone needs only auth, the projects domain, and the project's boards.
 */

import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import { boardFlow } from '../boards/index.js';
import { phaseOutcomes } from '../boards/phase-outcomes.js';
import type { ProjectBoardSource, StoredBoardDetails } from '../boards/project-boards.js';
import type { FactoryRuleBoardFlow } from '../rules/types.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import { FACTORY_ROUTE_CONTRACTS } from './contracts.js';
import type { RouteDependencies } from './route.js';
import { loose, Route } from './route.js';

export interface BoardCatalogRoutesDeps extends RouteDependencies {
  projects: Pick<FactoryProjectsStorage, 'ensureReady' | 'get'>;
  boards: ProjectBoardSource;
}

export class BoardCatalogRoutes extends Route<BoardCatalogRoutesDeps> {
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
    const parsed = FACTORY_ROUTE_CONTRACTS.boardCatalog.pathSchema.safeParse({ id: c.req.param('id') });
    if (!parsed.success) return { response: c.json({ error: 'Project not found' }, 404) };
    await this.deps.projects.ensureReady();
    if (!(await this.deps.projects.get({ orgId: tenant.orgId, id: parsed.data.id }))) {
      return { response: c.json({ error: 'Project not found' }, 404) };
    }
    return { orgId: tenant.orgId, userId: tenant.userId, factoryProjectId: parsed.data.id };
  }

  routes(): ApiRoute[] {
    return [
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.boardCatalog.path, {
        method: FACTORY_ROUTE_CONTRACTS.boardCatalog.method,
        requiresAuth: false,
        handler: async c => {
          const resolved = await this.#resolve(loose(c));
          if ('response' in resolved) return resolved.response;
          const project = this.deps.boards.describe
            ? await this.deps.boards.describe(resolved)
            : { registry: await this.deps.boards.load(resolved), details: undefined, problems: [] };
          return c.json({
            boards: [...project.registry].map(([id, board]) => ({
              id,
              ...catalogDetails(project.details?.get(id)),
              name: board.name,
              title: board.name,
              ...(board.description !== undefined ? { description: board.description } : {}),
              initialPhase: board.initialPhase,
              flow: catalogFlow(boardFlow(board)),
              phases: Object.entries(board.phases).map(([phaseId, phase]) => ({
                id: phaseId,
                name: phase.name,
                title: phase.name,
                ...(phase.description !== undefined ? { description: phase.description } : {}),
                kind: phase.kind,
                nextPhases: [...phase.nextPhases],
                ...(phase.kind === 'working'
                  ? {
                      role: phase.runner.context,
                      context: phase.runner.context,
                      agentId: phase.runner.agentId,
                      ...(phase.runner.skill ? { skill: phase.runner.skill } : {}),
                      ...(phase.runner.goal ? { goal: { ...phase.runner.goal } } : {}),
                      autoStart: phase.autoStart === true,
                      ...(phase.autoStartWhen ? { autoStartWhen: phase.autoStartWhen } : {}),
                      ...(phase.exitTool
                        ? {
                            exitTool: {
                              id: phase.exitTool.id,
                              autoApprove: phase.exitTool.autoApprove,
                              ...(phase.exitTool.autoApproveWhen
                                ? { autoApproveWhen: phase.exitTool.autoApproveWhen }
                                : {}),
                            },
                          }
                        : {}),
                      ...(phase.tools ? { tools: [...phase.tools] } : {}),
                      outcomes: phaseOutcomes(board, phaseId).map(({ key, label, to }) => ({ key, label, to })),
                    }
                  : {}),
                transitions: (board.transitions[phaseId] ?? []).map(({ outcome, to }) => ({ outcome, to })),
              })),
            })),
            ...(project.problems.length > 0 ? { problems: [...project.problems] } : {}),
          });
        },
      }),
    ];
  }
}

function catalogDetails(details: StoredBoardDetails | undefined) {
  if (!details) return {};
  return {
    source: details.source,
    editable: details.editable,
    ...(details.problems.length > 0 ? { problems: details.problems } : {}),
  };
}

function catalogFlow(flow: FactoryRuleBoardFlow) {
  return {
    ...(flow.triage ? { triage: flow.triage } : {}),
    ...(flow.build ? { build: flow.build } : {}),
    ...(flow.selfReview ? { selfReview: flow.selfReview } : {}),
    ...(flow.pullRequestReview ? { pullRequestReview: flow.pullRequestReview } : {}),
    ...(flow.completed ? { completed: flow.completed.phase } : {}),
    ...(flow.canceled ? { canceled: flow.canceled.phase } : {}),
  };
}
