import { z } from 'zod';
import { eventRouteWhenSchema, intakeRouteWhenSchema } from '../../../rules/rule-group.js';
import { MAX_BOARD_IDENTIFIER_LENGTH } from '../../../rules/validation.js';

/** Board and phase keys: lowercase slugs, so a key always matches the case-insensitive code-board identifier rule. */
export const STORED_KEY_RE = /^[a-z0-9][a-z0-9_-]*$/;
const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_RUNNER_ID_LENGTH = 128;
const MAX_INSTRUCTIONS_LENGTH = 20_000;
const MAX_PHASES = 30;
const MAX_ROUTES = 100;

export const storedKeySchema = z
  .string()
  .min(1)
  .max(MAX_BOARD_IDENTIFIER_LENGTH)
  .regex(STORED_KEY_RE, 'Use lowercase letters, numbers, - and _, starting with a letter or number.');

const nameSchema = z.string().trim().min(1).max(MAX_NAME_LENGTH);
const descriptionSchema = z.string().trim().max(MAX_DESCRIPTION_LENGTH).nullable().optional();
const runnerIdSchema = z.string().trim().min(1).max(MAX_RUNNER_ID_LENGTH);

export const PHASE_KINDS = ['resting', 'working', 'terminal'] as const;
export type StoredPhaseKind = (typeof PHASE_KINDS)[number];

export const phaseRunnerSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('agent'),
      agentId: runnerIdSchema,
      instructions: z.string().max(MAX_INSTRUCTIONS_LENGTH).optional(),
      model: z.string().trim().min(1).max(200).optional(),
      /** Skill the agent activates when a card enters the phase. */
      skill: runnerIdSchema.optional(),
      /**
       * The card's session this phase runs in. Phases with the same context continue one session;
       * a new context starts a fresh one. Null means the card's main context (`work`). Any key works;
       * `triage` and `review` sessions carry those roles' tools.
       */
      context: storedKeySchema.nullable().optional(),
      /** Earlier name for `context`, still read from boards stored before the rename. */
      seat: storedKeySchema.optional(),
    })
    .strict()
    .refine(runner => !!runner.skill || !!runner.instructions?.trim(), {
      message: 'An agent runner needs a skill or instructions.',
    }),
  z.object({ type: z.literal('workflow'), workflowId: runnerIdSchema }).strict(),
]);
export type StoredPhaseRunner = z.infer<typeof phaseRunnerSchema>;

export const storedPhaseInputSchema = z
  .object({
    key: storedKeySchema,
    name: nameSchema,
    description: descriptionSchema,
    kind: z.enum(PHASE_KINDS),
    runner: phaseRunnerSchema.nullable().optional(),
    /** Phases a card may move to from here. Absent means any phase on the board. */
    nextPhases: z.array(storedKeySchema).max(MAX_PHASES).nullable().optional(),
    /** A successful call of this tool while the card is here moves it to the next phase in board order. */
    exitTool: z
      .string()
      .trim()
      .min(1)
      .max(MAX_RUNNER_ID_LENGTH)
      .regex(/^[A-Za-z0-9_-]+$/, 'Use the tool name, e.g. submit_plan.')
      .nullable()
      .optional(),
    /** Card conditions under which the exit tool is approved without a person. */
    autoApproveWhen: intakeRouteWhenSchema.nullable().optional(),
    /** Only people move cards into this phase; an agent's move into it is refused. */
    /** The runner starts without anyone approving it, even with the project's auto-run off. */
    autoStart: z.boolean().optional(),
    autoStartWhen: intakeRouteWhenSchema.nullable().optional(),
  })
  .strict()
  .superRefine((phase, ctx) => {
    if (phase.kind === 'resting' && phase.runner) {
      ctx.addIssue({ code: 'custom', path: ['runner'], message: 'A resting phase runs nothing.' });
    }
    if (phase.kind !== 'working' && phase.exitTool) {
      ctx.addIssue({ code: 'custom', path: ['exitTool'], message: 'Only a working phase has an exit tool.' });
    }
    if (phase.kind !== 'working' && phase.autoStart) {
      ctx.addIssue({ code: 'custom', path: ['autoStart'], message: 'Only a working phase starts a runner.' });
    }
    if (phase.autoStartWhen && !phase.autoStart) {
      ctx.addIssue({ code: 'custom', path: ['autoStartWhen'], message: 'A start condition needs autoStart.' });
    }
    if (phase.autoApproveWhen && !phase.exitTool) {
      ctx.addIssue({ code: 'custom', path: ['autoApproveWhen'], message: 'Auto-approval needs an exit tool.' });
    }
  });
export type StoredPhaseInput = z.infer<typeof storedPhaseInputSchema>;

