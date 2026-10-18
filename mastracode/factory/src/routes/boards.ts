import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import { BoardDefinitionError } from '../boards/define-board.js';
import type { LiveBoardRegistry } from '../boards/registry.js';
import { boardForWorkItem } from '../boards/semantics.js';
import { buildStoredBoard, newStoredBoardId, parseStoredBoard } from '../boards/stored-board.js';
import type { FactoryBoardRecord, FactoryBoardsStorage } from '../storage/domains/factory-boards/base.js';
import type { PhaseSkillsStorage } from '../storage/domains/phase-skills/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { WorkItemRow, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { RouteDependencies } from './route.js';
import { Route } from './route.js';

export interface BoardRoutesDeps extends RouteDependencies {
  storedBoards: FactoryBoardsStorage;
  phaseSkills: Pick<PhaseSkillsStorage, 'clearBoard'>;
  workItems: Pick<WorkItemsStorage, 'list' | 'ensureReady'>;
  projects: FactoryProjectsStorage;
  boards: LiveBoardRegistry;
}

function loose(context: unknown): Context {
  return context as Context;
}

function toWire(record: FactoryBoardRecord) {
  return {
    id: record.boardId,
    title: record.title,
    initialPhase: record.definition.initialPhase,
    phases: record.definition.phases,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/**
 * Boards a Factory builds for itself, next to the code-defined ones. The board catalog
 * (`GET /web/factory/projects/:id/boards`) lists them, flagged `custom`.
 *   - `POST   /web/factory/projects/:id/boards`           — create a board
 *   - `PUT    /web/factory/projects/:id/boards/:boardId`  — replace its title and phases
 *   - `DELETE /web/factory/projects/:id/boards/:boardId`  — delete an empty board and its phase kickoffs
 */
export class BoardRoutes extends Route<BoardRoutesDeps> {
  async #resolveProject(
    context: Context,
  ): Promise<{ orgId: string; factoryProjectId: string } | { response: Response }> {
    await this.deps.auth.ensureUser(context);
    const tenant = this.deps.auth.tenant(context);
    if (!tenant) return { response: context.json({ error: 'unauthorized' }, 401) };
    if (!tenant.orgId) return { response: context.json({ error: 'organization_required' }, 403) };
    const factoryProjectId = context.req.param('id');
    await this.deps.projects.ensureReady();
    const project = factoryProjectId
      ? await this.deps.projects.get({ orgId: tenant.orgId, id: factoryProjectId })
      : null;
    if (!project) return { response: context.json({ error: 'factory_project_not_found' }, 404) };
    return { orgId: tenant.orgId, factoryProjectId: project.id };
  }

  async #parse(context: Context) {
    const body: unknown = await context.req.json().catch(() => undefined);
    try {
      return parseStoredBoard(body);
    } catch (error) {
      if (error instanceof BoardDefinitionError) {
        return { response: context.json({ error: 'invalid_board', message: error.message }, 400) };
      }
      throw error;
    }
  }

  async #cardsOn(project: { orgId: string; factoryProjectId: string }, boardId: string): Promise<WorkItemRow[]> {
    await this.deps.workItems.ensureReady();
    return (await this.deps.workItems.list(project)).filter(item => boardForWorkItem(item) === boardId);
  }

  routes(): ApiRoute[] {
    const listPath = '/web/factory/projects/:id/boards';
    const boardPath = '/web/factory/projects/:id/boards/:boardId';
    return [
      registerApiRoute(listPath, {
        method: 'POST',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const project = await this.#resolveProject(context);
          if ('response' in project) return project.response;
          const parsed = await this.#parse(context);
          if ('response' in parsed) return parsed.response;
          const boardId = newStoredBoardId();
          const record = await this.deps.storedBoards.create({ ...project, boardId, ...parsed });
          this.deps.boards.install(buildStoredBoard(record), project.factoryProjectId);
          return context.json({ board: toWire(record) }, 201);
        },
      }),
      registerApiRoute(boardPath, {
        method: 'PUT',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const project = await this.#resolveProject(context);
          if ('response' in project) return project.response;
          const boardId = context.req.param('boardId') ?? '';
          const existing = await this.deps.storedBoards.get({ ...project, boardId });
          if (!existing) return context.json({ error: 'board_not_found' }, 404);
          const parsed = await this.#parse(context);
          if ('response' in parsed) return parsed.response;
          const kept = new Set(parsed.definition.phases.map(phase => phase.id));
          const stranded = (await this.#cardsOn(project, boardId)).filter(item =>
            item.stages.some(stage => !kept.has(stage)),
          );
          if (stranded.length > 0) {
            return context.json(
              {
                error: 'phase_in_use',
                message: `${stranded.length} card(s) are in a phase this edit removes. Move them first.`,
              },
              409,
            );
          }
          const record = await this.deps.storedBoards.update({ ...project, boardId, ...parsed });
          if (!record) return context.json({ error: 'board_not_found' }, 404);
          this.deps.boards.install(buildStoredBoard(record), project.factoryProjectId);
          return context.json({ board: toWire(record) });
        },
      }),
      registerApiRoute(boardPath, {
        method: 'DELETE',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const project = await this.#resolveProject(context);
          if ('response' in project) return project.response;
          const boardId = context.req.param('boardId') ?? '';
          const existing = await this.deps.storedBoards.get({ ...project, boardId });
          if (!existing) return context.json({ error: 'board_not_found' }, 404);
          const cards = await this.#cardsOn(project, boardId);
          if (cards.length > 0) {
            return context.json(
              { error: 'board_not_empty', message: `${cards.length} card(s) are still on this board.` },
              409,
            );
          }
          await this.deps.storedBoards.delete({ ...project, boardId });
          await this.deps.phaseSkills.clearBoard({ ...project, boardId });
          this.deps.boards.uninstall(boardId);
          return context.body(null, 204);
        },
      }),
    ];
  }
}
