import { createHash } from 'node:crypto';

import { z } from 'zod';

import { cardRuleGroupSchema } from '../rules/rule-group.js';
import type { StoredBoardInput, StoredPhaseInput } from '../storage/domains/boards/base.js';
import { BoardDefinitionError, compileBoardDefinition, declarationOf, DEFAULT_PHASE_CONTEXT } from './define-board.js';
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
  const [initial] = board.phases;
  if (!initial) throw new BoardDefinitionError('A board must define at least one phase.');
  if (code) {
    const conflicts = codeBehaviourConflicts(board, code);
    if (conflicts.length > 0) throw new BoardDefinitionError(conflicts.join(' '));
  }
  const declaration: AnyBoardConfig | undefined = code ? (declarationOf(code) ?? code) : undefined;
  const phases: Record<string, BoardPhaseDefinition<string>> = {};
  for (const phase of board.phases) {
    if (Object.hasOwn(phases, phase.key)) {
      throw new BoardDefinitionError(`Board "${board.key}" declares phase "${phase.key}" more than once.`);
    }
    const runner = phase.runner ? withoutUndefined(phase.runner) : undefined;
    const exitTool = phase.exitTool ? withoutUndefined(phase.exitTool) : undefined;
    const declared =
      declaration && Object.hasOwn(declaration.phases, phase.key) ? declaration.phases[phase.key] : undefined;
    phases[phase.key] = withoutUndefined({
      name: phase.name,
      description: phase.description ?? undefined,
      kind: phase.kind,
      nextPhases: storedNextPhases(phase, board.phases),
      runner,
      autoStart: phase.autoStart ? true : undefined,
      autoStartWhen: phase.autoStartWhen ?? undefined,
      exitTool,
      outcomes: declared?.outcomes,
      onEnter: declared?.onEnter,
      onExit: declared?.onExit,
    }) as BoardPhaseDefinition<string>;
  }
  return compileBoardDefinition(
    {
      id: board.key,
      name: board.name,
      ...(board.description != null ? { description: board.description } : {}),
      initialPhase: initial.key,
      phases,
      ...(declaration?.tools ? { tools: declaration.tools } : {}),
      ...(declaration?.events ? { events: declaration.events } : {}),
      ...(declaration?.transitionPolicy ? { transitionPolicy: declaration.transitionPolicy } : {}),
      ...(declaration?.sourceClosed ? { sourceClosed: declaration.sourceClosed } : {}),
    },
    code,
  );
}

/** What a code board's behaviour holds fixed on each of its phases; the rest of the phase is editable. */
export interface CodePhaseBehaviour {
  /** Code handlers run on entering or leaving it, so its runner context and skill are fixed. */
  handlers: boolean;
  /** The exit tool its code behaviour waits for, if any. */
  exitToolId: string | null;
  /** Phases its code outcomes move cards to; they stay in its nextPhases. */
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
        requiredNextPhases: [...new Set(Object.values(phase.outcomes ?? {}))],
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
 * its first phase, the context and skill of phases with handlers, and their exit tools, so those
 * stay as code declares them. Names, descriptions, `nextPhases`, start and approval conditions,
 * runner instructions and new phases are free.
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
    if (edited.kind !== phase.kind) {
      conflicts.push(`${label} must stay ${phase.kind}; its code behaviour depends on it.`);
      continue;
    }
    if (phase.kind === 'working') {
      if (hasHandlers(declaration.phases[key])) {
        const context = edited.runner?.context ?? DEFAULT_PHASE_CONTEXT;
        if (context !== phase.runner.context) {
          conflicts.push(
            `${label} runs its code handlers in the "${phase.runner.context}" context; keep runner.context.`,
          );
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
      }
    }
    const nextPhases = storedNextPhases(edited, board.phases);
    for (const [outcome, target] of Object.entries(phase.outcomes ?? {})) {
      if (!nextPhases.includes(target)) {
        conflicts.push(`${label} outcome "${outcome}" moves cards to "${target}"; keep it in nextPhases.`);
      }
    }
  }
  return conflicts;
}

/** A fingerprint of a code board's storable definition; it changes when the code default does. */
export function codeBoardHash(board: InstalledBoard): string {
  return createHash('sha256')
    .update(canonicalJson(boardDefinitionOf(board)))
    .digest('hex');
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
              })
            : undefined,
        }
      : {}),
  });
}

function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}