export const storedBoardInputSchema = z
  .object({
    key: storedKeySchema,
    name: nameSchema,
    description: descriptionSchema,
    phases: z.array(storedPhaseInputSchema).min(1).max(MAX_PHASES),
    eventRoutes: z
      .array(z.lazy(() => eventRouteInputSchema))
      .max(MAX_ROUTES)
      .optional(),
  })
  .strict()
  .superRefine((board, ctx) => {
    const keys = new Set<string>();
    board.phases.forEach((phase, index) => {
      if (keys.has(phase.key)) {
        ctx.addIssue({ code: 'custom', path: ['phases', index, 'key'], message: `Phase '${phase.key}' is repeated.` });
      }
      keys.add(phase.key);
    });
    board.phases.forEach((phase, index) => {
      phase.nextPhases?.forEach((next, nextIndex) => {
        if (!keys.has(next)) {
          ctx.addIssue({
            code: 'custom',
            path: ['phases', index, 'nextPhases', nextIndex],
            message: `Phase '${next}' is not on this board.`,
          });
        }
        if (next === phase.key) {
          ctx.addIssue({
            code: 'custom',
            path: ['phases', index, 'nextPhases', nextIndex],
            message: 'A phase cannot list itself as a next phase.',
          });
        }
      });
    });
    if (!board.phases.some(phase => phase.kind === 'terminal')) {
      ctx.addIssue({ code: 'custom', path: ['phases'], message: 'A board needs at least one terminal phase.' });
    }
    if (board.phases[0]?.kind === 'terminal') {
      ctx.addIssue({ code: 'custom', path: ['phases', 0], message: 'The first phase cannot be terminal.' });
    } else if (board.phases[0]?.kind === 'working') {
      ctx.addIssue({ code: 'custom', path: ['phases', 0], message: 'The first phase must be resting.' });
    }
    const exitTools = new Set<string>();
    board.phases.forEach((phase, index) => {
      if (!phase.exitTool) return;
      if (exitTools.has(phase.exitTool)) {
        ctx.addIssue({
          code: 'custom',
          path: ['phases', index, 'exitTool'],
          message: `Tool '${phase.exitTool}' already ends another phase.`,
        });
      }
      exitTools.add(phase.exitTool);
      const next = board.phases[index + 1];
      if (!next) {
        ctx.addIssue({
          code: 'custom',
          path: ['phases', index, 'exitTool'],
          message: 'The last phase has no next phase.',
        });
      } else if (phase.nextPhases && !phase.nextPhases.includes(next.key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['phases', index, 'nextPhases'],
          message: `The exit tool moves cards to '${next.key}', so list it as a next phase.`,
        });
      }
    });
  });
export type StoredBoardInput = z.input<typeof storedBoardInputSchema>;

export const intakeRouteInputSchema = z
  .object({
    /** Absent or `null` matches every item: a fallback route. */
    when: intakeRouteWhenSchema.nullable().optional(),
    boardKey: z.string().min(1).max(MAX_BOARD_IDENTIFIER_LENGTH),
    /** Absent means the board's first phase. */
    phaseKey: storedKeySchema.nullable().optional(),
    enabled: z.boolean().optional(),
  })
  .strict();
export type IntakeRouteInput = z.infer<typeof intakeRouteInputSchema>;
export const intakeRoutesInputSchema = z.array(intakeRouteInputSchema).max(MAX_ROUTES);

export const BOARD_EVENTS = [
  'pull_request.opened',
  'pull_request.merged',
  'pull_request.closed',
  'pull_request.review_requested',
  'pull_request.updated',
  'issue.closed',
] as const;
export type BoardEvent = (typeof BOARD_EVENTS)[number];

export const eventRouteInputSchema = z
  .object({
    event: z.enum(BOARD_EVENTS),
    /** Phases the card must be in for the route to apply. Absent means any phase. */
    fromPhases: z.array(storedKeySchema).min(1).max(MAX_PHASES).nullable().optional(),
    when: eventRouteWhenSchema.nullable().optional(),
    toPhaseKey: storedKeySchema,
    enabled: z.boolean().optional(),
  })
  .strict();
export type EventRouteInput = z.infer<typeof eventRouteInputSchema>;

const MAX_BOARDS = 50;

/**
 * Integrations, the Work transition policy and source-closed handling move Work cards between these
 * phases by key, so the Work board keeps each with its kind. Names, descriptions and runners stay
 * editable; next phases may narrow moves but must keep the ones Factory makes itself (pull request
 * opened, reviewed, merged or closed; the issue pipeline; reopening).
 */
