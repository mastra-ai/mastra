// Browser-safe: part of @internal/factory-contract, which Factory's server and UIs share.
/**
 * Wire shapes of the board's read routes: what Factory's server answers and its clients read.
 * The server's route contracts (routes/contracts.ts) use these schemas as their responses.
 */
import { z } from 'zod';
import { SESSION_ROW_STATUSES } from '../session/session-row-query.js';

const countSchema = z.number().int().nonnegative();

/** Any JSON object: the loose shape of a row a route sends whole. */
export const entitySchema = z.record(z.string(), z.unknown());

export const cardSchema = z
  .object({
    workItem: z
      .object({
        provider: z.string(),
        key: z.string().nullable(),
        url: z.string().nullable(),
        title: z.string(),
        state: z.string().nullable(),
        labels: z.array(z.string()),
        author: z.string().nullable(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const runQueueEntrySchema = z.object({
  decisionId: z.string(),
  /** `waiting`: no slot yet. `claimed`: a server holds a slot for it, starting or running the run. */
  state: z.enum(['waiting', 'claimed']),
  type: z.enum(['invokeSkill', 'sendMessage', 'signalActivity']),
  /**
   * `interactive`: a reply a person sent on the card's pull request or issue,
   * claimed ahead of automated runs into its own reserve of slots.
   * `automated`: everything else.
   */
  lane: z.enum(['automated', 'interactive']),
  role: z.string().nullable(),
  /** The skill an `invokeSkill` run starts; `null` for a prompt run and for messages and activity. */
  skillName: z.string().nullable(),
  /** When it became claimable for `waiting`, when it was claimed for `claimed`. */
  queuedSince: z.string(),
  workItem: z
    .object({
      id: z.string(),
      key: z.string().nullable(),
      title: z.string(),
      board: z.string().nullable(),
      phase: z.string().nullable(),
    })
    .nullable(),
});

export const runQueueResponseSchema = z.object({
  /** This server process's run slots; `null` when it runs no dispatcher. Other servers keep their own. */
  slots: z
    .object({
      scope: z.literal('server'),
      /** Automated run slots, including any a person's reply borrowed once its reserve was full. */
      inUse: z.number().int(),
      cap: z.number().int(),
      /** Slots kept for people's replies, on top of `cap`. */
      interactive: z.object({ inUse: z.number().int(), cap: z.number().int() }),
    })
    .nullable(),
  /** The project's runs holding a slot on any server. */
  running: z.number().int(),
  claimed: z.array(runQueueEntrySchema),
  /** Every waiting run, though `queued` lists at most 50. */
  queuedCount: z.number().int(),
  /** `queuedCount` split by lane. */
  queuedByLane: z.object({ automated: z.number().int(), interactive: z.number().int() }),
  /**
   * Waiting replies, then automated runs, each oldest first: interactive runs are claimed before
   * automated ones. `position` counts within the run's lane.
   */
  queued: z.array(runQueueEntrySchema.extend({ position: z.number().int().positive() })),
});
export type RunQueueResponse = z.infer<typeof runQueueResponseSchema>;

export const workItemSessionRepositoryResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('resolved'), projectRepositoryId: z.string(), slug: z.string() }),
  z.object({ status: z.literal('unlinked'), hint: z.string() }),
]);

/** What the draft page's starter buttons count on the project's default board. */
export const workItemStartersResponseSchema = z.object({
  failed: countSchema,
  changesRequested: countSchema,
  review: z.object({ count: countSchema, oldestOpenedAt: z.string().optional() }),
  undecided: countSchema,
  untriaged: countSchema,
  unplannedBugs: countSchema,
  sweep: z.object({ area: z.string(), count: countSchema }).optional(),
  stale: countSchema,
});

/** When the project's cards were created and completed since an instant, and how many cards it has in all. */
export const workItemActivityResponseSchema = z.object({
  total: countSchema,
  createdAt: z.array(z.string()),
  doneAt: z.array(z.string()),
});

export const BOARD_PHASES_SORTS = ['recent', 'recent-mine', 'created-newest', 'created-oldest'] as const;

/**
 * Names a card and the body the answer was read from. `version` is another value whenever any of
 * the body is, so a reader that holds the card at this version holds this body.
 */
export const cardStampSchema = z.object({ id: z.string(), version: z.string() });

export const boardPhasesResponseSchema = z.object({
  /** The board's phases in declaration order. */
  phases: z.array(
    z.object({
      phase: z.string(),
      /** Cards of this phase that match the view. */
      total: countSchema,
      /** The first of them in the view's order: what the reader shows. */
      cards: z.array(cardStampSchema),
    }),
  ),
  /** With `item`: the asked card, when the board holds it. */
  item: cardStampSchema
    .extend({
      /**
       * Each phase the view lists the card under, and how many cards it lists before it there.
       * Empty when the search or filters leave the card out.
       */
      places: z.array(z.object({ phase: z.string(), position: countSchema })),
    })
    .optional(),
  /**
   * Cards related to a listed card or to the asked one that no phase lists: the first `limit` of
   * each card's, in the board's order.
   */
  related: z.array(cardStampSchema),
  /** How many such cards there are, named in `related` or not. */
  relatedTotal: countSchema,
  /** Cards of the board, whatever the search and filters. */
  boardTotal: countSchema,
  /** Cards of the board that match the view, each counted once: a card in two phases is one. */
  matchingTotal: countSchema,
  /** With `cards=true`: the body of every card named in `phases`, `item` and `related`, each with its `version`. */
  workItems: z.array(cardSchema.extend({ version: z.string() })).optional(),
});

/** What the board's filter menus offer, read over every card of the project. */
export const workItemFilterOptionsResponseSchema = z.object({
  /** Every label on a card, sorted. */
  labels: z.array(z.string()),
  /** The people the cards' sources name, sorted by name. `id` is what a people filter sends. */
  people: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      source: z.enum(['github', 'gitlab', 'linear', 'jira', 'incidentio']),
    }),
  ),
  /** The Factory users who created a card, moved one or started a session on one, sorted. */
  actorIds: z.array(z.string()),
});

