/**
 * Writes to a project's stored boards, shared by the boards API and `MastraFactory#upsertBoard()`.
 *
 * Every write is checked against the rules `defineBoard()` enforces, the skills its runners name,
 * the code behaviour of a code board's copy, and the cards sitting on the board. It then
 * invalidates the project's board cache and records an audit event.
 */

import type { z } from 'zod';

import { findBoardSkillProblems } from '../skills/app-skills.js';
import type { EmitAuditInput } from '../storage/domains/audit/domain.js';
import { StoredBoardError } from '../storage/domains/boards/base.js';
import type {
  StoredBoardInput,
  StoredBoardRecord,
  StoredBoardScope,
  StoredBoardsStorage,
  StoredPhaseInput,
} from '../storage/domains/boards/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { LEGACY_REVIEW_BOARD } from '../storage/domains/work-items/legacy-review.js';
import { codeBoardOf } from './define-board.js';
import type { ProjectBoardCache } from './project-boards.js';
import { createBoardRegistry } from './registry.js';
import { boardForWorkItem } from './semantics.js';
import {
  codeBehaviourConflicts,
  compileStoredBoard,
  sameBoardDefinition,
  storedBoardInputSchema,
} from './stored-board.js';
import { workBoard } from './work.js';

export interface BoardWritesDeps {
  storage: StoredBoardsStorage;
  /** The per-project boards: the code boards and their seeds, skills, and the cache to invalidate. */
  boards: Pick<ProjectBoardCache, 'describe' | 'invalidate' | 'codeRegistry' | 'codeSkills' | 'seedFor'>;
  /** Read to refuse edits that would strand cards. */
  workItems: Pick<WorkItemsStorage, 'list'>;
}

/** Who writes: stored as the board's author, and the audit event's actor. */
export interface BoardWriter {
  id: string;
  audit(input: EmitAuditInput): Promise<void>;
}

/** A refused board write. `status` and `body` are what the boards API answers with. */
export class BoardWriteError extends Error {
  override name = 'BoardWriteError';
  constructor(
    readonly status: 404 | 409 | 422,
    readonly body: { error: string; message?: string } & Record<string, unknown>,
  ) {
    super(body.message ?? body.error);
  }

  get code(): string {
    return this.body.error;
  }
}

export function issueMessage(issues: readonly z.core.$ZodIssue[]): string {
  return issues
    .map(issue => (issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
    .join('; ');
}

const UNKNOWN_SKILL = 'but no such skill exists';
const UPSERT_ATTEMPTS = 3;

/** Storage refusals (a stale revision, a missing or existing board) as board write errors. */
async function stored<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (error instanceof StoredBoardError) {
      throw new BoardWriteError(error.code === 'board_not_found' ? 404 : 409, {
        error: error.code,
        message: error.message,
      });
    }
    throw error;
  }
}

/** Cards stored on the retired Review board read as Work, so a board under its key would lose them. */
function refuseReservedBoard(key: string): void {
  if (key !== LEGACY_REVIEW_BOARD) return;
  throw new BoardWriteError(409, {
    error: 'reserved_board',
    message: `Board "${key}" is reserved: the retired Review board's cards now live on Work.`,
  });
}

export class BoardWrites {
  constructor(private readonly deps: BoardWritesDeps) {}

  /**
   * Code boards can't be created over, and Work can't be deleted while its code handlers run by its
   * key; the retired Review board's key can't be used at all.
   */
  refuseCodeBoard(key: string, action: 'create' | 'edit' | 'delete'): void {
    refuseReservedBoard(key);
    const { boards } = this.deps;
    const code = boards.codeRegistry.get(key);
    if (!code) return;
    const stored = boards.seedFor(key) !== undefined;
    if (action === 'edit' && stored) return;
    if (action === 'delete' && stored && codeBoardOf(code) !== workBoard) return;
    throw new BoardWriteError(409, {
      error: 'code_board',
      message:
        action === 'delete' && stored
          ? `Board "${key}" is defined in code and can't be deleted; reset it to its default instead.`
          : `Board "${key}" is defined in code and can't be ${action === 'create' ? 'created over' : 'changed'} here.`,
    });
  }

