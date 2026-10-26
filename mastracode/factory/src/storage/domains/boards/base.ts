import { randomUUID } from 'node:crypto';
import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import { defaultProjectBoardConfig } from '../../../boards/templates/work.js';
import type { RuleGroup } from '../../../rules/rule-group.js';
import {
  BOARD_DEFINITION_COLLECTIONS,
  FACTORY_BOARD_EVENT_ROUTES_SCHEMA,
  FACTORY_BOARD_PHASES_SCHEMA,
  FACTORY_BOARD_SETS_SCHEMA,
  FACTORY_BOARDS_SCHEMA,
  FACTORY_INTAKE_ROUTES_SCHEMA,
} from './schemas.js';
import { projectBoardConfigInputSchema } from './validation.js';
import type { BoardEvent, ProjectBoardConfigInput, StoredPhaseKind, StoredPhaseRunner } from './validation.js';

export interface BoardScope {
  orgId: string;
  factoryProjectId: string;
}

export interface StoredPhase {
  key: string;
  name: string;
  description: string | null;
  kind: StoredPhaseKind;
  runner: StoredPhaseRunner | null;
  /** `null` means a card may move to any phase on the board. */
  nextPhases: string[] | null;
  /** A successful call of this tool while the card is here moves it to the next phase in board order. */
  exitTool: string | null;
  /** When it matches the card, the exit tool's approval is given without a person. */
  autoApproveWhen: RuleGroup | null;
}

export interface StoredEventRoute {
  event: BoardEvent;
  fromPhases: string[] | null;
  when: RuleGroup | null;
  toPhaseKey: string;
  enabled: boolean;
}

export interface StoredBoard {
  /** Stable across edits. */
  id: string;
  key: string;
  name: string;
  description: string | null;
  phases: StoredPhase[];
  eventRoutes: StoredEventRoute[];
}

export interface StoredIntakeRoute {
  when: RuleGroup | null;
  boardKey: string;
  phaseKey: string | null;
  enabled: boolean;
}

export interface ProjectBoardConfig {
  /** Increases on every committed write; `0` when the project has never been written. */
  revision: number;
  boards: StoredBoard[];
  intakeRoutes: StoredIntakeRoute[];
  updatedBy: string | null;
  updatedAt: Date | null;
}

/** Another write committed first. Re-read and retry with the new revision. */
export class BoardRevisionConflictError extends Error {
  constructor(
    readonly expectedRevision: number,
    readonly actualRevision: number,
  ) {
    super(`Boards changed (revision ${actualRevision}, expected ${expectedRevision}). Reload and try again.`);
    this.name = 'BoardRevisionConflictError';
  }
}

/** An intake route names a board that is neither stored nor installed in code. */
export class UnknownBoardError extends Error {
  constructor(readonly boardKey: string) {
    super(`Board '${boardKey}' does not exist.`);
    this.name = 'UnknownBoardError';
  }
}

interface SetRow extends Record<string, unknown> {
  id: string;
  revision: number;
  updated_by: string;
  updated_at: Date;
}

interface BoardRow extends Record<string, unknown> {
  id: string;
  board_id: string;
  key: string;
  name: string;
  description: string | null;
  position: number;
}

interface PhaseRow extends Record<string, unknown> {
  board_key: string;
  key: string;
  name: string;
  description: string | null;
  position: number;
  kind: StoredPhaseKind;
  runner: StoredPhaseRunner | null;
  next_phases: string[] | null;
  exit_tool?: string | null;
  auto_approve_when?: RuleGroup | null;
}

interface IntakeRouteRow extends Record<string, unknown> {
  position: number;
  condition: RuleGroup | null;
  board_key: string;
  phase_key: string | null;
  enabled: boolean;
}

interface EventRouteRow extends Record<string, unknown> {
  board_key: string;
  position: number;
  event: BoardEvent;
  from_phases: string[] | null;
  condition: RuleGroup | null;
  to_phase_key: string;
  enabled: boolean;
}

const SETS = FACTORY_BOARD_SETS_SCHEMA.name;
const BOARDS = FACTORY_BOARDS_SCHEMA.name;
const PHASES = FACTORY_BOARD_PHASES_SCHEMA.name;
const INTAKE = FACTORY_INTAKE_ROUTES_SCHEMA.name;
const EVENTS = FACTORY_BOARD_EVENT_ROUTES_SCHEMA.name;

