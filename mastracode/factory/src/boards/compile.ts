import type { StoredPhaseKind, StoredPhaseRunner } from '../storage/domains/boards/validation.js';
import { defineBoard } from './define-board.js';
import type { BoardPhaseDefinition, BoardSourceClosed, BoardToolRule } from './define-board.js';
import type { InstalledBoard } from './registry.js';
import type { BoardRunner, BoardRunnerRegistry } from './runners.js';
import type { BoardTransitionPolicy } from './transition-policy.js';
import { workTransitionPolicy } from './work-transition-policy.js';

/** The parts of a stored board the runtime needs; both stored rows and the code template fit. */
export interface CompilableBoard {
  readonly key: string;
  readonly name: string;
  readonly phases: readonly {
    readonly key: string;
    readonly name: string;
    readonly kind: StoredPhaseKind;
    readonly runner?: StoredPhaseRunner | null;
    readonly nextPhases?: readonly string[] | null;
  }[];
}

/**
 * Board-wide behavior that stays code, keyed by stored board key. A stored
 * `work` board keeps the Work board's transition policy and source-closed
 * moves; any other key gets none, as custom code boards do today.
 */
const BOARD_KINDS: Readonly<
  Record<string, { transitionPolicy?: BoardTransitionPolicy; sourceClosed?: BoardSourceClosed<string> }>
> = {
  work: { transitionPolicy: workTransitionPolicy, sourceClosed: { completed: 'done', canceled: 'canceled' } },
};

export function runnerId(runner: StoredPhaseRunner): string {
  return runner.type === 'workflow' ? runner.workflowId : runner.agentId;
}

/**
 * Turns a stored board into the `BoardDefinition` the runtime runs. A phase
 * without `nextPhases` may move to any phase; one with it may move only there.
 * A working phase whose runner is not registered (or has no seat role) runs
 * nothing and compiles as resting, so its cards wait for a person.
 */
export function compileStoredBoard(
  board: CompilableBoard,
  runners: BoardRunnerRegistry,
  options: { warn?: (message: string) => void } = {},
): InstalledBoard {
  const allKeys = board.phases.map(phase => phase.key);
  const tools: Record<string, BoardToolRule> = {};
  const phases: Record<string, BoardPhaseDefinition<string>> = {};

  for (const phase of board.phases) {
    let runner: BoardRunner | undefined;
    if (phase.runner) {
      const id = runnerId(phase.runner);
      runner = runners.get(id);
      if (!runner)
        options.warn?.(`Board '${board.key}' phase '${phase.key}' names unknown runner '${id}'; it runs nothing.`);
    }
    const targets = phase.nextPhases ?? allKeys;
    const base = {
      title: phase.name,
      outcomes: Object.fromEntries(targets.map(target => [target, target])),
      ...(runner?.onEnter ? { onEnter: runner.onEnter } : {}),
      ...(runner?.onExit ? { onExit: runner.onExit } : {}),
    };
    if (phase.kind === 'working' && runner?.role) {
      phases[phase.key] = { ...base, kind: 'working', role: runner.role };
    } else if (phase.kind === 'working') {
      if (runner) options.warn?.(`Board '${board.key}' phase '${phase.key}' runner '${runner.id}' seats no role.`);
      phases[phase.key] = { title: phase.name, outcomes: base.outcomes, kind: 'resting' };
      continue;
    } else {
      phases[phase.key] = { ...base, kind: phase.kind };
    }
    Object.assign(tools, runner?.tools);
  }

  const kind = BOARD_KINDS[board.key];
  const sourceClosed =
    kind?.sourceClosed &&
    phases[kind.sourceClosed.completed]?.kind === 'terminal' &&
    phases[kind.sourceClosed.canceled]?.kind === 'terminal'
      ? kind.sourceClosed
      : undefined;

  return defineBoard({
    id: board.key,
    title: board.name,
    initialPhase: board.phases[0]!.key,
    phases,
    tools,
    ...(kind?.transitionPolicy ? { transitionPolicy: kind.transitionPolicy } : {}),
    ...(sourceClosed ? { sourceClosed } : {}),
  });
}
