import { createHash } from 'node:crypto';

import { z } from 'zod';

import { cardRuleGroupSchema } from '../rules/rule-group.js';
import type {
  StoredBoardInput,
  StoredBoardSeed,
  StoredBoardSeedSource,
  StoredPhaseInput,
} from '../storage/domains/boards/base.js';
import { BoardDefinitionError, boardDeclaration, compileBoardDefinition } from './define-board.js';
import type {
  BoardEventRules,
  BoardPhase,
  BoardPhaseDefinition,
  BoardSourceClosed,
  BoardToolRules,
} from './define-board.js';
import type { InstalledBoard } from './registry.js';
import type { BoardTransitionPolicy } from './transition-policy.js';

/**
 * The parts of a code board that are functions (or tied to them) and so cannot be stored. They
 * attach to a stored board by its key, and per phase by the phase key.
 */
export interface BoardBehaviors {
  readonly transitionPolicy?: BoardTransitionPolicy;
  readonly sourceClosed?: BoardSourceClosed<string>;
  readonly tools?: BoardToolRules;
  readonly events?: BoardEventRules;
  readonly phases: Readonly<
    Record<string, Readonly<Pick<BoardPhaseDefinition<string>, 'onEnter' | 'onExit' | 'outcomes'>>>
  >;
}

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

const storedPhaseInputSchema = z
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

/**
 * A board as the API accepts it. Beyond the shape, it holds every rule `defineBoard()` enforces
 * (identifiers, lengths, phase kinds, runners, exit tools, conditions, targets), reported with
 * the same messages.
 */
export const storedBoardInputSchema = z
  .object({
    key: z.string(),
    name: z.string(),
    description: z.string().nullish(),
    phases: z.array(storedPhaseInputSchema).min(1, 'A board must define at least one phase.'),
  })
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
 * cards start. Code behaviors attach only to phases that still exist, so a phase removed from the
 * stored board drops its handlers, and a phase added to it runs only its stored runner.
 */
export function compileStoredBoard(board: StoredBoardInput, behaviors?: BoardBehaviors): InstalledBoard {
  const [initial] = board.phases;
  if (!initial) throw new BoardDefinitionError('A board must define at least one phase.');
  const phases: Record<string, BoardPhaseDefinition<string>> = {};
  for (const phase of board.phases) {
    if (Object.hasOwn(phases, phase.key)) {
      throw new BoardDefinitionError(`Board "${board.key}" declares phase "${phase.key}" more than once.`);
    }
    const attached = behaviors && Object.hasOwn(behaviors.phases, phase.key) ? behaviors.phases[phase.key] : undefined;
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
      onEnter: attached?.onEnter,
      onExit: attached?.onExit,
      outcomes: attached?.outcomes,
    }) as BoardPhaseDefinition<string>;
  }
  return compileBoardDefinition({
    id: board.key,
    name: board.name,
    ...(board.description != null ? { description: board.description } : {}),
    initialPhase: initial.key,
    phases,
    ...(behaviors?.tools ? { tools: { ...behaviors.tools } } : {}),
    ...(behaviors?.events ? { events: behaviors.events } : {}),
    ...(behaviors?.transitionPolicy ? { transitionPolicy: behaviors.transitionPolicy } : {}),
    ...(behaviors?.sourceClosed ? { sourceClosed: { ...behaviors.sourceClosed } } : {}),
  });
}

/** A code board as seed input: its storable definition, the hash of that definition, and its behaviors. */
export interface BoardSeed extends StoredBoardSeed {
  readonly behaviors: BoardBehaviors;
}

/**
 * Turns a code board into what is stored for it. The initial phase is placed first, and every
 * phase's resolved `nextPhases` is written out, so the stored board moves cards exactly as the
 * code board does.
 */
export function seedFromDefinition(board: InstalledBoard, source: StoredBoardSeedSource): BoardSeed {
  const declared = boardDeclaration(board);
  if (!declared) {
    throw new BoardDefinitionError(
      `Board "${board.id}" was not built by defineBoard(); pass the board defineBoard() returned, not a copy.`,
    );
  }
  const order = [board.initialPhase, ...Object.keys(board.phases).filter(key => key !== board.initialPhase)];
  const input: StoredBoardInput = {
    key: board.id,
    name: board.name,
    ...(board.description !== undefined ? { description: board.description } : {}),
    phases: order.map(key => storedPhase(key, board.phases[key]!)),
  };
  const behaviors: BoardBehaviors = {
    ...(board.transitionPolicy ? { transitionPolicy: board.transitionPolicy } : {}),
    ...(board.sourceClosed ? { sourceClosed: board.sourceClosed } : {}),
    ...(Object.keys(board.tools).length > 0 ? { tools: board.tools } : {}),
    ...(Object.keys(board.events).length > 0 ? { events: board.events } : {}),
    phases: Object.fromEntries(
      Object.entries(declared.phases).flatMap(([key, phase]) => {
        const attached = withoutUndefined({ onEnter: phase.onEnter, onExit: phase.onExit, outcomes: phase.outcomes });
        return Object.keys(attached).length > 0 ? [[key, attached]] : [];
      }),
    ),
  };
  return { key: board.id, source, hash: boardSeedHash(input), input, behaviors };
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

/** sha256 of the board's storable definition as JSON with sorted keys. */
export function boardSeedHash(input: StoredBoardInput): string {
  return createHash('sha256').update(stableJson(input)).digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, entry]) => entry !== undefined && typeof entry !== 'function')
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}
