// Browser-safe: part of @internal/factory-contract, which Factory's server and UIs share.
import { z } from 'zod';

import { INTAKE_ROUTE_RULE_FIELDS, ROUTE_EVENTS } from '../boards/board-events.js';
import { cardRuleGroupSchema, ruleGroupSchema } from '../rules/rule-group.js';

/** Factory tools a working phase grants the session that works the card there. */
export const FACTORY_PHASE_TOOLS = ['factory_record_review_verdict', 'factory_review_source'] as const;
export type FactoryPhaseTool = (typeof FACTORY_PHASE_TOOLS)[number];

const storedRunnerSchema = z
  .object({
    skill: z.string().optional(),
    context: z.string().optional(),
    instructions: z.string().optional(),
    goal: z.object({ objective: z.string(), maxRuns: z.number().optional() }).strict().optional(),
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
    tools: z.array(z.enum(FACTORY_PHASE_TOOLS)).nullish(),
    outcomes: z.array(z.object({ key: z.string(), label: z.string(), to: z.string() }).strict()).nullish(),
  })
  .strict();

export function storedBoardFields() {
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

/** The boards a project has installed, as `GET /boards` lists them. */
export const boardCatalogResponseSchema = z.object({
  boards: z.array(
    z.object({
      id: z.string(),
      /** Absent from servers older than the phase fields. */
      name: z.string().optional(),
      /** @deprecated Use `name`. */
      title: z.string(),
      description: z.string().optional(),
      /** Where the board came from: Factory's built-ins, the app's code, or created through the API. */
      source: z.enum(['builtin', 'app', 'stored']).optional(),
      /** True for every board; only the retired Review board was read-only. */
      editable: z.boolean().optional(),
      /** Problems with the board, such as a runner skill that does not exist. */
      problems: z.array(z.string()).optional(),
      initialPhase: z.string(),
      /**
       * Which phase plays each part of the pull request loop, read from what the phases declare.
       * A part the board has no phase for is absent. Absent from servers older than the loop.
       */
      flow: z
        .object({
          triage: z.string().optional(),
          build: z.string().optional(),
          selfReview: z.string().optional(),
          pullRequestReview: z.string().optional(),
          completed: z.string().optional(),
          canceled: z.string().optional(),
        })
        .optional(),
      phases: z.array(
        z.object({
          id: z.string(),
          name: z.string().optional(),
          /** @deprecated Use `name`. */
          title: z.string(),
          description: z.string().optional(),
          kind: z.enum(['resting', 'working', 'terminal']),
          nextPhases: z.array(z.string()).optional(),
          /** The session context a working phase runs in. */
          context: z.string().optional(),
          /** @deprecated Use `context`. */
          role: z.string().optional(),
          /** The skill the phase's runner starts when a card enters it (`runner.skill`). */
          skill: z.string().optional(),
          /** The objective the phase's runs pursue as a goal (`runner.goal`). */
          goal: z.object({ objective: z.string(), maxRuns: z.number().optional() }).optional(),
          autoStart: z.boolean().optional(),
          /** Cards the phase starts on its own for; absent means every card. */
          autoStartWhen: cardRuleGroupSchema.optional(),
          exitTool: z
            .object({
              id: z.string(),
              autoApprove: z.boolean(),
              /** Cards the exit tool is approved for; absent means every card. */
              autoApproveWhen: cardRuleGroupSchema.optional(),
            })
            .optional(),
          /** Factory tools the phase grants the session working the card there. */
          tools: z.array(z.string()).optional(),
          /** The outcomes the phase's session may report; one per next phase when the board lists none. */
          outcomes: z.array(z.object({ key: z.string(), label: z.string(), to: z.string() })).optional(),
          transitions: z.array(z.object({ outcome: z.string().nullable(), to: z.string() })),
        }),
      ),
    }),
  ),
  /** Stored boards that could not be loaded or that a code board serves in their place, and why. */
  problems: z.array(z.string()).optional(),
});
export type BoardCatalogResponse = z.infer<typeof boardCatalogResponseSchema>;
export type InstalledBoardInfo = BoardCatalogResponse['boards'][number];
export type InstalledPhaseInfo = InstalledBoardInfo['phases'][number];

export const storedBoardResponseSchema = z.object({
  board: z.object({
    key: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    /** In order; the first phase is where cards start. */
    phases: z.array(storedPhaseInputSchema),
    /**
     * Send it back as `expectedRevision` when editing or resetting. Null for the legacy Review
     * board, which is read-only and not stored.
     */
    revision: z.number().int().nullable(),
    source: z.enum(['builtin', 'app', 'stored']),
    /**
     * True for every board: the boards the project created, the built-in Work board and app boards,
     * whose code behaviour stays attached. Only the retired Review board was read-only.
     */
    editable: z.boolean(),
    /**
     * For a built-in or app board, what its code behaviour holds fixed on each code phase: the
     * phase stays with its kind and the moves code makes from it stay in nextPhases. Null for
     * stored boards.
     */
    codeBehaviour: z
      .record(z.string(), z.object({ requiredNextPhases: z.array(z.string()) }))
      .nullable()
      .optional(),
    /** Problems that do not stop the board from loading, such as a review skill outside the review context. */
    problems: z.array(z.string()),
  }),
  /** Whether the caller may edit or reset this board: organization admins, or anyone with auth disabled. */
  canEdit: z.boolean().optional(),
});
export type StoredBoardResponse = z.infer<typeof storedBoardResponseSchema>;
/** A board's definition; send the `revision` you read so a concurrent edit is not overwritten. */
export const replaceBoardBodySchema = storedBoardDefinitionSchema.extend({ expectedRevision: z.number().int().min(1) });
export type ReplaceBoardBody = z.input<typeof replaceBoardBodySchema>;

export const intakeRouteSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  /** 0 is evaluated first. */
  position: z.number().int(),
  when: ruleGroupSchema(INTAKE_ROUTE_RULE_FIELDS).nullable(),
  target: z.object({
    boardKey: z.string(),
    phaseKey: z.string().nullable(),
    joinClosedIssue: z.boolean(),
    moveToBoardKey: z.string().nullable(),
  }),
  on: z.array(z.enum(ROUTE_EVENTS)),
  /**
   * True on a route stored by 0.28 naming `pull_request.opened`: there it only moves a card, and
   * files no pull request, through every edit. Add a route to file pull requests.
   */
  pullRequestOpenedMovesOnly: z.literal(true).optional(),
  /**
   * True on a route stored before card-move rules decided outsiders' pull requests: its card moves
   * skip an outside author's pull request unless its conditions test `pullRequest.trusted`. Edits
   * keep it; only an explicit `outsiderPullRequestsGated: false` patch clears it.
   */
  outsiderPullRequestsGated: z.literal(true).optional(),
  /** Send it back as `expectedRevision` when editing or deleting. */
  revision: z.number().int(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedBy: z.string(),
  updatedAt: z.string(),
  /** Why the route's target can't take cards right now, such as a deleted board; such a route is skipped. */
  problems: z.array(z.string()),
});
export const intakeRouteResponseSchema = z.object({ intakeRoute: intakeRouteSchema });
export type IntakeRouteResponse = z.infer<typeof intakeRouteResponseSchema>;
export const intakeRouteListResponseSchema = z.object({
  intakeRoutes: z.array(intakeRouteSchema),
  /** Whether the caller may add, edit, reorder, or delete routes. */
  canEdit: z.boolean(),
});
export type IntakeRouteListResponse = z.infer<typeof intakeRouteListResponseSchema>;
export type IntakeRouteInfo = IntakeRouteListResponse['intakeRoutes'][number];
