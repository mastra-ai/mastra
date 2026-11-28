// Browser-safe: part of @internal/factory-contract, which Factory's server and UIs share.
import { z } from 'zod';

import {
  CLOSE_REASONS,
  INTAKE_ROUTE_RULE_FIELDS,
  ROUTE_EVENTS,
  routeEventsProblem,
  STATUS_EVENTS,
} from '../boards/board-events.js';
import { BOARD_IDENTIFIER_RE, MAX_BOARD_IDENTIFIER_LENGTH } from '../rules/identifiers.js';
import { ruleGroupSchema } from '../rules/rule-group.js';
import { storedBoardFields } from './boards.js';

export const UUID_PATTERN = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
export const uuidSchema = z.string().regex(new RegExp(UUID_PATTERN));
const nonEmptyTrimmed = (max: number) => z.string().trim().min(1).max(max);
const boardRevisionSchema = z.number().int().min(1);
/** The most intake rules one board may hold. */
export const MAX_INTAKE_ROUTES_PER_BOARD = 100;

/** A new board as `POST /boards` accepts it. Only the shape: the server runs the board rules. */
export const createBoardBodySchema = z.object({ key: z.string(), ...storedBoardFields() }).strict();
export type CreateBoardBody = z.input<typeof createBoardBodySchema>;

export const intakeRoutePathSchema = z.object({ id: uuidSchema, routeId: uuidSchema });
export const boardIdentifierSchema = z.string().max(MAX_BOARD_IDENTIFIER_LENGTH).regex(BOARD_IDENTIFIER_RE);
export const intakeRouteTargetSchema = z
  .object({
    boardKey: boardIdentifierSchema,
    /** Unset lands the card in the board's first phase. */
    phaseKey: boardIdentifierSchema.nullable().optional(),
    /**
     * File a pull request on the card of the issue it closes (on `boardKey`) instead of a new card;
     * that card moves to `phaseKey` when its board allows it. Matches no other arrival.
     */
    joinClosedIssue: z.boolean().optional(),
    /**
     * On a route moving existing cards on later events, the board the card moves to, at `phaseKey`;
     * `boardKey` stays the board whose cards the route moves. Unset keeps the card on `boardKey`.
     */
    moveToBoardKey: boardIdentifierSchema.nullable().optional(),
  })
  .strict();
export const intakeRouteWhenSchema = ruleGroupSchema(INTAKE_ROUTE_RULE_FIELDS);
export const intakeRouteFields = {
  name: nonEmptyTrimmed(120),
  enabled: z.boolean(),
  /** Which cards the route applies to; null matches every card. Event routes can test `event.type` and `event.reason`. */
  when: intakeRouteWhenSchema.nullable(),
  /** Where matching cards land. */
  target: intakeRouteTargetSchema,
  /**
   * The events the route handles. `work_item.opened` files new issues and `pull_request.opened` new
   * pull requests with no card (and moves the card of an issue whose pull request opens); the others
   * move existing cards. `work_item.created`, the legacy event, files both and is kept as written.
   */
  on: z
    .array(z.enum(ROUTE_EVENTS, { error: issue => routeEventsProblem([String(issue.input)], null) ?? undefined }))
    .superRefine((on, ctx) => {
      const problem = routeEventsProblem(on, null);
      if (problem) ctx.addIssue({ code: 'custom', message: problem });
    }),
};
export const intakeRouteInputSchema = z
  .object({
    name: intakeRouteFields.name,
    enabled: intakeRouteFields.enabled.default(true),
    when: intakeRouteFields.when.default(null),
    target: intakeRouteFields.target,
    on: intakeRouteFields.on.optional(),
    /** Restores a route read with `pullRequestOpenedMovesOnly` as it was: moving cards on `pull_request.opened`, filing none. */
    pullRequestOpenedMovesOnly: z.literal(true).optional(),
    /** Restores a route read with `outsiderPullRequestsGated` as it was: its card moves skipping outside authors' pull requests. */
    outsiderPullRequestsGated: z.literal(true).optional(),
  })
  .strict();
