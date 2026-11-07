import { z } from 'zod';

import { cardRuleGroupSchema } from '../rules/rule-group.js';
import type { StoredBoardInput, StoredPhaseInput } from '../storage/domains/boards/base.js';
import {
  BoardDefinitionError,
  compileBoardDefinition,
  declarationOf,
  DEFAULT_PHASE_CONTEXT,
  FACTORY_PHASE_TOOLS,
} from './define-board.js';
import type { AnyBoardConfig, BoardPhase, BoardPhaseDefinition } from './define-board.js';
import type { InstalledBoard } from './registry.js';

const storedRunnerSchema = z
  .object({
    skill: z.string().optional(),
    context: z.string().optional(),
    instructions: z.string().optional(),
  })
  .strict();

const storedExitToolSchema = z
  .object({
    id: z.string(),
    autoApprove: z.boolean().optional(),
    autoApproveWhen: cardRuleGroupSchema.optional(),
    next: z.string().optional(),
  })
  .strict();

export const storedPhaseInputSchema = z
  .object({
    key: z.string(),
    name: z.string(),
    description: z.string().nullish(),
    kind: z.enum(['resting', 'working', 'terminal']),
    runner: storedRunnerSchema.nullish(),
    nextPhases: z.array(z.string()).nullish(),
    autoStart: z.boolean().optional(),
    autoStartWhen: cardRuleGroupSchema.nullish(),
    exitTool: storedExitToolSchema.nullish(),
    manualEntry: z.boolean().optional(),
    tools: z.array(z.enum(FACTORY_PHASE_TOOLS)).nullish(),
  })
  .strict();

function storedBoardFields() {
  return {
    name: z.string(),
    description: z.string().nullish(),
    phases: z.array(storedPhaseInputSchema).min(1, 'A board must define at least one phase.'),
  };
}

/**
 * A board's editable fields without its key, the shape of a replace. Only the shape: the board
 * rules run once the key is known, through {@link storedBoardInputSchema}.
 */
export const storedBoardDefinitionSchema = z.object(storedBoardFields()).strict();

/**
 * A board as the API accepts it. Beyond the shape, it holds every rule `defineBoard()` enforces
 * (identifiers, lengths, phase kinds, runners, exit tools, conditions, targets), reported with
 * the same messages.
 */
export const storedBoardInputSchema = z
  .object({ key: z.string(), ...storedBoardFields() })
  .strict()
  .superRefine((input, context) => {
    try {
      compileStoredBoard(input);
    } catch (error) {
      if (!(error instanceof BoardDefinitionError)) throw error;
      context.addIssue({ code: 'custom', message: error.message });
    }
  });

/** Phases a stored phase may move to: unset on a resting or working phase means every other phase. */
function storedNextPhases(phase: StoredPhaseInput, phases: readonly StoredPhaseInput[]): string[] {
  if (phase.nextPhases != null) return phase.nextPhases;
  if (phase.kind === 'terminal') return [];
  return phases.filter(other => other.key !== phase.key).map(other => other.key);
}

/**
 * Compiles a stored board through the same validator as `defineBoard()`. Its first phase is where
 * cards start.
 *
 * With `code`, the board is a project's edit of that code board: its fields come from the stored
 * definition and its behaviour from the code declaration, by phase key (`onEnter`, `onExit`,
 * `outcomes`) and for the board (`tools`, `events`, `sourceClosed`, `transitionPolicy`). The board
 * is rebuilt from the declaration, so the stored runner reaches the declared handlers. An edit code
 * behaviour can't honour ({@link codeBehaviourConflicts}) is refused.
 */
export function compileStoredBoard(board: StoredBoardInput, code?: InstalledBoard): InstalledBoard {
  if (!code) return compileBoardDefinition(storedBoardConfig(board));
  const conflicts = codeBehaviourConflicts(board, code);
  if (conflicts.length > 0) throw new BoardDefinitionError(conflicts.join(' '));
  const declaration = codeDeclaration(code);
  const phases: Record<string, PhaseBehaviour> = {};
  for (const key of Object.keys(declaration.phases)) {
    const { outcomes, onEnter, onExit } = declaration.phases[key]!;
    phases[key] = { outcomes, onEnter, onExit };
  }
  return compileBoardDefinition(
    storedBoardConfig(board, {
      phases,
      tools: declaration.tools,
      events: declaration.events,
      transitionPolicy: declaration.transitionPolicy,
      sourceClosed: declaration.sourceClosed,
    }),
    code,
  );
}