export type BoardPhasesResponse = z.infer<typeof boardPhasesResponseSchema>;

export type WorkItemFilterOptionsResponse = z.infer<typeof workItemFilterOptionsResponseSchema>;

/** Factory's answer to a card list read. */
export const workItemListResponseSchema = z.object({
  /** Every listed card, or with `removedIds` only the cards changed since the `since` sent. */
  workItems: z.array(cardSchema),
  /** With `started=false`: how many cards matched, of which `workItems` holds the first `limit`. */
  total: z.number().int().nonnegative().optional(),
  /** Names this read of the whole board. Absent when the next read must list it whole again. */
  cursor: z.string().optional(),
  /** Cards gone since the `since` sent. Its presence marks an answer that holds only what moved. */
  removedIds: z.array(z.string()).optional(),
  /** With `removedIds`: `boardCheck` of the whole board, for a reader to check its merged copy against. */
  check: z.string().optional(),
});
export const decisionListResponseSchema = z.object({
  decisions: z.array(entitySchema),
  nextCursor: z.string().optional(),
});

export type WorkItemListResponse = z.infer<typeof workItemListResponseSchema>;
export type WorkItemStartersResponse = z.infer<typeof workItemStartersResponseSchema>;
export type WorkItemActivityResponse = z.infer<typeof workItemActivityResponseSchema>;
export type WorkItemSessionRepositoryResponse = z.infer<typeof workItemSessionRepositoryResponseSchema>;

/** The filters a board view picks values for; each is sent once per picked value. */
export const BOARD_PHASES_FILTERS = [
  'source',
  'linearProject',
  'label',
  'pullRequest',
  'trust',
  'teammate',
  'author',
  'assignee',
  'reviewer',
  'worked',
] as const;
export type BoardPhasesFilter = (typeof BOARD_PHASES_FILTERS)[number];
export type BoardPhasesSort = (typeof BOARD_PHASES_SORTS)[number];

/** What the board read is asked: one view of a board, and how deep each of its phases is listed. */
export interface BoardPhasesRequest {
  board: string;
  sort: BoardPhasesSort;
  /** Empty searches nothing. */
  q: string;
  /** The picked values of each filter, sorted. A filter that picks nothing is left out. */
  filters: Partial<Record<BoardPhasesFilter, readonly string[]>>;
  /** How many cards a phase lists, for the phases listed deeper than the server's first page. */
  windows: Readonly<Record<string, number>>;
  /** A card to answer for apart from the listing: its body, and where each phase holding it places it. */
  item?: string;
}

export const sessionActivityResponseSchema = z.object({
  runningSessionIds: z.array(z.string()),
  /** Sessions of a card, or of the reader, whose run waits on a person's answer. */
  parkedSessionIds: z.array(z.string()),
  /** The status of each card's sidebar row, by card id, for the cards neither idle nor done. */
  cardStatuses: z.record(z.string(), z.enum(SESSION_ROW_STATUSES)),
  /** Cards one of whose sessions is running or parked on a person: no rival run may start on them. */
  sessionHeldCardIds: z.array(z.string()),
  /** Cards in `cardStatuses` working, and waiting on a person. */
  cards: z.object({ working: countSchema, waiting: countSchema }),
});
export type SessionActivityResponse = z.infer<typeof sessionActivityResponseSchema>;