/** Changes the named fields; send the `revision` you read so a concurrent edit is not overwritten. */
export const intakeRoutePatchSchema = z
  .object({
    name: intakeRouteFields.name.optional(),
    enabled: intakeRouteFields.enabled.optional(),
    when: intakeRouteFields.when.optional(),
    target: intakeRouteFields.target.optional(),
    on: intakeRouteFields.on.optional(),
    /**
     * `false` lets outside authors' pull requests match an older rule's card moves, like every rule
     * written since rules decided them. No other edit changes it, so an edit and its Undo can't
     * quietly widen the rule.
     */
    outsiderPullRequestsGated: z.literal(false).optional(),
    expectedRevision: boardRevisionSchema,
  })
  .strict()
  .refine(({ expectedRevision: _revision, ...fields }) => Object.values(fields).some(value => value !== undefined), {
    message: 'Change at least one field.',
  });
/** Bounds a whole-project reorder, which names every rule of every board. */
export const MAX_PROJECT_INTAKE_ROUTES = 10_000;
export const intakeRouteReorderBodySchema = z
  .object({
    /** Reorders only this board's rules, within the places they hold; omitted, the whole project's. */
    boardKey: z.string().min(1).max(MAX_BOARD_IDENTIFIER_LENGTH).optional(),
    /** Every rule of the board (or of the project), once each, in the new order. */
    ids: z
      .array(uuidSchema)
      .min(1)
      .max(MAX_PROJECT_INTAKE_ROUTES)
      .refine(ids => new Set(ids).size === ids.length, { message: 'Each route may appear only once.' }),
  })
  .strict()
  .refine(({ boardKey, ids }) => boardKey === undefined || ids.length <= MAX_INTAKE_ROUTES_PER_BOARD, {
    message: `A board has at most ${MAX_INTAKE_ROUTES_PER_BOARD} intake rules.`,
    path: ['ids'],
  });

export const intakeRerouteResponseSchema = z.object({
  total: z.number().int(),
  moves: z.array(z.object({ fromBoard: z.string(), toBoard: z.string(), count: z.number().int() })),
});
export const intakeRerouteApplyResponseSchema = z.object({ moved: z.number().int(), skipped: z.number().int() });
export const intakeRouteListQuerySchema = z
  .object({
    /** Lists only this board's rules, in their order. */
    boardKey: z.string().min(1).max(MAX_BOARD_IDENTIFIER_LENGTH).optional(),
  })
  .strict();
export const intakeOrderResponseSchema = z.object({
  /** Every board of the project, in the order intake asks them. */
  boards: z.array(z.object({ boardKey: z.string(), name: z.string() })),
  /**
   * `derived` follows the rule list until an admin sets the order; then it is `explicit`. A project
   * created with intake order has its own order from the start, so it is `explicit` from the start.
   */
  origin: z.enum(['derived', 'explicit']),
  /** Which evaluator places the project's new items now: `route-list` (the old one) or `intake-order`. */
  evaluator: z.enum(['route-list', 'intake-order']),
  /**
   * What decided `evaluator`: `FACTORY_INTAKE_EVALUATOR` (forced on every project), the project's
   * own setting, or none (a project from before the setting, on `route-list`).
   */
  evaluatorSource: z.enum(['env', 'project', 'legacy']),
  /** The project's own setting, used unless one is forced; null for a project from before the setting. */
  projectEvaluator: z.enum(['route-list', 'intake-order']).nullable(),
  /** Both evaluators run over the project's newest 200 items against this order, worked out on each read. */
  comparison: z.object({
    compared: z.number().int(),
    differing: z.number().int(),
    notRouted: z.number().int(),
  }),
  /** Whether the caller may change the order. */
  canEdit: z.boolean(),
});
export const intakeOrderBodySchema = z
  .object({
    /** Every board of the project, once each, in the new order. */
    boardKeys: z
      .array(z.string().min(1).max(MAX_BOARD_IDENTIFIER_LENGTH))
      .min(1)
      .max(MAX_PROJECT_INTAKE_ROUTES)
      .refine(keys => new Set(keys).size === keys.length, { message: 'Each board may appear only once.' })
      .optional(),
    /** Switches the project's evaluator; a forced one still wins until it is unset. */
    evaluator: z.enum(['route-list', 'intake-order']).optional(),
  })
  .strict()
  .refine(body => body.boardKeys !== undefined || body.evaluator !== undefined, {
    message: 'Name the boardKeys, the evaluator, or both.',
  });
