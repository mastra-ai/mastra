/**
 * Mastra `apiRoutes` for managing a project's stored boards.
 *
 * Reads need project membership; writes need an organization admin in tenant mode. Factory stores
 * the built-in Work board and app boards in each project once, and they are edited under their own
 * key; their code behaviour stays attached, so an edit it can't honour is refused
 * (`code_behaviour`), and reset rewrites Factory's current definition at the next revision. They
 * can't be created over, and Work can't be deleted. The retired Review board's key is reserved. The
 * writes themselves are `BoardWrites`.
 */

import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import { BoardWriteError, BoardWrites, issueMessage } from '../boards/board-writes.js';
import type { BoardWriter } from '../boards/board-writes.js';
import type { ProjectBoardCache } from '../boards/project-boards.js';
import { codeBehaviourOf } from '../boards/stored-board.js';
import type { AuditEmitter } from '../storage/domains/audit/domain.js';
import type { StoredBoardScope, StoredBoardsStorage } from '../storage/domains/boards/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { FACTORY_ROUTE_CONTRACTS } from './contracts.js';
import type { RouteDependencies } from './route.js';
import { loose, Route } from './route.js';

export interface BoardRoutesDeps extends RouteDependencies {
  audit: AuditEmitter;
  projects: FactoryProjectsStorage;
  /** Read to refuse edits that would strand cards. */
  workItems: Pick<WorkItemsStorage, 'list'>;
  storage: StoredBoardsStorage;
  /** The per-project boards: the code boards and their seeds, skills, and the cache to invalidate. */
  boards: Pick<ProjectBoardCache, 'describe' | 'invalidate' | 'codeRegistry' | 'codeSkills' | 'seedFor'>;
}

type Resolved = StoredBoardScope & { userId: string };

/** A response the handler returns as is: a refusal or an error. */
class Refusal {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 422,
    readonly body: Record<string, unknown>,
  ) {}
}

export class BoardRoutes extends Route<BoardRoutesDeps> {
  readonly #writes = new BoardWrites(this.deps);

  async #resolve(c: Context): Promise<Resolved> {
    const { auth, projects } = this.deps;
    await auth.ensureUser(c);
    const tenant = auth.tenant(c);
    if (!tenant) throw new Refusal(401, { error: 'unauthorized' });
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

  async #respond(c: Context, scope: Resolved, key: string, status: 200 | 201 = 200) {
    const { auth } = this.deps;
    const canEdit = !auth.enabled() || (await auth.isOrganizationAdmin(c, scope.orgId));
    const project = await this.deps.boards.describe(scope);
    const details = project.details.get(key);
    const code = this.deps.boards.codeRegistry.get(key);
    const row = await this.deps.storage.get(scope, key);
    if (!row) return c.json({ error: 'board_not_found', message: `Board "${key}" does not exist.` }, 404);
    // A board that failed to load, or a stored row its code board hides, is a project problem.
    const rowProblems = project.problems.filter(
      problem =>
        problem.startsWith(`Board '${key}' could not be loaded:`) || problem.startsWith(`Stored board "${key}" `),
    );
    return c.json(
      {
        board: {
          key: row.key,
          name: row.name,
          description: row.description,
          phases: row.phases.map(({ position: _position, ...phase }) => phase),
          revision: row.revision,
          source: details?.source ?? 'stored',
          editable: true,
          codeBehaviour: code ? codeBehaviourOf(code) : null,
          problems: [...(details?.problems ?? []), ...rowProblems.filter(p => !details?.problems.includes(p))],
        },
        canEdit,
      },
      status,
    );
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
          if (error instanceof BoardWriteError) return context.json(error.body, error.status);
          throw error;
        }
      },
    });
  }

  /** The request's user, as the board's author and the audit event's actor. */
  #writer(c: Context, scope: Resolved): BoardWriter {
    return { id: scope.userId, audit: input => this.deps.audit.emit({ context: c, input }) };
  }

  routes(): ApiRoute[] {
    const contracts = FACTORY_ROUTE_CONTRACTS;
    const writes = this.#writes;
    return [
      this.#route(contracts.boardGet, async c => {
        const scope = await this.#resolve(c);
        const key = this.#boardKey(c);
        return this.#respond(c, scope, key);
      }),

      this.#route(contracts.boardCreate, async c => {
        const scope = await this.#resolve(c);
        await this.#requireAdmin(c, scope);
        const row = await writes.create(scope, await this.#body(c), this.#writer(c, scope));
        return this.#respond(c, scope, row.key, 201);
      }),

      this.#route(contracts.boardReplace, async c => {
        const scope = await this.#resolve(c);
        const key = this.#boardKey(c);
        await this.#requireAdmin(c, scope);
        writes.refuseCodeBoard(key, 'edit');
        const parsed = contracts.boardReplace.bodySchema.safeParse(await this.#body(c));
        if (!parsed.success) {
          throw new Refusal(422, { error: 'invalid_board', message: issueMessage(parsed.error.issues) });
        }
        const { expectedRevision, ...definition } = parsed.data;
        await writes.replace(scope, key, definition, { expectedRevision, writer: this.#writer(c, scope) });
        return this.#respond(c, scope, key);
      }),

      this.#route(contracts.boardDelete, async c => {
        const scope = await this.#resolve(c);
        const key = this.#boardKey(c);
        await this.#requireAdmin(c, scope);
        writes.refuseCodeBoard(key, 'delete');
        const parsed = contracts.boardDelete.querySchema.safeParse({
          expectedRevision: c.req.query('expectedRevision'),
        });
        if (!parsed.success) {
          throw new Refusal(422, { error: 'invalid_request', message: issueMessage(parsed.error.issues) });
        }
        await writes.remove(scope, key, {
          expectedRevision: parsed.data.expectedRevision,
          writer: this.#writer(c, scope),
        });
        return c.body(null, 204);
      }),

      this.#route(contracts.boardReset, async c => {
        const scope = await this.#resolve(c);
        const key = this.#boardKey(c);
        await this.#requireAdmin(c, scope);
        const parsed = contracts.boardReset.bodySchema.safeParse(await this.#body(c));
        if (!parsed.success) {
          throw new Refusal(422, { error: 'invalid_request', message: issueMessage(parsed.error.issues) });
        }
        await writes.reset(scope, key, {
          expectedRevision: parsed.data.expectedRevision,
          writer: this.#writer(c, scope),
        });
        return this.#respond(c, scope, key);
      }),
    ];
  }
}
