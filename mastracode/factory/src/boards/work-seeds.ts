import type { StoredBoardInput, StoredPhaseInput } from '../storage/domains/boards/base.js';
import { boardDefinitionOf } from './stored-board.js';
import { workBoard } from './work.js';

/** The Triage phase Work had before new projects' Work dropped it. */
const TRIAGE_PHASE: StoredPhaseInput = {
  key: 'triage',
  name: 'Triage',
  kind: 'working',
  runner: { skill: 'factory-triage', context: 'triage' },
  // A confirmed bug goes to Planning; any other open issue waits in Intake for a person.
  nextPhases: ['intake', 'planning', 'done', 'canceled'],
};

/** The moves into Triage each phase had, at the place they had them. */
const MOVES_INTO_TRIAGE: Readonly<Record<string, { after: string | null }>> = {
  intake: { after: null },
  planning: { after: 'execute' },
};

/**
 * Work as Factory stored it before new projects' Work dropped Triage: today's Work plus its
 * Triage phase and the moves into it. A project that existed before then, and so has no stored
 * Work row only because it never loaded on a release that stores boards, is given this one, so
 * an upgrade never changes the phases a project's cards can sit in. Reset gives it back too.
 */
export function workSeedWithTriage(): StoredBoardInput {
  const seed = boardDefinitionOf(workBoard);
  const phases = seed.phases.flatMap((phase): StoredPhaseInput[] => {
    const into = MOVES_INTO_TRIAGE[phase.key];
    const withMove: StoredPhaseInput = into
      ? { ...phase, nextPhases: withTriage(phase.nextPhases ?? [], into.after) }
      : phase;
    return phase.key === 'intake' ? [withMove, TRIAGE_PHASE] : [withMove];
  });
  return { ...seed, phases };
}

function withTriage(nextPhases: readonly string[], after: string | null): string[] {
  const index = after === null ? 0 : nextPhases.indexOf(after) + 1;
  return [...nextPhases.slice(0, index), 'triage', ...nextPhases.slice(index)];
}