export const intakeDecisionSchema = z.object({
  id: z.string(),
  outcome: z.enum(['placed', 'not_routed', 'rule_skipped', 'rule_retired']),
  evaluator: z.enum(['route-list', 'intake-order']),
  boardKey: z.string().nullable(),
  routeId: z.string().nullable(),
  /** Why no board took it. */
  reason: z.string().nullable(),
  sourceKey: z.string().nullable(),
  title: z.string(),
  url: z.string().nullable(),
  decidedAt: z.string(),
});
export const intakeNotRoutedQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    /** The `nextCursor` of the page before. */
    cursor: z.string().min(1).max(200).optional(),
  })
  .strict();
export const intakeNotRoutedResponseSchema = z.object({
  /** Oldest first. */
  notRouted: z.array(intakeDecisionSchema),
  /** Pass as `cursor` for the next page; null on the last. */
  nextCursor: z.string().nullable(),
  /** Whether the caller may route an item again. */
  canEdit: z.boolean(),
});
export const intakeSkippedResponseSchema = z.object({
  /** Card-move rules that matched but whose target couldn't take the card, in the last 30 days. */
  skipped: z.array(z.object({ routeId: z.string(), count: z.number().int(), latest: intakeDecisionSchema })),
});
export const intakeDecisionPathSchema = z.object({ id: uuidSchema, decisionId: uuidSchema });
export const intakeRouteAgainResponseSchema = z.object({
  /** The item is queued to be filed here; the card appears once the dispatcher files it. */
  status: z.literal('queued'),
  boardKey: z.string(),
  phaseKey: z.string(),
  routeId: z.string(),
});
/** A board's rules as edited, not saved yet: they stand in for all of that board's rules. */
export const intakeDraftBoardSchema = z
  .object({
    boardKey: z.string().min(1).max(MAX_BOARD_IDENTIFIER_LENGTH),
    routes: z
      .array(
        z
          .object({
            /** The saved rule this edits, so its counts line up; omitted for a new rule. */
            id: uuidSchema.optional(),
            name: intakeRouteFields.name,
            enabled: intakeRouteFields.enabled.default(true),
            when: intakeRouteFields.when.default(null),
            target: z
              .object({
                phaseKey: z.string().min(1).max(MAX_BOARD_IDENTIFIER_LENGTH).nullable().optional(),
                /** On a card-move rule: the board the card moves to; unset keeps it on this board. */
                moveToBoardKey: intakeRouteTargetSchema.shape.moveToBoardKey,
                /** On a pull request rule: join the card of the issue it closes, as the saved rule does. */
                joinClosedIssue: z.boolean().optional(),
              })
              .strict(),
            on: intakeRouteFields.on.optional(),
          })
          .strict(),
      )
      .max(MAX_INTAKE_ROUTES_PER_BOARD),
  })
  .strict();
