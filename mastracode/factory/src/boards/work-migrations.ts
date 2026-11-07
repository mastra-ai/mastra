import type {
  StoredBoardMigration,
  StoredBoardRecord,
  StoredPhaseInput,
  StoredPhaseRecord,
} from '../storage/domains/boards/base.js';
import { boardDefinitionOf } from './stored-board.js';
import { workBoard } from './work.js';

const MIGRATED_FIELDS = ['runner', 'exitTool', 'tools', 'autoStart', 'autoStartWhen', 'nextPhases'] as const;
type MigratedField = (typeof MIGRATED_FIELDS)[number];

const PHASE_DEFAULTS = { exitTool: [null], tools: [null], autoStart: [null], autoStartWhen: [null] } as const;

/**
 * What Factory stored for Work's working phases before they had runners: the seed of #29317, and
 * #29346's for the `nextPhases` it changed. Frozen: a value listed here is one a project can only
 * hold because Factory wrote it, so the migration may replace it.
 */
const OLD_WORK_SEED: Readonly<Record<string, Readonly<Record<MigratedField, readonly unknown[]>>>> = {
  triage: {
    ...PHASE_DEFAULTS,
    runner: [{ context: 'triage' }],
    nextPhases: [['intake', 'planning', 'done', 'canceled']],
  },
  planning: {
    ...PHASE_DEFAULTS,
    runner: [{ context: 'work' }],
    exitTool: [{ id: 'submit_plan', autoApprove: false }],
    nextPhases: [['execute', 'triage', 'intake', 'done', 'canceled']],
  },
  execute: {
    ...PHASE_DEFAULTS,
    runner: [{ context: 'work' }],
    nextPhases: [['review', 'planning', 'done', 'canceled']],
  },
  review: {
    ...PHASE_DEFAULTS,
    runner: [{ context: 'work' }],
    nextPhases: [
      ['execute', 'intake', 'done', 'canceled'],
      ['execute', 'intake', 'pr-review', 'done', 'canceled'],
    ],
  },
  'pr-review': {
    ...PHASE_DEFAULTS,
    runner: [{ context: 'work' }],
    nextPhases: [
      ['intake', 'done', 'canceled'],
      ['intake', 'planning', 'execute', 'done', 'canceled'],
    ],
  },
};

/** Stable JSON with sorted keys; an unset field, `null`, `false` and no tools all read the same. */
function canonical(field: MigratedField, value: unknown): string {
  if (value === undefined || value === null || value === false) return 'null';
  if (field === 'tools' && Array.isArray(value) && value.length === 0) return 'null';
  return JSON.stringify(sorted(value));
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sorted(entry)]),
  );
}

function toInput({ position: _position, ...phase }: StoredPhaseRecord): StoredPhaseInput {
  return phase;
}

/** Whether Factory may write `next` over the stored value: the stored one is still an old default. */
function stillOldDefault(phaseKey: string, field: MigratedField, stored: unknown): boolean {
  const old = OLD_WORK_SEED[phaseKey]?.[field] ?? [];
  const current = canonical(field, stored);
  return old.some(value => canonical(field, value) === current);
}

/**
 * Gives a project's stored Work board the phase runners, goal, exit-tool next phase and phase
 * tools of Factory's Work seed, field by field: only a field that still holds the value Factory
 * stored before is filled, so every field a person edited stays as they left it. A phase the
 * row lacks, or holds as another kind, is left alone, as is a move to a phase the row lacks.
 */
export function migrateWorkPhaseRunners(
  board: StoredBoardRecord,
  seed = boardDefinitionOf(workBoard),
): { board: { name: string; description: string | null; phases: StoredPhaseInput[] }; filled: string[] } | undefined {
  const phaseKeys = new Set(board.phases.map(phase => phase.key));
  const filled: string[] = [];
  const phases = board.phases.map(record => {
    const phase = toInput(record);
    const target = seed.phases.find(candidate => candidate.key === phase.key);
    if (!target || target.kind !== phase.kind || !OLD_WORK_SEED[phase.key]) return phase;
    const next: StoredPhaseInput = { ...phase };
    for (const field of MIGRATED_FIELDS) {
      const value = target[field] ?? null;
      if (canonical(field, value) === canonical(field, phase[field])) continue;
      if (!stillOldDefault(phase.key, field, phase[field])) continue;
      if (field === 'nextPhases' && !(value as string[]).every(key => phaseKeys.has(key))) continue;
      Object.assign(next, { [field]: value });
      filled.push(`${phase.key}.${field}`);
    }
    // An exit tool's next phase must be one the phase moves to; keep the stored exit tool otherwise.
    const exitNext = next.exitTool?.next;
    const moves = next.nextPhases ?? [...phaseKeys].filter(key => key !== phase.key);
    if (exitNext !== undefined && next.exitTool !== phase.exitTool && !moves.includes(exitNext)) {
      next.exitTool = phase.exitTool;
      filled.splice(filled.indexOf(`${phase.key}.exitTool`), 1);
    }
    return next;
  });
  if (filled.length === 0) return undefined;
  return { board: { name: board.name, description: board.description, phases }, filled };
}

export const WORK_PHASE_RUNNERS_MIGRATION: StoredBoardMigration = {
  key: 'work-phase-runners-v1',
  boardKey: workBoard.id,
  migrate: board => migrateWorkPhaseRunners(board),
};

/** The board migrations each project gets once, in order. */
export const BOARD_MIGRATIONS: readonly StoredBoardMigration[] = [WORK_PHASE_RUNNERS_MIGRATION];
