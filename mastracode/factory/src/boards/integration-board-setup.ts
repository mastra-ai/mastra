import type {
  StoredBoardScope,
  StoredBoardsStorage,
  StoredIntakeRouteInput,
  StoredPhaseInput,
  StoredPhaseRecord,
} from '../storage/domains/boards/base.js';
import { BoardWriteError } from './board-writes.js';
import type { BoardWriter, BoardWrites } from './board-writes.js';
import type { ProjectBoardCache } from './project-boards.js';

/**
 * What an integration may add to a project's stored boards when the project starts using it: a
 * phase and the intake route into it. Both are ordinary stored entries afterwards, which the
 * project's admins edit, retarget or delete; neither call changes or removes anything already there.
 */
export interface IntegrationBoardSetup {
  /**
   * Adds `phase` to the board after the phase `after`, and to the moves of each `reachableFrom`
   * phase that lists its moves. Moves of `phase` to phases the board lacks are dropped. `present`
   * when the board has a phase under that key already; `no_board` when the project has no such
   * board or phase `after`.
   */
  addPhase(
    scope: StoredBoardScope,
    input: { boardKey: string; phase: StoredPhaseInput; after: string; reachableFrom: readonly string[] },
  ): Promise<'added' | 'present' | 'no_board'>;
  /**
   * Adds the route, ahead of the routes that take every new card, unless the project has a route
   * under its name; `present` either way. `no_phase` when its target phase isn't on the board.
   */
  addIntakeRoute(scope: StoredBoardScope, route: StoredIntakeRouteInput): Promise<'present' | 'no_phase'>;
}

const ATTEMPTS = 3;
const ACTOR = 'factory';

function toInput({ position: _position, ...phase }: StoredPhaseRecord): StoredPhaseInput {
  return phase;
}

export function createIntegrationBoardSetup(deps: {
  writes: Pick<BoardWrites, 'replace'>;
  /** Its first load stores the project's boards, so Factory's own are there to add to. */
  boards: Pick<ProjectBoardCache, 'describe'>;
  storage: Pick<StoredBoardsStorage, 'get' | 'listIntakeRoutes' | 'createIntakeRoute'>;
  audit: (scope: StoredBoardScope, entry: Parameters<BoardWriter['audit']>[0]) => Promise<void>;
}): IntegrationBoardSetup {
  return {
    async addPhase(scope, { boardKey, phase, after, reachableFrom }) {
      const writer: BoardWriter = { id: ACTOR, audit: entry => deps.audit(scope, entry) };
      await deps.boards.describe(scope);
      for (let attempt = 1; ; attempt++) {
        const row = await deps.storage.get(scope, boardKey);
        if (!row) return 'no_board';
        if (row.phases.some(existing => existing.key === phase.key)) return 'present';
        const index = row.phases.findIndex(existing => existing.key === after);
        if (index < 0) return 'no_board';
        const phases = row.phases.map(record => {
          const input = toInput(record);
          // Unset moves mean every other phase, the new one included.
          if (reachableFrom.includes(record.key) && input.nextPhases?.length) {
            input.nextPhases = [...input.nextPhases, phase.key];
          }
          return input;
        });
        const keys = new Set([...row.phases.map(existing => existing.key), phase.key]);
        // Only moves to phases this board has: older projects' boards differ from today's seed.
        phases.splice(index + 1, 0, {
          ...phase,
          ...(phase.nextPhases ? { nextPhases: phase.nextPhases.filter(key => keys.has(key)) } : {}),
        });
        try {
          await deps.writes.replace(
            scope,
            boardKey,
            { name: row.name, description: row.description, phases },
            { expectedRevision: row.revision, writer },
          );
          return 'added';
        } catch (error) {
          const lost = error instanceof BoardWriteError && error.code === 'revision_mismatch';
          if (!lost || attempt >= ATTEMPTS) throw error;
        }
      }
    },

    async addIntakeRoute(scope, route) {
      await deps.boards.describe(scope);
      const routes = await deps.storage.listIntakeRoutes(scope);
      if (routes.some(existing => existing.name === route.name)) return 'present';
      // Checked again under the routes' lock, so replicas setting up at once add it once.
      const board = await deps.storage.get(scope, route.target.boardKey);
      const phaseKey = route.target.phaseKey;
      if (!board || (phaseKey && !board.phases.some(phase => phase.key === phaseKey))) return 'no_phase';
      await deps.storage.createIntakeRoute(scope, route, ACTOR, { unlessNamed: true });
      return 'present';
    },
  };
}