export const intakeDraftFields = {
  /** Unsaved rules, board by board; boards not named run their saved rules. */
  boards: z
    .array(intakeDraftBoardSchema)
    .max(MAX_PROJECT_INTAKE_ROUTES)
    .refine(boards => new Set(boards.map(board => board.boardKey)).size === boards.length, {
      message: 'Each board may appear only once.',
    })
    .optional(),
  /** An unsaved intake order; omitted, the saved one. */
  order: intakeOrderBodySchema.shape.boardKeys.optional(),
};
export const intakeDryRunBodySchema = z.object(intakeDraftFields).strict();
export const intakePlacementSchema = z.object({ boardKey: z.string(), routeId: z.string(), phase: z.string() });
export const intakeKeysByBoardSchema = z.array(z.object({ boardKey: z.string(), keys: z.array(z.string()) }));
export const intakeDryRunResponseSchema = z.object({
  /**
   * The evaluator that files this project's items. Both endpoints always answer as `intake-order`;
   * under `route-list` filing can land items elsewhere, such as on the default board.
   */
  evaluator: z.enum(['route-list', 'intake-order']),
  /** How many of the project's newest items (at most 200) were decided, from their stored facts. */
  sampled: z.number().int(),
  /** Every board in intake order, with what it and each of its rules would take. */
  boards: z.array(
    z.object({
      boardKey: z.string(),
      name: z.string(),
      /** Keys of the items the board would take. */
      takes: z.array(z.string()),
      /** Items its rules matched that another board took first, by that board. */
      lostTo: intakeKeysByBoardSchema,
      rules: z.array(
        z.object({
          /** A rule not saved yet reads `draft:<boardKey>:<index>`. */
          routeId: z.string(),
          name: z.string().nullable(),
          enabled: z.boolean(),
          takes: z.array(z.string()),
          /** Items it matched but an earlier rule took, by the board that took them. */
          lost: intakeKeysByBoardSchema,
          /** Cards it actually filed in the last 30 days. */
          filed: z.number().int(),
        }),
      ),
    }),
  ),
  /** Keys of the items no board would take. */
  notRouted: z.array(z.string()),
  /** With unsaved rules or order: how many items land somewhere other than the saved ones put them. */
  changed: z.number().int().optional(),
  items: z.array(
    z.object({
      key: z.string(),
      /** The card's id, or the Not routed decision's. */
      id: z.string(),
      kind: z.enum(['card', 'not_routed']),
      title: z.string(),
      url: z.string().nullable(),
      placement: intakePlacementSchema.nullable(),
      /** Every rule that matched and could take it, in the order intake asked them; the first won. */
      matched: z.array(z.object({ boardKey: z.string(), routeId: z.string() })),
      /** With unsaved rules or order: where the saved ones put it. */
      before: intakePlacementSchema.nullable().optional(),
    }),
  ),
  /** Whether the caller may run unsaved rules or order. */
  canEdit: z.boolean(),
});
/** The most labels or assignees one test event may name on each side. */
export const MAX_TEST_EVENT_NAMES = 100;
export const itemChangeSchema = z
  .object({
    added: z.array(z.string().min(1).max(500)).max(MAX_TEST_EVENT_NAMES).default([]),
    removed: z.array(z.string().min(1).max(500)).max(MAX_TEST_EVENT_NAMES).default([]),
  })
  .strict();
/** A status event as card-move rules read it. */
export const intakeTestEventSchema = z
  .object({
    type: z.enum(STATUS_EVENTS),
    /** On `work_item.closed`. */
    reason: z.enum(CLOSE_REASONS).optional(),
    /** On an update: the labels and assignees it changed. */
    labels: itemChangeSchema.optional(),
    assignees: itemChangeSchema.optional(),
    /** On a pull request event: whether that pull request's author is trusted. */
    pullRequestTrusted: z.boolean().optional(),
  })
  .strict();
export const intakeTestBodySchema = z
  .object({
    ...intakeDraftFields,
    /** An issue or pull request URL; one the Factory has never seen is fetched once, read-only, from a linked source. */
    url: z.string().trim().url().max(2000).optional(),
    /** A recent item: a card's id, or a Not routed decision's. */
    itemId: uuidSchema.optional(),
    /** A status event to try on the item's card, as if it had just happened; its recent events are replayed either way. */
    event: intakeTestEventSchema.optional(),
  })
  .strict()
  .refine(body => (body.url === undefined) !== (body.itemId === undefined), {
    message: 'Send either a url or an itemId.',
  });
