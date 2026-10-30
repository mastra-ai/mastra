import { z } from 'zod';

import { cardRuleGroupSchema } from '../rules/rule-group.js';
import type { StoredBoardInput, StoredPhaseInput } from '../storage/domains/boards/base.js';
import { BoardDefinitionError, compileBoardDefinition } from './define-board.js';
import type { BoardPhase, BoardPhaseDefinition } from './define-board.js';
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
    agentEnterWhen: z.union([cardRuleGroupSchema, z.literal(false)]).nullish(),
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
 */
export function compileStoredBoard(board: StoredBoardInput): InstalledBoard {
  const [initial] = board.phases;
  if (!initial) throw new BoardDefinitionError('A board must define at least one phase.');
  const phases: Record<string, BoardPhaseDefinition<string>> = {};
  for (const phase of board.phases) {
    if (Object.hasOwn(phases, phase.key)) {
      throw new BoardDefinitionError(`Board "${board.key}" declares phase "${phase.key}" more than once.`);
    }
    const runner = phase.runner ? withoutUndefined(phase.runner) : undefined;
    const exitTool = phase.exitTool ? withoutUndefined(phase.exitTool) : undefined;
    phases[phase.key] = withoutUndefined({
      name: phase.name,
      description: phase.description ?? undefined,
      kind: phase.kind,
      nextPhases: storedNextPhases(phase, board.phases),
      runner,
      autoStart: phase.autoStart ? true : undefined,
      autoStartWhen: phase.autoStartWhen ?? undefined,
      exitTool,
      agentEnterWhen: phase.agentEnterWhen ?? undefined,
    }) as BoardPhaseDefinition<string>;
  }
  return compileBoardDefinition({
    id: board.key,
    name: board.name,
    ...(board.description != null ? { description: board.description } : {}),
    initialPhase: initial.key,
    phases,
  });
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
    agentEnterWhen: phase.agentEnterWhen,
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