/** A board served from a stored row, and what of its code board's behaviour it runs without. */
interface MergedStoredBoard {
  board: InstalledBoard;
  /** One per piece of code behaviour the row can't run with; empty when it runs with all of it. */
  problems: string[];
}

/**
 * Serves a stored row of a code board's key with the code behaviour that still fits it. Unlike
 * {@link compileStoredBoard}, nothing is refused: a row that fell out of step with its code (an
 * edit from before a release added a phase or a code move, a row older than editable code boards)
 * still runs as stored.
 *
 * - A phase's `onEnter`, `onExit` and `outcomes` attach only when the row keeps the phase in the
 *   shape they depend on: the same kind and, on phases with code handlers, the same runner context
 *   and skill, the declared exit tool and no other. Outcomes whose target the row lacks or doesn't
 *   allow are dropped.
 * - The board's `tools` always attach: they hold the exit-tool approval that keeps anyone but a
 *   person from moving a card past an unapproved exit tool. If the row lacks a code phase, the
 *   moves they make to it are refused, and that is reported.
 * - The board's `events` and `transitionPolicy` attach only when the row has every code phase,
 *   since their handlers may move cards to any of them; `sourceClosed` when both of its phases are
 *   stored and terminal.
 * - A move code makes that the row's `nextPhases` don't allow is reported; code making it is refused.
 * - If the board still fails to compile with that behaviour, it runs without any.
 *
 * The result links to `code` as its code board either way. Throws only when the row itself is
 * invalid.
 */