export const failedConditionSchema = z.object({
  field: z.string(),
  operator: z.string(),
  value: z.unknown().optional(),
  /** The item's value for the field; null when it has none. */
  actual: z.unknown(),
});
export const intakeTestResponseSchema = z.object({
  item: z.object({
    title: z.string(),
    url: z.string().nullable(),
    /** `card` and `not_routed` are items the Factory has; `fetched` was read from its provider for this test. */
    kind: z.enum(['card', 'not_routed', 'fetched']),
    id: z.string().nullable(),
  }),
  placement: intakePlacementSchema.nullable(),
  /** Why no board takes it. */
  reason: z.string().nullable(),
  /** What this answer leaves out, such as a fetched pull request joining an existing card instead. */
  note: z.string().nullable(),
  /**
   * The evaluator that files this project's items. Both endpoints always answer as `intake-order`;
   * under `route-list` filing can land items elsewhere, such as on the default board.
   */
  evaluator: z.enum(['route-list', 'intake-order']),
  /** Every board in intake order and every placing rule on it, with what it answered. */
  boards: z.array(
    z.object({
      boardKey: z.string(),
      name: z.string(),
      rules: z.array(
        z.object({
          routeId: z.string(),
          name: z.string().nullable(),
          phase: z.string(),
          /** `took` decides; `lost` matched after the rule that took it; `phase_refuses` matched but its phase can't hold the item. */
          outcome: z.enum(['took', 'lost', 'no_match', 'phase_refuses', 'disabled']),
          /** With `no_match`: the conditions it failed on. */
          failed: z.array(failedConditionSchema).optional(),
          /** With `lost`: the rule that took it. */
          to: z.object({ boardKey: z.string(), routeId: z.string() }).optional(),
        }),
      ),
    }),
  ),
  /** On a card: where it is now, and the intake rule that filed it, if one did. */
  current: z.object({ boardKey: z.string(), phase: z.string().nullable(), routeId: z.string().nullable() }).nullable(),
  /**
   * On a card: the event sent in the request, then its recent status events newest first, each
   * replayed against today's rules (or the draft) and the card as it is now.
   */
  moves: z.array(
    z.object({
      /** The stored event's decision; null for the event sent in the request. */
      decisionId: z.string().nullable(),
      at: z.string().nullable(),
      event: z.object({
        type: z.enum(STATUS_EVENTS),
        reason: z.enum(CLOSE_REASONS).optional(),
        labels: z.object({ added: z.array(z.string()), removed: z.array(z.string()) }).optional(),
        assignees: z.object({ added: z.array(z.string()), removed: z.array(z.string()) }).optional(),
        pullRequestTrusted: z.boolean().optional(),
      }),
      /**
       * `moves` to `to`; `stays` where it is; `rule_default` leaves it to the integration's own move
       * (to `phase`, when there is one) because no rule takes it; `ignored` when the event can't move
       * a card in its state, with `reason`; `unknown` when an update burst reaches back past the
       * history read, with `reason`.
       */
      outcome: z.enum(['moves', 'stays', 'rule_default', 'ignored', 'unknown']),
      to: z.object({ boardKey: z.string(), phase: z.string(), routeId: z.string() }).nullable(),
      phase: z.string().nullable(),
      reason: z.string().nullable(),
      /** Every rule on the card's board that handles the event, top to bottom. */
      rules: z.array(
        z.object({
          routeId: z.string(),
          name: z.string().nullable(),
          /** `skipped` matched but its target board or phase can't take the card, with `reason`. */
          outcome: z.enum(['took', 'lost', 'no_match', 'skipped', 'disabled']),
          failed: z.array(failedConditionSchema).optional(),
          to: z.object({ boardKey: z.string(), routeId: z.string() }).optional(),
          reason: z.string().optional(),
        }),
      ),
    }),
  ),
});

export type IntakeRouteInput = z.input<typeof intakeRouteInputSchema>;
export type IntakeRoutePatch = z.input<typeof intakeRoutePatchSchema>;
export type IntakeRouteReorderBody = z.input<typeof intakeRouteReorderBodySchema>;
export type IntakeRerouteResponse = z.infer<typeof intakeRerouteResponseSchema>;
export type IntakeRerouteApplyResponse = z.infer<typeof intakeRerouteApplyResponseSchema>;
export type IntakeOrderResponse = z.infer<typeof intakeOrderResponseSchema>;
export type IntakeOrderBody = z.input<typeof intakeOrderBodySchema>;
export type IntakeNotRoutedResponse = z.infer<typeof intakeNotRoutedResponseSchema>;
export type IntakeDecisionInfo = IntakeNotRoutedResponse['notRouted'][number];
export type IntakeSkippedResponse = z.infer<typeof intakeSkippedResponseSchema>;
export type IntakeRouteAgainResponse = z.infer<typeof intakeRouteAgainResponseSchema>;
export type IntakeDryRunBody = z.input<typeof intakeDryRunBodySchema>;
export type IntakeDryRunResponse = z.infer<typeof intakeDryRunResponseSchema>;
export type IntakeTestBody = z.input<typeof intakeTestBodySchema>;
export type IntakeTestResponse = z.infer<typeof intakeTestResponseSchema>;