const byPosition = (left: { position: number }, right: { position: number }) => left.position - right.position;
const where = (scope: BoardScope) => ({ org_id: scope.orgId, factory_project_id: scope.factoryProjectId });

/**
 * Boards, phases and routes a Factory project defines in its database. The
 * runtime compiles them per project (`boards/resolver.ts`); code-installed
 * boards (`config.boards`) live beside them.
 */
export class BoardsStorage extends FactoryStorageDomain {
  constructor() {
    super('boards');
  }

  async init(): Promise<void> {
    await this.ensureCollections([
      FACTORY_BOARD_SETS_SCHEMA,
      FACTORY_BOARDS_SCHEMA,
      FACTORY_BOARD_PHASES_SCHEMA,
      FACTORY_INTAKE_ROUTES_SCHEMA,
      FACTORY_BOARD_EVENT_ROUTES_SCHEMA,
    ]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany(SETS, {});
    for (const collection of BOARD_DEFINITION_COLLECTIONS) await this.ops.deleteMany(collection, {});
  }

  /** Live revision number, for cache checks. One indexed row read. */
  async getRevision(scope: BoardScope): Promise<number> {
    const set = await this.ops.findOne<SetRow>(SETS, where(scope));
    return set?.revision ?? 0;
  }

  /** The project's stored boards and routes, read as one consistent snapshot. */
  /**
   * Writes the default Work board and routes when the project has never saved
   * boards. Safe to race: the losing writer sees a revision conflict and
   * leaves the winner's rows alone. Returns whether this call wrote them.
   */
  async seedDefaults({
    config = defaultProjectBoardConfig,
    ...scope
  }: BoardScope & { userId: string; config?: ProjectBoardConfigInput }): Promise<boolean> {
    if ((await this.getRevision(scope)) !== 0) return false;
    try {
      await this.saveConfig({ ...scope, expectedRevision: 0, config });
      return true;
    } catch (error) {
      if (error instanceof BoardRevisionConflictError) return false;
      throw error;
    }
  }

  async getConfig(scope: BoardScope): Promise<ProjectBoardConfig> {
    return this.storage.withTransaction(
      async ops => {
        const set = await ops.findOne<SetRow>(SETS, where(scope));
        if (!set) return { revision: 0, boards: [], intakeRoutes: [], updatedBy: null, updatedAt: null };
        const boards = await ops.findMany<BoardRow>(BOARDS, where(scope));
        const phases = await ops.findMany<PhaseRow>(PHASES, where(scope));
        const intakeRoutes = await ops.findMany<IntakeRouteRow>(INTAKE, where(scope));
        const eventRoutes = await ops.findMany<EventRouteRow>(EVENTS, where(scope));
        return {
          revision: set.revision,
          updatedBy: set.updated_by,
          updatedAt: set.updated_at,
          boards: boards.sort(byPosition).map(board => ({
            id: board.board_id,
            key: board.key,
            name: board.name,
            description: board.description,
            phases: phases
              .filter(phase => phase.board_key === board.key)
              .sort(byPosition)
              .map(phase => ({
                key: phase.key,
                name: phase.name,
                description: phase.description,
                kind: phase.kind,
                runner: phase.runner,
                nextPhases: phase.next_phases,
                exitTool: phase.exit_tool ?? null,
                autoApproveWhen: phase.auto_approve_when ?? null,
              })),
            eventRoutes: eventRoutes
              .filter(route => route.board_key === board.key)
              .sort(byPosition)
              .map(route => ({
                event: route.event,
                fromPhases: route.from_phases,
                when: route.condition,
                toPhaseKey: route.to_phase_key,
                enabled: route.enabled,
              })),
          })),
          intakeRoutes: intakeRoutes.sort(byPosition).map(route => ({
            when: route.condition,
            boardKey: route.board_key,
            phaseKey: route.phase_key,
            enabled: route.enabled,
          })),
        };
      },
      // Read-committed Postgres would let a write land between the five reads.
      { isolationLevel: 'serializable' },
    );
  }

  async getBoard(scope: BoardScope & { key: string }): Promise<StoredBoard | null> {
    const config = await this.getConfig(scope);
    return config.boards.find(board => board.key === scope.key) ?? null;
  }

  async listBoards(scope: BoardScope): Promise<StoredBoard[]> {
    return (await this.getConfig(scope)).boards;
  }

  /**
   * Replace the project's whole board configuration as one new revision.
   * `expectedRevision` is the revision the caller read (`0` for a project with
   * nothing stored); a different live revision throws
   * {@link BoardRevisionConflictError} and writes nothing visible.
   * `externalBoardKeys` are boards installed in code that intake routes may name.
   */
  async saveConfig({
    orgId,
    factoryProjectId,
    userId,
    expectedRevision,
    config,
    externalBoardKeys = [],
  }: BoardScope & {
    userId: string;
    expectedRevision: number;
    config: ProjectBoardConfigInput;
    externalBoardKeys?: readonly string[];
  }): Promise<ProjectBoardConfig> {
    const scope = { orgId, factoryProjectId };
    const parsed = projectBoardConfigInputSchema.parse(config);
    const storedKeys = new Set(parsed.boards.map(board => board.key));
    for (const route of parsed.intakeRoutes) {
      if (!storedKeys.has(route.boardKey) && !externalBoardKeys.includes(route.boardKey)) {
        throw new UnknownBoardError(route.boardKey);
      }
    }

    const now = new Date();
    try {
      await this.storage.withTransaction(async ops => {
        const current = await ops.findOne<SetRow>(SETS, where(scope));
        const currentRevision = current?.revision ?? 0;
        if (currentRevision !== expectedRevision)
          throw new BoardRevisionConflictError(expectedRevision, currentRevision);
        const revision = { revision: currentRevision + 1, updated_by: userId, updated_at: now };
        if (current) {
          let actual = currentRevision;
          await ops.updateAtomic<SetRow>(SETS, where(scope), row => {
            actual = row.revision;
            return row.revision === currentRevision ? revision : null;
          });
          if (actual !== currentRevision) throw new BoardRevisionConflictError(expectedRevision, actual);
        } else {
          await ops.insertOne<SetRow>(SETS, { ...where(scope), ...revision });
        }

        const stableIds = new Map(
          (await ops.findMany<BoardRow>(BOARDS, where(scope))).map(row => [row.key, row.board_id] as const),
        );
        for (const collection of BOARD_DEFINITION_COLLECTIONS) await ops.deleteMany(collection, where(scope));

        for (const [boardIndex, board] of parsed.boards.entries()) {
          await ops.insertOne<BoardRow>(BOARDS, {
            ...where(scope),
            board_id: stableIds.get(board.key) ?? randomUUID(),
            key: board.key,
            name: board.name,
            description: board.description ?? null,
            position: boardIndex,
            created_by: userId,
            created_at: now,
          });
          for (const [position, phase] of board.phases.entries()) {
            await ops.insertOne<PhaseRow>(PHASES, {
              ...where(scope),
              board_key: board.key,
              key: phase.key,
              name: phase.name,
              description: phase.description ?? null,
              position,
              kind: phase.kind,
              runner: phase.runner ?? null,
              next_phases: phase.nextPhases ?? null,
              exit_tool: phase.exitTool ?? null,
              auto_approve_when: phase.autoApproveWhen ?? null,
            });
          }
          for (const [position, route] of (board.eventRoutes ?? []).entries()) {
            await ops.insertOne<EventRouteRow>(EVENTS, {
              ...where(scope),
              board_key: board.key,
              position,
              event: route.event,
              from_phases: route.fromPhases ?? null,
              condition: route.when ?? null,
              to_phase_key: route.toPhaseKey,
              enabled: route.enabled ?? true,
            });
          }
        }
        for (const [position, route] of parsed.intakeRoutes.entries()) {
          await ops.insertOne<IntakeRouteRow>(INTAKE, {
            ...where(scope),
            position,
            condition: route.when ?? null,
            board_key: route.boardKey,
            phase_key: route.phaseKey ?? null,
            enabled: route.enabled ?? true,
          });
        }
      });
    } catch (error) {
      // Two first writes for a project race on the set row's unique index.
      if (error instanceof UniqueViolationError && error.collection === SETS) {
        throw new BoardRevisionConflictError(expectedRevision, await this.getRevision(scope));
      }
      throw error;
    }
    return this.getConfig(scope);
  }
}