  async existing(scope: StoredBoardScope, key: string): Promise<StoredBoardRecord> {
    const row = await this.deps.storage.get(scope, key);
    if (!row) throw new BoardWriteError(404, { error: 'board_not_found', message: `Board "${key}" does not exist.` });
    return row;
  }

  /**
   * Validates a definition the way `defineBoard()` does, plus the skills its runners name. A code
   * board's copy is also checked against the code behaviour of its board and phase keys.
   */
  validate(input: unknown): StoredBoardInput {
    const { boards } = this.deps;
    const parsed = storedBoardInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new BoardWriteError(422, { error: 'invalid_board', message: issueMessage(parsed.error.issues) });
    }
    refuseReservedBoard(parsed.data.key);
    const code = boards.seedFor(parsed.data.key) && boards.codeRegistry.get(parsed.data.key);
    if (code) {
      const conflicts = codeBehaviourConflicts(parsed.data, code);
      if (conflicts.length > 0) {
        throw new BoardWriteError(422, { error: 'code_behaviour', message: conflicts.join(' '), conflicts });
      }
    }
    const board = code ? compileStoredBoard(parsed.data, code) : compileStoredBoard(parsed.data);
    const problems = findBoardSkillProblems(
      createBoardRegistry({ boards: [board], includeDefaultBoards: false }),
      boards.codeSkills,
    );
    const unknown = problems.filter(problem => problem.includes(UNKNOWN_SKILL));
    if (unknown.length > 0) throw new BoardWriteError(422, { error: 'unknown_skill', message: unknown.join(' ') });
    return parsed.data;
  }

  /** Creates a board under a key no code board uses. */
  async create(scope: StoredBoardScope, input: unknown, writer: BoardWriter): Promise<StoredBoardRecord> {
    const key = (input as { key?: unknown } | null)?.key;
    if (typeof key === 'string') this.refuseCodeBoard(key, 'create');
    const board = this.validate(input);
    const row = await stored(() => this.deps.storage.create(scope, board, writer.id));
    this.deps.boards.invalidate(scope);
    await this.#audit(scope, writer, 'created', board);
    return row;
  }

  /**
   * Stores a validated board in a project, after its first load stored Factory's boards: creates
   * it when the project has none under its key, and otherwise replaces the project's board, edited
   * or not, at its current revision, with the same checks as an edit. A write that loses a race
   * with another one rereads and tries again.
   */
  async upsert(
    scope: StoredBoardScope,
    board: StoredBoardInput,
    writer: BoardWriter,
  ): Promise<'inserted' | 'updated' | 'unchanged'> {
    refuseReservedBoard(board.key);
    const { storage, boards } = this.deps;
    await boards.describe(scope);
    for (let attempt = 1; ; attempt++) {
      const row = await storage.get(scope, board.key);
      try {
        if (!row) {
          if (!(await storage.insertIfMissing(scope, board, writer.id))) {
            throw new BoardWriteError(409, {
              error: 'revision_mismatch',
              message: `Board "${board.key}" was stored by another write; try again.`,
            });
          }
          boards.invalidate(scope);
          await this.#audit(scope, writer, 'created', board);
          return 'inserted';
        }
        const { key, ...definition } = board;
        const { written } = await this.replace(scope, key, definition, { expectedRevision: row.revision, writer });
        return written ? 'updated' : 'unchanged';
      } catch (error) {
        const lost =
          error instanceof BoardWriteError && (error.code === 'revision_mismatch' || error.code === 'board_not_found');
        if (!lost || attempt >= UPSERT_ATTEMPTS) throw error;
      }
    }
  }

  /**
   * Replaces a board's definition at `expectedRevision`. Saving it unchanged writes nothing;
   * `written` says whether anything was stored.
   */
  async replace(
    scope: StoredBoardScope,
    key: string,
    definition: Omit<StoredBoardInput, 'key'>,
    { expectedRevision, writer }: { expectedRevision: number; writer: BoardWriter },
  ): Promise<{ row: StoredBoardRecord; written: boolean }> {
    const { storage, boards } = this.deps;
    this.refuseCodeBoard(key, 'edit');
    const seed = boards.seedFor(key);
    // The project's first load stores Factory's boards.
    if (seed) await boards.describe(scope);
    const row = await this.existing(scope, key);
    const input = this.validate({ key, ...definition });
    if (row.revision === expectedRevision && sameBoardDefinition(row, input)) {
      return { row, written: false };
    }
    await this.#checkPhasesFree(scope, row, input.phases);
    const { key: _key, ...replacement } = input;
    const replaced = await stored(() =>
      storage.replace(scope, key, replacement, { expectedRevision, actor: writer.id }),
    );
    boards.invalidate(scope);
    await this.#audit(scope, writer, 'updated', input);
    return { row: replaced, written: true };
  }

  /** Deletes a stored board that no card sits on. */
  async remove(
    scope: StoredBoardScope,
    key: string,
    { expectedRevision, writer }: { expectedRevision: number; writer: BoardWriter },
  ): Promise<void> {
    this.refuseCodeBoard(key, 'delete');
    // The project's first load stores Factory's boards.
    if (this.deps.boards.seedFor(key)) await this.deps.boards.describe(scope);
    const row = await this.existing(scope, key);
    const { cards } = await this.#occupancy(scope, key);
    if (cards > 0) {
      throw new BoardWriteError(409, {
        error: 'board_in_use',
        message: `Board "${key}" still has cards; move or delete them first.`,
        cards,
      });
    }
    await stored(() => this.deps.storage.delete(scope, key, { expectedRevision }));
    this.deps.boards.invalidate(scope);
    await this.#audit(scope, writer, 'deleted', row);
  }

  /** Rewrites a board Factory stores to Factory's current definition of it, at the next revision. */
  async reset(
    scope: StoredBoardScope,
    key: string,
    { expectedRevision, writer }: { expectedRevision: number; writer: BoardWriter },
  ): Promise<StoredBoardRecord> {
    const { storage, boards } = this.deps;
    const seed = boards.seedFor(key);
    if (!seed) {
      this.refuseCodeBoard(key, 'edit');
      await this.existing(scope, key);
      throw new BoardWriteError(409, {
        error: 'not_code_board',
        message: `Board "${key}" was created in this project and has no default to reset to.`,
      });
    }
    await boards.describe(scope);
    const row = await this.existing(scope, key);
    await this.#checkPhasesFree(scope, row, seed.phases);
    const reset = await stored(() => storage.resetTo(scope, key, seed, { expectedRevision, actor: writer.id }));
    boards.invalidate(scope);
    await this.#audit(scope, writer, 'reset', row);
    return reset;
  }

  /** The cards on a board, and how many sit in each phase. */
  async #occupancy(scope: StoredBoardScope, key: string): Promise<{ cards: number; phases: Map<string, number> }> {
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
  async #checkPhasesFree(
    scope: StoredBoardScope,
    row: StoredBoardRecord,
    next: readonly StoredPhaseInput[],
  ): Promise<void> {
    const kinds = new Map(next.map(phase => [phase.key, phase.kind]));
    const changed = row.phases.filter(phase => kinds.get(phase.key) !== phase.kind).map(phase => phase.key);
    if (changed.length === 0) return;
    const occupancy = (await this.#occupancy(scope, row.key)).phases;
    const inUse = Object.fromEntries(changed.flatMap(key => (occupancy.get(key) ? [[key, occupancy.get(key)!]] : [])));
    if (Object.keys(inUse).length === 0) return;
    throw new BoardWriteError(409, {
      error: 'phase_in_use',
      message: `Cards sit in ${Object.entries(inUse)
        .map(([key, count]) => `"${key}" (${count})`)
        .join(', ')}; move them before removing those phases or changing their kind.`,
      phases: inUse,
    });
  }

  async #audit(
    scope: StoredBoardScope,
    writer: BoardWriter,
    action: 'created' | 'updated' | 'deleted' | 'reset',
    board: { key: string; name: string },
  ): Promise<void> {
    await writer.audit({
      action: `factory.board.${action}`,
      factoryProjectId: scope.factoryProjectId,
      targets: [{ type: 'board', id: board.key, name: board.name }],
    });
  }
}
