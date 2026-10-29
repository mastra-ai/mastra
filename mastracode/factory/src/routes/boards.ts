/**
 * Mastra `apiRoutes` for managing a project's stored boards.
 *
 * Reads need project membership; writes need an organization admin in tenant mode. Every write
 * is checked against the rules `defineBoard()` enforces, the code behaviors the board carries,
 * and the cards sitting on it, then invalidates the project's board cache.
 */

import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';
import type { z } from 'zod';

import { BoardDefinitionError } from '../boards/define-board.js';
import type { ProjectBoardCache } from '../boards/project-boards.js';
import { createBoardRegistry } from '../boards/registry.js';
import type { InstalledBoard } from '../boards/registry.js';
import { boardForWorkItem } from '../boards/semantics.js';
import { compileStoredBoard, storedBoardInputSchema } from '../boards/stored-board.js';
import { findBoardSkillProblems } from '../skills/app-skills.js';
import type { AuditEmitter } from '../storage/domains/audit/domain.js';
import { StoredBoardError } from '../storage/domains/boards/base.js';
import type {
  StoredBoardInput,
  StoredBoardRecord,
  StoredBoardScope,
  StoredBoardsStorage,
  StoredPhaseInput,
} from '../storage/domains/boards/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { FACTORY_ROUTE_CONTRACTS } from './contracts.js';
import type { RouteDependencies } from './route.js';
import { Route } from './route.js';

export interface BoardRoutesDeps extends RouteDependencies {
  audit: AuditEmitter;
  projects: FactoryProjectsStorage;
  /** Read to refuse edits that would strand cards. */
  workItems: Pick<WorkItemsStorage, 'list'>;
  storage: StoredBoardsStorage;
  /** The per-project boards: code seeds and behaviors, skills, and the cache to invalidate. */
  boards: Pick<ProjectBoardCache, 'describe' | 'invalidate' | 'seedFor' | 'codeSkills'>;
}

type Resolved = StoredBoardScope & { userId: string };