const WORK_BOARD_REQUIRED_KINDS: Readonly<Record<string, 'resting' | 'working' | 'terminal'>> = {
  intake: 'resting',
  triage: 'working',
  planning: 'working',
  execute: 'working',
  review: 'working',
  done: 'terminal',
  canceled: 'terminal',
};
const WORK_BOARD_REQUIRED_MOVES: Readonly<Record<string, readonly string[]>> = {
  // Cards filed past Intake (a review request, a route to Review) are created in Intake, then moved.
  intake: ['triage', 'review', 'done', 'canceled'],
  triage: ['intake', 'planning', 'review', 'done', 'canceled'],
  // A pull request that fixes the card's issue can arrive before Factory builds it.
  planning: ['execute', 'review', 'done', 'canceled'],
  execute: ['review', 'done', 'canceled'],
  // Self-review parks a card in Intake once it hits the round limit.
  review: ['intake', 'execute', 'done', 'canceled'],
  done: ['review'],
  canceled: ['review'],
};
export const WORK_BOARD_REQUIRED_PHASES = Object.keys(WORK_BOARD_REQUIRED_KINDS);
/** The retired Review board's id: cards and routes naming it are read as Work. */
export const RETIRED_BOARD_KEY = 'review';

/** One project's whole stored configuration: its boards (each with its event routes) and its intake routes. */
export const projectBoardConfigInputSchema = z
  .object({
    boards: z.array(storedBoardInputSchema).max(MAX_BOARDS),
    intakeRoutes: z.array(intakeRouteInputSchema).max(MAX_ROUTES).default([]),
  })
  .strict()
  .superRefine((config, ctx) => {
    const phasesByBoard = new Map<string, Set<string>>();
    config.boards.forEach((board, index) => {
      if (phasesByBoard.has(board.key)) {
        ctx.addIssue({ code: 'custom', path: ['boards', index, 'key'], message: `Board '${board.key}' is repeated.` });
      }
      phasesByBoard.set(board.key, new Set(board.phases.map(phase => phase.key)));
      if (board.key === RETIRED_BOARD_KEY) {
        ctx.addIssue({
          code: 'custom',
          path: ['boards', index, 'key'],
          message: `'${RETIRED_BOARD_KEY}' was the Review board's id and now means Work. Pick another key.`,
        });
      }
      if (board.key === 'work') {
        const missing = WORK_BOARD_REQUIRED_PHASES.filter(key => !board.phases.some(phase => phase.key === key));
        if (missing.length > 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['boards', index, 'phases'],
            message: `The Work board needs the phases ${missing.join(', ')}; Factory moves cards by these keys.`,
          });
        }
        board.phases.forEach((phase, phaseIndex) => {
          const kind = WORK_BOARD_REQUIRED_KINDS[phase.key];
          if (!kind) return;
          const path = ['boards', index, 'phases', phaseIndex];
          if (phase.kind !== kind) {
            ctx.addIssue({
              code: 'custom',
              path: [...path, 'kind'],
              message: `Work's ${phase.key} phase must stay ${kind}.`,
            });
          }
          const dropped = phase.nextPhases
            ? (WORK_BOARD_REQUIRED_MOVES[phase.key] ?? []).filter(next => !phase.nextPhases!.includes(next))
            : [];
          if (dropped.length > 0) {
            ctx.addIssue({
              code: 'custom',
              path: [...path, 'nextPhases'],
              message: `Work's ${phase.key} phase must allow moving to ${dropped.join(', ')}; Factory moves cards there itself.`,
            });
          }
        });
      }
    });
    config.boards.forEach((board, boardIndex) => {
      const phases = phasesByBoard.get(board.key)!;
      board.eventRoutes?.forEach((route, routeIndex) => {
        const path = ['boards', boardIndex, 'eventRoutes', routeIndex];
        if (!phases.has(route.toPhaseKey)) {
          ctx.addIssue({
            code: 'custom',
            path: [...path, 'toPhaseKey'],
            message: `Phase '${route.toPhaseKey}' is not on board '${board.key}'.`,
          });
        }
        route.fromPhases?.forEach((phase, phaseIndex) => {
          if (!phases.has(phase)) {
            ctx.addIssue({
              code: 'custom',
              path: [...path, 'fromPhases', phaseIndex],
              message: `Phase '${phase}' is not on board '${board.key}'.`,
            });
          }
        });
      });
    });
    config.intakeRoutes.forEach((route, index) => {
      const phases = phasesByBoard.get(route.boardKey);
      if (phases && route.phaseKey && !phases.has(route.phaseKey)) {
        ctx.addIssue({
          code: 'custom',
          path: ['intakeRoutes', index, 'phaseKey'],
          message: `Phase '${route.phaseKey}' is not on board '${route.boardKey}'.`,
        });
      }
    });
  });
export type ProjectBoardConfigInput = z.input<typeof projectBoardConfigInputSchema>;
