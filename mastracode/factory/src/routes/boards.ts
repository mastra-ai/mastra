/**
 * Mastra `apiRoutes` for managing a project's stored boards.
 *
 * Reads need project membership; writes need an organization admin in tenant mode. Built-in and
 * app boards are defined in code and read-only here. Every write to a stored board is checked
 * against the rules `defineBoard()` enforces and the cards sitting on it, then invalidates the
 * project's board cache.
 */

import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';
import type { z } from 'zod';

import type { ProjectBoardCache } from '../boards/project-boards.js';
import { createBoardRegistry } from '../boards/registry.js';
import { boardForWorkItem } from '../boards/semantics.js';
import { boardDefinitionOf, compileStoredBoard, storedBoardInputSchema } from '../boards/stored-board.js';
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
  /** The per-project boards: the read-only code boards, skills, and the cache to invalidate. */
  boards: Pick<ProjectBoardCache, 'describe' | 'invalidate' | 'codeRegistry' | 'codeSkills'>;
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

  /** Built-in and app boards come from code; they can't be created over, edited or deleted here. */
  #refuseCodeBoard(key: string): void {
    if (!this.deps.boards.codeRegistry.has(key)) return;
    throw new Refusal(409, {
      error: 'code_board',
      message: `Board "${key}" is defined in code and can't be edited here.`,
    });
  }

  async #existing(scope: Resolved, key: string) {
    const row = await this.deps.storage.get(scope, key);
    if (!row) throw new Refusal(404, { error: 'board_not_found', message: `Board "${key}" does not exist.` });
    return row;
  }

  /** Validates a definition the way `defineBoard()` does, plus the skills its runners name. */
  #validate(input: unknown): StoredBoardInput {
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
    return parsed.data;
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
    const details = project.details.get(key);
    const code = this.deps.boards.codeRegistry.get(key);
    if (code) {
      const { description, ...definition } = boardDefinitionOf(code);
      return c.json(
        {
          board: {
            ...definition,
            description: description ?? null,
            revision: null,
            source: details?.source ?? 'app',
            editable: false,
            problems: details?.problems ?? [],
          },
        },
        status,
      );
    }
    const row = await this.deps.storage.get(scope, key);
    if (!row) return c.json({ error: 'board_not_found', message: `Board "${key}" does not exist.` }, 404);
    // A board that failed to load is missing from the details; its error is a project problem.
    const loadProblems = project.problems.filter(problem => problem.startsWith(`Board '${key}' could not be loaded:`));
    return c.json(
      {
        board: {
          key: row.key,
          name: row.name,
          description: row.description,
          phases: row.phases.map(({ position: _position, ...phase }) => phase),
          revision: row.revision,
          source: 'stored',
          editable: true,
          problems: [...(details?.problems ?? []), ...loadProblems],
        },
      },
      status,
    );
  }

  async #audit(
    c: Context,
    scope: Resolved,
    action: 'created' | 'updated' | 'deleted',
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
        return this.#respond(c, scope, this.#boardKey(c));
      }),

      this.#route(contracts.boardCreate, async c => {
        const scope = await this.#resolve(c);
        await this.#requireAdmin(c, scope);
        const input = this.#validate(await this.#body(c));
        this.#refuseCodeBoard(input.key);
        await storage.create(scope, input, scope.userId);
        boards.invalidate(scope);
        await this.#audit(c, scope, 'created', input);
        return this.#respond(c, scope, input.key, 201);
      }),

      this.#route(contracts.boardReplace, async c => {
        const scope = await this.#resolve(c);
        const key = this.#boardKey(c);
        await this.#requireAdmin(c, scope);
        this.#refuseCodeBoard(key);
        const parsed = contracts.boardReplace.bodySchema.safeParse(await this.#body(c));
        if (!parsed.success) {
          throw new Refusal(422, { error: 'invalid_board', message: issueMessage(parsed.error.issues) });
        }
        const { expectedRevision, ...definition } = parsed.data;
        const row = await this.#existing(scope, key);
        const input = this.#validate({ key, ...definition });
        await this.#checkPhasesFree(scope, row, input.phases);
        const { key: _key, ...replacement } = input;
        await storage.replace(scope, key, replacement, { expectedRevision, actor: scope.userId });
        boards.invalidate(scope);
        await this.#audit(c, scope, 'updated', input);
        return this.#respond(c, scope, key);
      }),

      this.#route(contracts.boardDelete, async c => {
        const scope = await this.#resolve(c);
        const key = this.#boardKey(c);
        await this.#requireAdmin(c, scope);
        this.#refuseCodeBoard(key);
        const parsed = contracts.boardDelete.querySchema.safeParse({
          expectedRevision: c.req.query('expectedRevision'),
        });
        if (!parsed.success) {
          throw new Refusal(422, { error: 'invalid_request', message: issueMessage(parsed.error.issues) });
        }
        const row = await this.#existing(scope, key);
        const { cards } = await this.#occupancy(scope, key);
        if (cards > 0) {
          throw new Refusal(409, {
            error: 'board_in_use',
            message: `Board "${key}" still has cards; move or delete them first.`,
            cards,
          });
        }
        await storage.delete(scope, key, { expectedRevision: parsed.data.expectedRevision });
        boards.invalidate(scope);
        await this.#audit(c, scope, 'deleted', row);
        return c.body(null, 204);
      }),
    ];
  }
}