/** A response the handler returns as is: a refusal or an error. */
class Refusal {
  constructor(
    readonly status: 400 | 403 | 404 | 409 | 422,
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

const UNKNOWN_SKILL = 'but no such skill exists';

export class BoardRoutes extends Route<BoardRoutesDeps> {
  async #resolve(c: Context): Promise<Resolved> {
    const { auth, projects } = this.deps;
    await auth.ensureUser(c);
    const tenant = auth.tenant(c);
    if (!tenant) throw new Refusal(403, { error: 'unauthorized' });
    if (!tenant.orgId) {
      throw new Refusal(403, { error: 'organization_required', message: 'Boards belong to an organization.' });
    }
    const parsed = FACTORY_ROUTE_CONTRACTS.boardCatalog.pathSchema.safeParse({ id: c.req.param('id') });
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
        message: 'Organization administrator access is required to change boards.',
      });
    }
  }

  async #body(c: Context): Promise<unknown> {
    try {
      return await c.req.json();
    } catch {
      throw new Refusal(400, { error: 'invalid_request', message: 'Invalid JSON body.' });
    }
  }

  #boardKey(c: Context): string {
    const parsed = FACTORY_ROUTE_CONTRACTS.boardGet.pathSchema.safeParse({
      id: c.req.param('id'),
      boardKey: c.req.param('boardKey'),
    });
    if (!parsed.success) throw new Refusal(404, { error: 'board_not_found' });
    return parsed.data.boardKey;
  }

  async #existing(scope: Resolved, key: string, options: { includeDeleted?: boolean } = {}) {
    // Loading the project first writes its code boards, so a board that exists in code exists here.
    await this.deps.boards.describe(scope);
    const row = await this.deps.storage.get(scope, key, options);
    if (!row) throw new Refusal(404, { error: 'board_not_found', message: `Board "${key}" does not exist.` });
    return row;
  }

  /** Validates a definition the way `defineBoard()` does, plus the skills its runners name. */
  #validate(input: unknown): { input: StoredBoardInput; warnings: string[] } {
    const parsed = storedBoardInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new Refusal(422, { error: 'invalid_board', message: issueMessage(parsed.error.issues) });
    }
    const board = compileStoredBoard(parsed.data);
    const problems = findBoardSkillProblems(
      createBoardRegistry({ boards: [board], includeDefaultBoards: false }),
      this.deps.boards.codeSkills,
    );
    const unknown = problems.filter(problem => problem.includes(UNKNOWN_SKILL));
    if (unknown.length > 0) throw new Refusal(422, { error: 'unknown_skill', message: unknown.join(' ') });
    return { input: parsed.data, warnings: problems };
  }

  /** Compiles with the code behaviors the board carries, so an edit that breaks them is refused. */
  #compileWithBehaviors(input: StoredBoardInput, row: StoredBoardRecord | undefined): InstalledBoard {
    const behaviors = row?.seedHash ? this.deps.boards.seedFor(input.key)?.behaviors : undefined;
    try {
      return compileStoredBoard(input, behaviors);
    } catch (error) {
      if (!(error instanceof BoardDefinitionError)) throw error;
      throw new Refusal(422, {
        error: 'invalid_board',
        message: `${error.message} The board's code behaviors depend on it.`,
      });
    }
  }

  /** The cards on a board, and how many sit in each phase. */
  async #occupancy(scope: Resolved, key: string): Promise<{ cards: number; phases: Map<string, number> }> {
    const phases = new Map<string, number>();
    let cards = 0;
    for (const item of await this.deps.workItems.list(scope)) {
      if (boardForWorkItem(item) !== key) continue;
      cards++;
      for (const stage of new Set(item.stages)) phases.set(stage, (phases.get(stage) ?? 0) + 1);
    }
    return { cards, phases };
  }

  /** Refuses a change that removes, or changes the kind of, a phase cards sit in. */
  async #checkPhasesFree(scope: Resolved, row: StoredBoardRecord, next: readonly StoredPhaseInput[]): Promise<void> {
    if (row.deletedAt) return;
    const kinds = new Map(next.map(phase => [phase.key, phase.kind]));
    const changed = row.phases.filter(phase => kinds.get(phase.key) !== phase.kind).map(phase => phase.key);
    if (changed.length === 0) return;
    const occupancy = (await this.#occupancy(scope, row.key)).phases;
    const inUse = Object.fromEntries(changed.flatMap(key => (occupancy.get(key) ? [[key, occupancy.get(key)!]] : [])));
    if (Object.keys(inUse).length === 0) return;
    throw new Refusal(409, {
      error: 'phase_in_use',
      message: `Cards sit in ${Object.entries(inUse)
        .map(([key, count]) => `"${key}" (${count})`)
        .join(', ')}; move them before removing those phases or changing their kind.`,
      phases: inUse,
    });
  }

  async #respond(c: Context, scope: Resolved, key: string, status: 200 | 201 = 200) {
    const project = await this.deps.boards.describe(scope);
    const row = await this.deps.storage.get(scope, key, { includeDeleted: true });
    if (!row) return c.json({ error: 'board_not_found' }, 404);
    return c.json(
      {
        board: {
          key: row.key,
          name: row.name,
          description: row.description,
          phases: row.phases.map(({ position: _position, ...phase }) => phase),
          revision: row.revision,
          source: row.seedSource ?? 'stored',
          customized: row.customized,
          drift: row.driftHash !== null,
          deleted: row.deletedAt !== null,
          problems: project.details.get(key)?.problems ?? [],
        },
      },
      status,
    );
  }

  async #audit(
    c: Context,
    scope: Resolved,
    action: 'created' | 'updated' | 'reset' | 'deleted',
    board: { key: string; name: string },
  ) {
    await this.deps.audit.emit({
      context: c,
      input: {
        action: `factory.board.${action}`,
        factoryProjectId: scope.factoryProjectId,
        targets: [{ type: 'board', id: board.key, name: board.name }],
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
              error.code === 'board_not_found' ? 404 : 409,
            );
          }
          throw error;
        }
      },
    });
  }

  routes(): ApiRoute[] {
    const { storage, boards } = this.deps;
    const contracts = FACTORY_ROUTE_CONTRACTS;
    return [
      this.#route(contracts.boardGet, async c => {
        const scope = await this.#resolve(c);
        const key = this.#boardKey(c);
        await this.#existing(scope, key, { includeDeleted: true });
        return this.#respond(c, scope, key);
      }),

      this.#route(contracts.boardCreate, async c => {
        const scope = await this.#resolve(c);
        await this.#requireAdmin(c, scope);
        const { input } = this.#validate(await this.#body(c));
        await boards.describe(scope);
        await storage.create(scope, input, scope.userId);
        boards.invalidate(scope);
        await this.#audit(c, scope, 'created', input);
        return this.#respond(c, scope, input.key, 201);
      }),

      this.#route(contracts.boardReplace, async c => {
        const scope = await this.#resolve(c);
        const key = this.#boardKey(c);
        await this.#requireAdmin(c, scope);
        const parsed = contracts.boardReplace.bodySchema.safeParse(await this.#body(c));
        if (!parsed.success) {
          throw new Refusal(422, { error: 'invalid_board', message: issueMessage(parsed.error.issues) });
        }
        const { expectedRevision, ...definition } = parsed.data;
        const row = await this.#existing(scope, key);
        const { input } = this.#validate({ key, ...definition });
        if (row.seedSource && input.phases[0]!.key !== row.phases[0]?.key) {
          throw new Refusal(422, {
            error: 'initial_phase_locked',
            message: `Board "${key}" is defined in code, which places new cards in "${row.phases[0]?.key}"; that phase must stay first.`,
          });
        }
        this.#compileWithBehaviors(input, row);
        await this.#checkPhasesFree(scope, row, input.phases);
        const { key: _key, ...replacement } = input;
        await storage.replace(scope, key, replacement, {
          expectedRevision,
          actor: scope.userId,
          ...(row.seedSource ? { customized: true } : {}),
        });
        boards.invalidate(scope);
        await this.#audit(c, scope, 'updated', input);
        return this.#respond(c, scope, key);
      }),

      this.#route(contracts.boardReset, async c => {
        const scope = await this.#resolve(c);
        const key = this.#boardKey(c);
        await this.#requireAdmin(c, scope);
        const parsed = contracts.boardReset.bodySchema.safeParse(await this.#body(c));
        if (!parsed.success) {
          throw new Refusal(422, { error: 'invalid_request', message: issueMessage(parsed.error.issues) });
        }
        const row = await this.#existing(scope, key, { includeDeleted: true });
        const seed = boards.seedFor(key);
        if (!seed) {
          throw new Refusal(409, {
            error: 'not_seeded',
            message: `Board "${key}" has no code definition to reset to.`,
          });
        }
        await this.#checkPhasesFree(scope, row, seed.input.phases);
        await storage.reset(scope, key, seed, { expectedRevision: parsed.data.expectedRevision, actor: scope.userId });
        boards.invalidate(scope);
        await this.#audit(c, scope, 'reset', seed.input);
        return this.#respond(c, scope, key);
      }),

      this.#route(contracts.boardDelete, async c => {
        const scope = await this.#resolve(c);
        const key = this.#boardKey(c);
        await this.#requireAdmin(c, scope);
        const parsed = contracts.boardDelete.querySchema.safeParse({
          expectedRevision: c.req.query('expectedRevision'),
        });
        if (!parsed.success) {
          throw new Refusal(422, { error: 'invalid_request', message: issueMessage(parsed.error.issues) });
        }
        const row = await this.#existing(scope, key);
        if (row.seedSource === 'builtin') {
          throw new Refusal(409, {
            error: 'builtin_board',
            message: `Board "${key}" is built into Factory and cannot be deleted; edit it instead.`,
          });
        }
        const { cards } = await this.#occupancy(scope, key);
        if (cards > 0) {
          throw new Refusal(409, {
            error: 'board_in_use',
            message: `Board "${key}" still has cards; move or delete them first.`,
            cards,
          });
        }
        const options = { expectedRevision: parsed.data.expectedRevision, actor: scope.userId };
        // A board seeded from code keeps a tombstone, so the next boot does not write it back.
        if (row.seedSource) await storage.softDelete(scope, key, options);
        else await storage.delete(scope, key, options);
        boards.invalidate(scope);
        await this.#audit(c, scope, 'deleted', row);
        return c.body(null, 204);
      }),
    ];
  }
}