export function mergeCodeBehaviour(row: StoredBoardInput, code: InstalledBoard): MergedStoredBoard {
  const declaration = codeDeclaration(code);
  const stored = new Map(row.phases.map(phase => [phase.key, phase]));
  const problems: string[] = [];
  const phases: Record<string, PhaseBehaviour> = {};
  for (const [key, phase] of Object.entries(code.phases) as [string, BoardPhase<string>][]) {
    const declared = declaration.phases[key];
    const outcomes = Object.entries(declared?.outcomes ?? {});
    const edited = stored.get(key);
    const conflicts = edited ? phaseShapeConflicts(key, phase, declared, edited) : [];
    if (edited && edited.kind === phase.kind) {
      // A move code makes that the row doesn't allow is refused when code makes it.
      const allowed = storedNextPhases(edited, row.phases);
      const outcomeTargets = new Set(outcomes.map(([, target]) => target));
      for (const target of phase.nextPhases) {
        if (stored.has(target) && !allowed.includes(target) && !outcomeTargets.has(target)) {
          problems.push(
            `Board "${row.key}" doesn't let phase "${key}" move cards to "${target}", so Factory's code can't make that move.`,
          );
        }
      }
    }
    if (!hasHandlers(declared) && outcomes.length === 0) continue;
    if (!edited) {
      problems.push(`Phase "${key}" isn't on stored board "${row.key}", so its code behaviour doesn't run.`);
      continue;
    }
    if (conflicts.length > 0) {
      problems.push(...conflicts.map(conflict => `Phase "${key}" runs without its code behaviour: ${conflict}`));
      continue;
    }
    const allowed = storedNextPhases(edited, row.phases);
    const kept: Record<string, string> = {};
    for (const [outcome, target] of outcomes) {
      if (!stored.has(target)) {
        problems.push(`Phase "${key}" runs without its code outcome "${outcome}": phase "${target}" isn't stored.`);
      } else if (!allowed.includes(target)) {
        problems.push(
          `Phase "${key}" runs without its code outcome "${outcome}": the board doesn't let it move cards to "${target}".`,
        );
      } else kept[outcome] = target;
    }
    phases[key] = {
      onEnter: declared?.onEnter,
      onExit: declared?.onExit,
      outcomes: Object.keys(kept).length > 0 ? kept : undefined,
    };
  }

  const board: BoardBehaviour = { phases };
  const missing = Object.keys(code.phases).filter(key => !stored.has(key));
  const unfit = missing.length > 0 ? missingPhases(missing) : undefined;
  const tools = Object.keys(declaration.tools ?? {});
  if (tools.length > 0) {
    board.tools = declaration.tools;
    if (unfit) {
      problems.push(
        `Board "${row.key}" keeps its code tool rules (${tools.join(', ')}), but can't move cards where they lead: ${unfit}`,
      );
    }
  }
  const events = Object.keys(declaration.events ?? {});
  if (events.length > 0) {
    if (unfit) problems.push(`Board "${row.key}" runs without its code event rules (${events.join(', ')}): ${unfit}`);
    else board.events = declaration.events;
  }
  if (declaration.transitionPolicy) {
    if (unfit) problems.push(`Board "${row.key}" runs without its code transition policy: ${unfit}`);
    else board.transitionPolicy = declaration.transitionPolicy;
  }
  const sourceClosed = declaration.sourceClosed;
  if (sourceClosed) {
    const closed = [sourceClosed.completed, sourceClosed.canceled];
    const closedMissing = closed.filter(key => !stored.has(key));
    const closedOpen = closed.filter(key => stored.has(key) && stored.get(key)!.kind !== 'terminal');
    if (closedMissing.length > 0) {
      problems.push(`Board "${row.key}" doesn't move cards when their source closes: ${missingPhases(closedMissing)}`);
    } else if (closedOpen.length > 0) {
      problems.push(
        `Board "${row.key}" doesn't move cards when their source closes: ${
          closedOpen.length === 1
            ? `phase "${closedOpen[0]}" isn't terminal.`
            : `phases ${closedOpen.map(key => `"${key}"`).join(', ')} aren't terminal.`
        }`,
      );
    } else board.sourceClosed = sourceClosed;
  }

  try {
    return { board: compileBoardDefinition(storedBoardConfig(row, board), code), problems };
  } catch (error) {
    if (!(error instanceof BoardDefinitionError)) throw error;
    return {
      board: compileBoardDefinition(storedBoardConfig(row), code),
      problems: [...problems, `Board "${row.key}" runs without its code behaviour: ${error.message}`],
    };
  }
}

function missingPhases(keys: string[]): string {
  return keys.length === 1
    ? `phase "${keys[0]}" isn't stored.`
    : `phases ${keys.map(key => `"${key}"`).join(', ')} aren't stored.`;
}

/** The code behaviour one stored phase runs with. */
interface PhaseBehaviour {
  outcomes?: Readonly<Record<string, string>>;
  onEnter?: BoardPhaseDefinition<string>['onEnter'];
  onExit?: BoardPhaseDefinition<string>['onExit'];
}

/** The code behaviour a stored board runs with, by phase key and for the board. */
interface BoardBehaviour {
  phases: Record<string, PhaseBehaviour>;
  tools?: AnyBoardConfig['tools'];
  events?: AnyBoardConfig['events'];
  transitionPolicy?: AnyBoardConfig['transitionPolicy'];
  sourceClosed?: AnyBoardConfig['sourceClosed'];
}

function codeDeclaration(code: InstalledBoard): AnyBoardConfig {
  return declarationOf(code) ?? code;
}

/**
 * The board config a stored definition declares, with the given code behaviour. The board is
 * rebuilt from the declaration's handlers, so the stored runner reaches them.
 */
function storedBoardConfig(board: StoredBoardInput, behaviour?: BoardBehaviour): AnyBoardConfig {
  const [initial] = board.phases;
  if (!initial) throw new BoardDefinitionError('A board must define at least one phase.');
  const phases: Record<string, BoardPhaseDefinition<string>> = {};
  for (const phase of board.phases) {
    if (Object.hasOwn(phases, phase.key)) {
      throw new BoardDefinitionError(`Board "${board.key}" declares phase "${phase.key}" more than once.`);
    }
    const runner = phase.runner ? withoutUndefined(phase.runner) : undefined;
    const exitTool = phase.exitTool ? withoutUndefined(phase.exitTool) : undefined;
    const declared = behaviour && Object.hasOwn(behaviour.phases, phase.key) ? behaviour.phases[phase.key] : undefined;
    phases[phase.key] = withoutUndefined({
      name: phase.name,
      description: phase.description ?? undefined,
      kind: phase.kind,
      nextPhases: storedNextPhases(phase, board.phases),
      runner,
      autoStart: phase.autoStart ? true : undefined,
      autoStartWhen: phase.autoStartWhen ?? undefined,
      exitTool,
      tools: phase.tools?.length ? phase.tools : undefined,
      manualEntry: phase.manualEntry ? true : undefined,
      outcomes: declared?.outcomes,
      onEnter: declared?.onEnter,
      onExit: declared?.onExit,
    }) as BoardPhaseDefinition<string>;
  }
  return {
    id: board.key,
    name: board.name,
    ...(board.description != null ? { description: board.description } : {}),
    initialPhase: initial.key,
    phases,
    ...(behaviour?.tools ? { tools: behaviour.tools } : {}),
    ...(behaviour?.events ? { events: behaviour.events } : {}),
    ...(behaviour?.transitionPolicy ? { transitionPolicy: behaviour.transitionPolicy } : {}),
    ...(behaviour?.sourceClosed ? { sourceClosed: behaviour.sourceClosed } : {}),
  };
}

/** What a code board's behaviour holds fixed on each of its phases; the rest of the phase is editable. */
interface CodePhaseBehaviour {
  /** Code handlers run on entering or leaving it, so its runner context and skill are fixed. */
  handlers: boolean;
  /** The exit tool its code behaviour waits for, if any. */
  exitToolId: string | null;
  /** Phases code moves cards to from it; they stay in its nextPhases. */
  requiredNextPhases: string[];
}

/** The per-phase locks `codeBehaviourConflicts` enforces, for clients that show them. */
export function codeBehaviourOf(code: InstalledBoard): Record<string, CodePhaseBehaviour> {
  const declaration: AnyBoardConfig = declarationOf(code) ?? code;
  return Object.fromEntries(
    (Object.entries(code.phases) as [string, BoardPhase<string>][]).map(([key, phase]) => [
      key,
      {
        handlers: phase.kind === 'working' && hasHandlers(declaration.phases[key]),
        exitToolId: phase.kind === 'working' ? (phase.exitTool?.id ?? null) : null,
        requiredNextPhases: [...phase.nextPhases],
      },
    ]),
  );
}

function hasHandlers(phase: BoardPhaseDefinition<string> | undefined): boolean {
  return Object.keys(phase?.onEnter ?? {}).length > 0 || Object.keys(phase?.onExit ?? {}).length > 0;
}

/**
 * Why a stored definition of a code board's key can't run with that board's code behaviour, one
 * reason per locked change; empty when it can. Code handlers and checks name the board's phases,
 * its first phase, the context, skill and exit tool of phases with handlers, and the moves code
 * makes between phases (tool and event rules, `sourceClosed`, integrations, handler prompts), so
 * those stay as code declares them. Names, descriptions, added moves, start and approval
 * conditions, runner instructions and new phases are free.
 */
export function codeBehaviourConflicts(board: StoredBoardInput, code: InstalledBoard): string[] {
  const declaration: AnyBoardConfig = declarationOf(code) ?? code;
  const stored = new Map(board.phases.map(phase => [phase.key, phase]));
  const conflicts: string[] = [];
  if (board.phases[0]?.key !== code.initialPhase) {
    conflicts.push(`Cards on board "${code.id}" start in "${code.initialPhase}"; keep it the first phase.`);
  }
  for (const [key, phase] of Object.entries(code.phases) as [string, BoardPhase<string>][]) {
    const edited = stored.get(key);
    const label = `Phase "${key}"`;
    if (!edited) {
      conflicts.push(`${label} has code behaviour on board "${code.id}"; it can't be removed.`);
      continue;
    }
    conflicts.push(...phaseShapeConflicts(key, phase, declaration.phases[key], edited));
    if (edited.kind !== phase.kind) continue;
    const nextPhases = storedNextPhases(edited, board.phases);
    const outcomes = new Map(Object.entries(phase.outcomes ?? {}).map(([outcome, target]) => [target, outcome]));
    for (const target of phase.nextPhases) {
      if (nextPhases.includes(target)) continue;
      const outcome = outcomes.get(target);
      conflicts.push(
        outcome
          ? `${label} outcome "${outcome}" moves cards to "${target}"; keep it in nextPhases.`
          : `${label}: Factory's code moves cards from it to "${target}"; keep it in nextPhases.`,
      );
    }
  }
  return conflicts;
}

/**
 * Why a stored phase isn't in the shape its code behaviour depends on: its kind and, on a working
 * phase, the runner context and skill its code handlers run with and the exit tool they wait for.
 */
function phaseShapeConflicts(
  key: string,
  phase: BoardPhase<string>,
  declared: BoardPhaseDefinition<string> | undefined,
  edited: StoredPhaseInput,
): string[] {
  const label = `Phase "${key}"`;
  if (edited.kind !== phase.kind) return [`${label} must stay ${phase.kind}; its code behaviour depends on it.`];
  if (phase.kind !== 'working') return [];
  const conflicts: string[] = [];
  if (hasHandlers(declared)) {
    const context = edited.runner?.context ?? DEFAULT_PHASE_CONTEXT;
    if (context !== phase.runner.context) {
      conflicts.push(`${label} runs its code handlers in the "${phase.runner.context}" context; keep runner.context.`);
    }
    if (edited.runner?.skill !== phase.runner.skill) {
      conflicts.push(
        phase.runner.skill
          ? `${label} code handlers run with skill "${phase.runner.skill}"; keep runner.skill.`
          : `${label} code handlers choose the skill; leave runner.skill unset.`,
      );
    }
  }
  if (phase.exitTool && edited.exitTool?.id !== phase.exitTool.id) {
    conflicts.push(`${label} code behaviour waits for exit tool "${phase.exitTool.id}"; keep exitTool.id.`);
  } else if (!phase.exitTool && edited.exitTool && hasHandlers(declared)) {
    // An exit tool gates every move out of the phase, including the ones its code handlers make.
    conflicts.push(`${label} code handlers move cards on without an exit tool; leave exitTool unset.`);
  }
  return conflicts;
}

/** Whether two storable definitions describe the same board once unset fields and defaults are resolved. */
export function sameBoardDefinition(a: StoredBoardInput, b: StoredBoardInput): boolean {
  return (
    canonicalJson(boardDefinitionOf(compileStoredBoard(a))) === canonicalJson(boardDefinitionOf(compileStoredBoard(b)))
  );
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * A board's storable definition, in the shape the boards API reads and writes. The initial phase
 * comes first and every phase's resolved `nextPhases` is written out.
 */
export function boardDefinitionOf(board: InstalledBoard): StoredBoardInput {
  const order = [board.initialPhase, ...Object.keys(board.phases).filter(key => key !== board.initialPhase)];
  return {
    key: board.id,
    name: board.name,
    ...(board.description !== undefined ? { description: board.description } : {}),
    phases: order.map(key => storedPhase(key, board.phases[key]!)),
  };
}

function storedPhase(key: string, phase: BoardPhase<string>): StoredPhaseInput {
  return withoutUndefined({
    key,
    name: phase.name,
    description: phase.description,
    kind: phase.kind,
    nextPhases: [...phase.nextPhases],
    manualEntry: phase.manualEntry ? true : undefined,
    ...(phase.kind === 'working'
      ? {
          runner: withoutUndefined({
            skill: phase.runner.skill,
            context: phase.runner.context,
            instructions: phase.runner.instructions,
          }),
          autoStart: phase.autoStart ? true : undefined,
          autoStartWhen: phase.autoStartWhen,
          exitTool: phase.exitTool
            ? withoutUndefined({
                id: phase.exitTool.id,
                autoApprove: phase.exitTool.autoApprove,
                autoApproveWhen: phase.exitTool.autoApproveWhen,
                next: phase.exitTool.next,
              })
            : undefined,
          tools: phase.tools ? [...phase.tools] : undefined,
        }
      : {}),
  });
}

function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}
