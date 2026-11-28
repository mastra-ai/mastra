export {
  BOARD_PHASES_SORTS,
  boardPhasesResponseSchema,
  runQueueResponseSchema,
  workItemActivityResponseSchema,
  workItemFilterOptionsResponseSchema,
  workItemSessionRepositoryResponseSchema,
  workItemStartersResponseSchema,
};
export type { BoardPhasesResponse, RunQueueResponse, WorkItemFilterOptionsResponse };
import {
  sessionActivityResponseSchema,
  BOARD_IDENTIFIER_RE,
  BOARD_PHASES_SORTS,
  boardPhasesResponseSchema,
  cardRuleGroupSchema,
  cardSchema,
  cardStampSchema,
  CLOSE_REASONS,
  decisionListResponseSchema,
  entitySchema,
  INTAKE_ROUTE_RULE_FIELDS,
  MAX_BOARD_IDENTIFIER_LENGTH,
  MODEL_PACK_MODELS_MAX,
  MODEL_PACK_NAME_MAX,
  MODEL_PACKS_MAX,
  modelIdSchema,
  PULL_REQUEST_STATUSES,
  ROUTE_EVENTS,
  routeEventsProblem,
  ruleGroupSchema,
  runQueueResponseSchema,
  SESSION_ROW_ALL_OWNERS,
  SESSION_ROW_GROUP_BYS,
  SESSION_ROW_PINS_MAX,
  SESSION_ROW_SORTS,
  SESSION_ROW_STATUSES,
  SESSION_ROW_UPDATED_WITHIN,
  SESSION_ROW_WINDOW_MAX,
  SESSION_ROW_WINDOWS_MAX,
  sessionRowOwnerSchema,
  sessionRowSourceSchema,
  STATUS_EVENTS,
  workItemActivityResponseSchema,
  workItemFilterOptionsResponseSchema,
  workItemListResponseSchema,
  workItemSessionRepositoryResponseSchema,
  workItemStartersResponseSchema,
  boardCatalogResponseSchema,
  intakeRouteListResponseSchema,
  intakeRouteResponseSchema,
  intakeRouteSchema,
  replaceBoardBodySchema,
  storedBoardResponseSchema,
  storedPhaseInputSchema,
  intakeRoutePathSchema,
  boardIdentifierSchema,
  intakeRouteTargetSchema,
  intakeRouteWhenSchema,
  intakeRouteFields,
  intakeRouteInputSchema,
  intakeRoutePatchSchema,
  MAX_PROJECT_INTAKE_ROUTES,
  intakeRouteReorderBodySchema,
  intakeRerouteResponseSchema,
  intakeRerouteApplyResponseSchema,
  intakeRouteListQuerySchema,
  intakeOrderResponseSchema,
  intakeOrderBodySchema,
  intakeDecisionSchema,
  intakeNotRoutedQuerySchema,
  intakeNotRoutedResponseSchema,
  intakeSkippedResponseSchema,
  intakeDecisionPathSchema,
  intakeRouteAgainResponseSchema,
  intakeDraftBoardSchema,
  intakeDraftFields,
  intakeDryRunBodySchema,
  intakePlacementSchema,
  intakeKeysByBoardSchema,
  intakeDryRunResponseSchema,
  MAX_TEST_EVENT_NAMES,
  itemChangeSchema,
  intakeTestEventSchema,
  intakeTestBodySchema,
  failedConditionSchema,
  intakeTestResponseSchema,
  MAX_INTAKE_ROUTES_PER_BOARD,
} from '@internal/factory-contract';
import type {
  SessionActivityResponse,
  BoardPhasesFilter,
  BoardPhasesResponse,
  CardChangeRequest,
  ModelPackSet,
  RunQueueResponse,
  WorkItemFilterOptionsResponse,
} from '@internal/factory-contract';
import { THINKING_LEVEL_VALUES } from '@mastra/code-sdk/thinking';
import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';

import { validateSkillContent } from '@mastra/core/skills';
import { z } from 'zod';
import { storedBoardInputSchema } from '../boards/stored-board.js';
import { FACTORY_MODEL_SCOPES } from '../storage/domains/projects/base.js';
import {
  UUID_PATTERN,
  uuidSchema,
  nullableTrimmed,
  environmentRepositorySchema,
  environmentSandboxSchema,
  environmentBuildTriggersSchema,
  environmentLastBuildSchema,
  RESERVED_SANDBOX_ENV_NAMES,
  MAX_SANDBOX_ENV_VALUE_LENGTH,
  sandboxEnvNameSchema,
  sandboxEnvAppliesToSchema,
  sandboxEnvPathSchema,
  sandboxEnvSetBodySchema,
  sandboxEnvUpdateBodySchema,
  sandboxEnvSchema,
  sandboxEnvsListResponseSchema,
  sandboxEnvResponseSchema,
  projectEnvironmentResponseSchema,
  environmentRepositoryPatchSchema,
  updateProjectEnvironmentBodySchema,
} from './environment-contracts.js';

export {
  UUID_PATTERN,
  environmentSandboxSchema,
  environmentBuildTriggersSchema,
  environmentLastBuildSchema,
  RESERVED_SANDBOX_ENV_NAMES,
  MAX_SANDBOX_ENV_VALUE_LENGTH,
  sandboxEnvNameSchema,
  sandboxEnvAppliesToSchema,
  sandboxEnvSetBodySchema,
  sandboxEnvUpdateBodySchema,
  projectEnvironmentResponseSchema,
  updateProjectEnvironmentBodySchema,
};

export const THINKING_LEVELS = THINKING_LEVEL_VALUES as [ThinkingLevelSetting, ...ThinkingLevelSetting[]];

export type FactoryRouteContract = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  pathSchema?: z.ZodType;
  querySchema?: z.ZodType;
  bodySchema?: z.ZodType;
  responseSchema: z.ZodType;
};

const nonEmptyTrimmed = (max: number) => z.string().trim().min(1).max(max);
const rawBoundedTrimmed = (max: number) =>
  z
    .string()
    .max(max)
    .transform(value => value.trim())
    .pipe(z.string().min(1));
/** Card description: trimmed, and blank clears it. */
const descriptionSchema = z
  .string()
  .max(8000)
  .transform(value => value.trim() || null)
  .nullable();
const trimmedUuidSchema = z.string().trim().regex(new RegExp(UUID_PATTERN));
const projectPathSchema = z.object({ id: uuidSchema });
const projectDecisionPathSchema = z.object({ id: uuidSchema, decisionId: uuidSchema });
const boardPathSchema = z.object({ id: uuidSchema, boardKey: z.string().min(1).max(MAX_BOARD_IDENTIFIER_LENGTH) });
const boardRevisionSchema = z.number().int().min(1);
/** Send the `revision` you read so a concurrent edit is not overwritten. */
export const boardResetBodySchema = z.object({ expectedRevision: boardRevisionSchema });
/** A board's definition; send the `revision` you read so a concurrent edit is not overwritten. */
export const boardDeleteQuerySchema = z.object({ expectedRevision: z.coerce.number().int().min(1) });

const workItemPathSchema = z.object({ id: uuidSchema });
const transitionPathSchema = z.object({ id: uuidSchema, workItemId: uuidSchema });

const MODEL_PACK_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const modelPackSchema = z
  .object({
    id: z.string().regex(MODEL_PACK_ID_PATTERN, 'A pack ID is 1 to 64 letters, digits, "-" or "_"'),
    name: z
      .string()
      .trim()
      .min(1, 'A pack needs a name')
      .max(MODEL_PACK_NAME_MAX, `A pack name is at most ${MODEL_PACK_NAME_MAX} characters`),
    models: z
      .array(z.object({ modelId: modelIdSchema, thinkingLevel: z.enum(THINKING_LEVELS) }))
      .min(1, 'A pack needs at least one model')
      .max(MODEL_PACK_MODELS_MAX, `A pack holds at most ${MODEL_PACK_MODELS_MAX} models`),
  })
  .refine(pack => new Set(pack.models.map(model => model.modelId)).size === pack.models.length, {
    message: 'A pack cannot list the same model twice',
    path: ['models'],
  });

const modelPacksSchema = z.array(modelPackSchema).max(MODEL_PACKS_MAX, `There can be at most ${MODEL_PACKS_MAX} packs`);
const defaultModelPackIdSchema = z.string().nullable();

function modelPackSetProblem({ modelPacks, defaultModelPackId }: ModelPackSet): string | undefined {
  if (new Set(modelPacks.map(pack => pack.id)).size !== modelPacks.length) return 'Two packs cannot share an ID';
  if (new Set(modelPacks.map(pack => pack.name.toLowerCase())).size !== modelPacks.length) {
    return 'Two packs cannot share a name';
  }
  if (modelPacks.length === 0) {
    return defaultModelPackId === null ? undefined : 'There is no default pack when there are no packs';
  }
  return modelPacks.some(pack => pack.id === defaultModelPackId)
    ? undefined
    : 'The default pack must be one of the packs';
}

export const modelPackSetSchema = z
  .object({ modelPacks: modelPacksSchema, defaultModelPackId: defaultModelPackIdSchema })
  .superRefine((set, ctx) => {
    const problem = modelPackSetProblem(set);
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  });

const projectSchema = entitySchema;
const projectResponseSchema = z.object({ project: projectSchema });

/**
 * A repository linked to a project, as the project list returns it: fields of the link and of the repository
 * only, never the installation behind the connection.
 */
export const projectListRepositorySchema = z.object({
  projectRepositoryId: z.string(),
  connectionId: z.string(),
  integrationId: z.string(),
  repositoryId: z.string(),
  // These three are null when the repository row behind the link is missing.
  externalId: z.string().nullable(),
  slug: z.string().nullable(),
  defaultBranch: z.string().nullable(),
  /** The branch set on the link; null means the repository's default branch. */
  branch: z.string().nullable(),
});
export type ProjectListRepository = z.infer<typeof projectListRepositorySchema>;

const projectListItemSchema = projectSchema.and(z.object({ repositories: z.array(projectListRepositorySchema) }));
const workItemResponseSchema = z.object({ workItem: cardSchema });
const decisionResponseSchema = z.object({ decision: entitySchema });

export const createProjectBodySchema = z.object({
  name: nonEmptyTrimmed(200),
  description: nullableTrimmed(2_000).optional().default(null),
  defaultModelId: modelIdSchema.optional(),
  modelScope: z.enum(FACTORY_MODEL_SCOPES).optional(),
});

export const updateProjectBodySchema = z
  .object({
    name: nonEmptyTrimmed(200).optional(),
    description: nullableTrimmed(2_000).optional(),
    defaultModelId: modelIdSchema.optional(),
    modelScope: z.enum(FACTORY_MODEL_SCOPES).optional(),
    modelPacks: modelPacksSchema.optional(),
    defaultModelPackId: defaultModelPackIdSchema.optional(),
    /** @deprecated Ignored. Each board phase starts its own runs with `autoStart` and `autoStartWhen`. */
    autoRunEnabled: z.boolean().optional(),
    /** @deprecated Ignored. Plans are approved per board with `exitTool.autoApprove`; Work's always wait for a person. */
    autoApprovePlans: z.boolean().optional(),
    /** @deprecated Ignored. The review skill decides whether to publish its test check. */
    reviewTestChecksEnabled: z.boolean().optional(),
    /** @deprecated Ignored. A card is self-reviewed when its board has a self-review phase. */
    selfReviewEnabled: z.boolean().optional(),
  })
  .refine(input => Object.keys(input).length > 0, { message: 'At least one project field is required' })
  .transform(({ modelPacks, defaultModelPackId, ...fields }, ctx) => {
    if (modelPacks === undefined && defaultModelPackId === undefined) return { ...fields, modelPackSet: undefined };
    if (modelPacks === undefined || defaultModelPackId === undefined) {
      ctx.addIssue({ code: 'custom', message: 'Send modelPacks and defaultModelPackId together' });
      return z.NEVER;
    }
    const modelPackSet = { modelPacks, defaultModelPackId };
    const problem = modelPackSetProblem(modelPackSet);
    if (problem) {
      ctx.addIssue({ code: 'custom', message: problem });
      return z.NEVER;
    }
    return { ...fields, modelPackSet };
  });

const environmentBuildStatusSchema = z.enum(['pending', 'building', 'ready', 'failed', 'unknown']);

export const environmentBuildStartResponseSchema = z.object({
  outcome: z.enum(['started', 'skipped', 'unavailable', 'failed']),
  buildId: z.string().optional(),
  templateId: z.string().optional(),
  reason: z.string().optional(),
});

export const environmentBuildSchema = z.object({
  buildId: z.string(),
  status: environmentBuildStatusSchema,
  templateId: z.string().optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  error: z.string().optional(),
  logs: z.array(z.string()).optional(),
});

export const environmentBuildsResponseSchema = z.object({ builds: z.array(environmentBuildSchema) });
export const environmentBuildResponseSchema = z.object({ build: environmentBuildSchema });

const buildPathSchema = projectPathSchema.extend({ buildId: z.string().min(1) });

const stagesSchema = z
  .array(
    z
      .string()
      .max(64)
      .regex(/^[a-z0-9][a-z0-9_-]*$/i),
  )
  .min(1)
  .max(16)
  .refine(stages => new Set(stages).size === stages.length, { message: 'Stages must be unique' });

const externalSourceSchema = z
  .object({
    integrationId: z.string().min(1).max(128),
    type: z.string().min(1).max(128),
    externalId: z.string().min(1).max(512),
    url: z.string().max(2_048).optional(),
  })
  .nullable();

const sessionSchema = z.object({
  sessionId: z.string().min(1).max(512),
  branch: z.string().min(1).max(512),
  threadId: z.string().min(1).max(512),
});

const boundedLimitSchema = (defaultValue: number, max: number) =>
  z
    .string()
    .optional()
    .transform(value => {
      const parsed = value ? Number.parseInt(value, 10) : defaultValue;
      return Number.isFinite(parsed) ? Math.max(1, Math.min(max, parsed)) : defaultValue;
    });
/** Without `sessionId`, `scope`, `started`, `source` or `workItemId`, the list is the whole board. */
const workItemListQuerySchema = z
  .object({
    /** Repeatable. Narrows the list to the cards that hold these sessions and the cards related to them. */
    sessionId: z.array(sessionSchema.shape.sessionId).optional(),
    /** `sessions` narrows the list to the cards that hold any session and the cards related to them. */
    scope: z.enum(['sessions']).optional(),
    /** `false` narrows the list to the cards that hold no session, most recently updated first. */
    started: z.enum(['false']).optional(),
    /** With `started=false`: words the card must all answer, as the phases' `q` reads them. */
    q: z.string().max(200).optional(),
    /** With `started=false`: how many cards to send. */
    limit: boundedLimitSchema(20, 50),
    /** Repeatable. Narrows the list to the cards filed from these sources, each named by its id or its URL. */
    source: z.array(z.string().min(1).max(512)).min(1).max(100).optional(),
    /**
     * Repeatable. Narrows the list to the cards with these ids; an id no card has lists nothing.
     * Each card comes with the `version` the phases read names it by.
     */
    workItemId: z.array(uuidSchema).min(1).max(100).optional(),
    /**
     * The `cursor` of the whole board this reader holds: the answer is then what moved since. One
     * this server did not issue reads as none, and the board answers whole.
     */
    since: z
      .string()
      .regex(/^\d{1,15}$/)
      .optional()
      .catch(undefined),
  })
  .refine(query => !(query.scope && query.sessionId), {
    path: ['scope'],
    message: 'Send scope or sessionId, not both',
  })
  .refine(query => !(query.started && (query.scope || query.sessionId)), {
    path: ['started'],
    message: 'Send started without scope or sessionId',
  })
  .refine(query => query.q === undefined || query.started !== undefined, {
    path: ['q'],
    message: 'Send q only with started=false',
  })
  .refine(query => !(query.source && (query.started || query.scope || query.sessionId)), {
    path: ['source'],
    message: 'Send source without started, scope or sessionId',
  })
  .refine(query => !(query.workItemId && (query.source || query.started || query.scope || query.sessionId)), {
    path: ['workItemId'],
    message: 'Send workItemId without source, started, scope or sessionId',
  })
  // A narrowed list is not the board a cursor names, so it answers as it does without one.
  .transform(query =>
    query.sessionId || query.scope || query.started || query.source || query.workItemId
      ? { ...query, since: undefined }
      : query,
  );

export const workItemActivityQuerySchema = z.object({
  since: z.iso.datetime({ offset: true }).transform(since => Date.parse(since)),
});

const countSchema = z.number().int().nonnegative();

/** Repeatable. The values picked for one filter: a card matches on any of them, and none picks every card. */
const pickedValuesSchema = z
  .array(z.string().min(1).max(512))
  .max(100)
  .default([])
  .transform(values => new Set(values));

/** `<phase>:<count>`: how many cards of one phase to list. */
const phaseWindowSchema = z
  .string()
  .transform((entry): [phase: string, count: string] => {
    const colon = entry.lastIndexOf(':');
    return [entry.slice(0, Math.max(colon, 0)), entry.slice(colon + 1)];
  })
  .pipe(
    z.tuple([
      boardIdentifierSchema,
      z
        .string()
        .regex(/^[1-9]\d{0,5}$/)
        .transform(Number),
    ]),
  );

/** One view of a board: its order, its search and filters, and how deep each phase is listed. */
export const boardPhasesQuerySchema = z.object({
  /** `recent-mine` puts the cards the signed-in user last moved into the phase before the others. */
  sort: z.enum(BOARD_PHASES_SORTS).default('recent'),
  /**
   * Words the card must all answer: each one in its title, key, number or source id, or in the key of
   * a pull request attached to it, or naming its id or one of its branches whole. A number or key with
   * its `#` or `!` (`#12`, `acme/app#12`) is read whole: it never finds `#123`. A pasted link finds
   * the card carrying the issue or pull request it names, whatever page of it the link opens; a link
   * to a repository or project finds the cards it holds; a link to a Factory card finds that card.
   */
  q: z.string().max(200).optional(),
  /** A provider (`github`, `linear`, `manual`…), or `pull-request` for every card that has one. */
  source: pickedValuesSchema,
  /** Linear project ids. Picked without `source`, they keep Linear cards only. */
  linearProject: pickedValuesSchema,
  /** A card matches when it carries every one of them. */
  label: pickedValuesSchema,
  /**
   * `with` keeps cards that have a pull request: their own, one attached, or one held by another card
   * that names this card's issue as resolved (`closesWorkItemIds`). `without` keeps the others.
   */
  pullRequest: pickedValuesSchema,
  /**
   * `untrusted` keeps GitHub and GitLab cards whose author lacks write access, including those with no
   * trust stamp, as intake reads `item.trusted`. `trusted` keeps the rest: those authors, Factory, and
   * cards from sources no outsider can file (Linear, manual and similar).
   */
  trust: pickedValuesSchema,
  /** Participant ids (`github:octocat`, `factory:<user id>`) related to the card in any way. */
  teammate: pickedValuesSchema,
  author: pickedValuesSchema,
  assignee: pickedValuesSchema,
  reviewer: pickedValuesSchema,
  /** Factory users who created the card, moved it or started a session on it. */
  worked: pickedValuesSchema,
  /** How many cards each phase lists. */
  limit: boundedLimitSchema(50, 200),
  /**
   * Repeatable `<phase>:<count>`: lists that phase's first `count` cards instead of `limit`.
   * One for a phase the board does not have is ignored.
   */
  window: z
    .array(phaseWindowSchema)
    .max(64)
    .default([])
    .refine(windows => new Set(windows.map(([phase]) => phase)).size === windows.length, {
      message: 'Send one window per phase',
    })
    .transform(windows => new Map(windows)),
  /**
   * A card to answer for wherever it lies: the answer names it with its place in each phase, and
   * `cards=true` sends its body. No phase is listed deeper for it.
   */
  item: uuidSchema.optional(),
  /** `true` also sends the body of every card the answer names. */
  cards: z.enum(['true']).optional(),
});

type BoardPhasesQueryFilter = {
  [Field in keyof z.output<typeof boardPhasesQuerySchema>]-?: z.output<
    typeof boardPhasesQuerySchema
  >[Field] extends Set<string>
    ? Field
    : never;
}[keyof z.output<typeof boardPhasesQuerySchema>];
// The board's clients send BOARD_PHASES_FILTERS; this fails to compile when the query schema's filters drift from it.
const boardPhasesFiltersMatch: [BoardPhasesQueryFilter] extends [BoardPhasesFilter]
  ? [BoardPhasesFilter] extends [BoardPhasesQueryFilter]
    ? true
    : false
  : false = true;
void boardPhasesFiltersMatch;

export type BoardPhasesQuery = z.output<typeof boardPhasesQuerySchema>;

/** `<group key>:<count>`: how many rows of one group to list. Group keys hold colons, so the count follows the last. */
const sessionRowWindowSchema = z
  .string()
  .transform((entry): [group: string, count: string] => {
    const colon = entry.lastIndexOf(':');
    return [entry.slice(0, Math.max(colon, 0)), entry.slice(colon + 1)];
  })
  .pipe(
    z.tuple([
      z.string().min(1).max(512),
      z
        .string()
        .regex(/^[1-9]\d{0,2}$/)
        .transform(Number)
        .pipe(z.number().max(SESSION_ROW_WINDOW_MAX)),
    ]),
  );

const sessionIdQuerySchema = z.string().min(1).max(512);

export const sessionRowsQuerySchema = z.object({
  sort: z.enum(SESSION_ROW_SORTS).default('activity'),
  groupBy: z.enum(SESSION_ROW_GROUP_BYS).default('none'),
  /** `all`, `mine`, or `owner:<user id>`. */
  owner: sessionRowOwnerSchema.default(SESSION_ROW_ALL_OWNERS),
  status: z.enum(SESSION_ROW_STATUSES).optional(),
  updated: z.enum(SESSION_ROW_UPDATED_WITHIN).optional(),
  /** `board:<board id>`, `user` or `slack`: keeps the rows that start there. */
  source: sessionRowSourceSchema.optional(),
  /** `true` lists a card's other sessions under its row. */
  children: z.enum(['true']).optional(),
  /** Repeatable. Sessions listed before every other one of their group. */
  pin: z
    .array(sessionIdQuerySchema)
    .max(SESSION_ROW_PINS_MAX)
    .default([])
    .transform(ids => new Set(ids)),
  /** The session the reader has open: its group lists it however deep it lies. */
  open: sessionIdQuerySchema.optional(),
  /** Repeatable `<group key>:<count>`: lists that group's first `count` rows instead of `SESSION_ROW_WINDOW`. */
  window: z
    .array(sessionRowWindowSchema)
    .max(SESSION_ROW_WINDOWS_MAX)
    .default([])
    .refine(windows => new Set(windows.map(([group]) => group)).size === windows.length, {
      message: 'Send one window per group',
    })
    .transform(windows => new Map(windows)),
});

const sessionRowStatusSchema = z.enum(SESSION_ROW_STATUSES);

const changeRequestSchema = z.object({
  url: z.string().optional(),
  provider: z.enum(['github', 'gitlab']),
  number: z.number().optional(),
  status: z.enum(PULL_REQUEST_STATUSES).optional(),
  draft: z.boolean(),
  syncedAt: z.number().optional(),
}) satisfies z.ZodType<CardChangeRequest>;

const sessionRowFields = {
  session: z.object({
    id: z.string(),
    sessionId: z.string(),
    projectRepositoryId: z.string().nullable(),
    userId: z.string(),
    branch: z.string(),
    title: z.string().nullable(),
    visibility: z.enum(['org', 'private']),
    createdAt: z.string(),
    owner: z.object({ id: z.string(), name: z.string(), avatarUrl: z.string().optional() }).optional(),
  }),
  /** `factory` for a session the Factory runs on a card's branch, `user` for one a person or Slack started. */
  origin: z.enum(['factory', 'user']),
  board: z.string().optional(),
  status: sessionRowStatusSchema,
  /** The status of the card's whole row: its most urgent session's. */
  cardStatus: sessionRowStatusSchema.optional(),
  pinned: z.boolean(),
  /** The card's last change for a card's session, else the session's. */
  updatedAt: z.string(),
  card: z
    .object({
      id: z.string(),
      title: z.string(),
      workItemUrl: z.string().nullable(),
      externalSource: z
        .object({
          integrationId: z.string(),
          type: z.string(),
          externalId: z.string(),
          workspaceId: z.string().optional(),
          url: z.string().optional(),
        })
        .nullable(),
    })
    .optional(),
  itemId: z.string().optional(),
  threadId: z.string().optional(),
  pullRequest: changeRequestSchema.optional(),
  cardSessionIds: z.array(z.string()).optional(),
  phaseLabel: z.string().optional(),
  runByFactory: z.literal(true).optional(),
  /** A followed card's session waiting on a person. */
  waitingSessionId: z.string().optional(),
};

const sessionRowSchema = z.object({
  ...sessionRowFields,
  /** With `children=true`: the card's other sessions. */
  childRows: z.array(z.object(sessionRowFields)).optional(),
});

export const sessionRowsResponseSchema = z.object({
  /** Rows of the project, whatever the filters. */
  total: countSchema,
  matching: countSchema,
  groups: z.array(
    z.object({
      /** `board:<id>`, `user`, `slack`, `status:<status>`, `owner:<user id>` or `all`. */
      key: z.string(),
      /** Rows of this group that match the filters. */
      total: countSchema,
      openIndex: countSchema.optional(),
      /** The first of them in the view's order, keeping the open session. */
      rows: z.array(sessionRowSchema),
    }),
  ),
  /** Boards some row belongs to, whatever the filters. */
  boards: z.array(z.string()),
  /** People who own some row, whatever the filters. */
  owners: z.array(z.object({ userId: z.string(), name: z.string().optional(), avatarUrl: z.string().optional() })),
});

export type SessionRowsQuery = z.output<typeof sessionRowsQuerySchema>;
export type SessionRow = z.infer<typeof sessionRowSchema>;
export type SessionRowsResponse = z.infer<typeof sessionRowsResponseSchema>;

const sessionsSchema = z.record(z.string().min(1).max(64), sessionSchema);
const metadataSchema = z
  .union([z.record(z.string(), z.unknown()), z.null()])
  .refine(value => {
    try {
      return JSON.stringify(value).length <= 16 * 1024;
    } catch {
      return false;
    }
  }, 'Metadata exceeds 16 KiB')
  .transform(value => {
    if (value === null) return null;
    const {
      factoryRuleMaterializationKey: _materialization,
      factoryPullRequestReconciliation: _reconciliation,
      externalSourceMissingAt: _externalSourceMissingAt,
      ...metadata
    } = value;
    return metadata;
  });

export const createWorkItemBodySchema = z.object({
  title: rawBoundedTrimmed(500),
  description: descriptionSchema.optional(),
  board: z.string().min(1).max(128).optional(),
  externalSource: externalSourceSchema.optional(),
  parentWorkItemId: uuidSchema.nullable().optional(),
  stages: stagesSchema.optional(),
  sessions: sessionsSchema.optional(),
  metadata: metadataSchema.optional(),
});

export const updateWorkItemBodySchema = z
  .object({
    title: rawBoundedTrimmed(500).optional(),
    description: descriptionSchema.optional(),
    board: z.string().min(1).max(128).optional(),
    parentWorkItemId: uuidSchema.nullable().optional(),
    stages: stagesSchema.optional(),
    sessions: sessionsSchema.optional(),
    metadata: metadataSchema.optional(),
  })
  .refine(input => Object.keys(input).length > 0, { message: 'At least one work-item field is required' });

export const transitionBodySchema = z
  .object({
    board: z.string().max(MAX_BOARD_IDENTIFIER_LENGTH).regex(BOARD_IDENTIFIER_RE),
    stage: z.string().max(MAX_BOARD_IDENTIFIER_LENGTH).regex(BOARD_IDENTIFIER_RE),
    expectedRevision: z.number().int().min(1),
    requestId: trimmedUuidSchema,
    cause: nonEmptyTrimmed(256),
    reenter: z.unknown().optional(),
  })
  .transform(input => ({
    board: input.board,
    stage: input.stage,
    expectedRevision: input.expectedRevision,
    ingress: { type: 'human' as const, identity: input.requestId },
    cause: input.cause,
    ...(input.reenter === true ? { reenter: true } : {}),
  }));

export const startWorkItemBodySchema = z.object({
  sessionId: trimmedUuidSchema,
  threadTitle: nonEmptyTrimmed(512),
  kickoffKey: trimmedUuidSchema,
  workItem: z.object({
    id: trimmedUuidSchema,
    role: nonEmptyTrimmed(32),
    input: createWorkItemBodySchema,
  }),
});

export const automationRunStartBodySchema = z
  .object({
    requestId: trimmedUuidSchema,
    expectedRevision: z.number().int().min(1),
    // Checked against the card's board when the request arrives.
    role: nonEmptyTrimmed(32),
    skillName: nonEmptyTrimmed(128),
    arguments: nonEmptyTrimmed(4_096).optional(),
  })
  .strict();

export const metricsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

const decisionStatusSchema = z.enum([
  'pending',
  'proposed',
  'dismissed',
  'superseded',
  'leased',
  'retry',
  'succeeded',
  'failed',
]);
const decisionCursorSchema = z
  .string()
  .optional()
  .transform((value, context) => {
    if (!value) return undefined;
    try {
      const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
      if (
        !Array.isArray(decoded) ||
        decoded.length !== 2 ||
        typeof decoded[0] !== 'string' ||
        typeof decoded[1] !== 'string'
      ) {
        throw new Error('invalid cursor');
      }
      const createdAt = new Date(decoded[0]);
      if (Number.isNaN(createdAt.getTime()) || !new RegExp(UUID_PATTERN).test(decoded[1])) {
        throw new Error('invalid cursor');
      }
      return { createdAt, id: decoded[1] };
    } catch {
      context.addIssue({ code: 'custom', message: 'Invalid cursor' });
      return z.NEVER;
    }
  });

export const decisionQuerySchema = z.object({
  statuses: z
    .string()
    .optional()
    .transform(value => {
      if (!value) return undefined;
      const statuses = [...new Set(value.split(',').map(status => status.trim()))].filter(
        status => decisionStatusSchema.safeParse(status).success,
      ) as Array<z.infer<typeof decisionStatusSchema>>;
      return statuses.length > 0 ? statuses : undefined;
    }),
  before: decisionCursorSchema,
  limit: boundedLimitSchema(25, 50),
});

const attentionKindSchema = z.enum(['automation-failed', 'automation-proposed', 'agent-waiting']);
type AttentionKind = z.infer<typeof attentionKindSchema>;
type AttentionStreamPosition = { occurredAt: Date; id: string };
type AttentionCursorMap = Map<AttentionKind, AttentionStreamPosition | undefined>;

function parseAttentionStreamPosition(value: unknown): AttentionStreamPosition | undefined {
  if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'string' || typeof value[1] !== 'string') {
    return undefined;
  }
  const occurredAt = new Date(value[0]);
  if (Number.isNaN(occurredAt.getTime()) || !new RegExp(UUID_PATTERN).test(value[1])) return undefined;
  return { occurredAt, id: value[1] };
}

const attentionCursorSchema = z
  .string()
  .optional()
  .transform((value, context) => {
    if (!value) return undefined;
    try {
      const decoded: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
      if (Array.isArray(decoded)) {
        const legacy = parseAttentionStreamPosition(decoded);
        if (!legacy) throw new Error('invalid cursor');
        return new Map<AttentionKind, AttentionStreamPosition | undefined>([['automation-failed', legacy]]);
      }
      if (!decoded || typeof decoded !== 'object') throw new Error('invalid cursor');
      const cursors: AttentionCursorMap = new Map();
      for (const [kind, positionValue] of Object.entries(decoded)) {
        const parsedKind = attentionKindSchema.safeParse(kind);
        if (!parsedKind.success) throw new Error('invalid cursor');
        if (positionValue === null) {
          cursors.set(parsedKind.data, undefined);
          continue;
        }
        const position = parseAttentionStreamPosition(positionValue);
        if (!position) throw new Error('invalid cursor');
        cursors.set(parsedKind.data, position);
      }
      if (cursors.size === 0) throw new Error('invalid cursor');
      return cursors;
    } catch {
      context.addIssue({ code: 'custom', message: 'Invalid cursor' });
      return z.NEVER;
    }
  });

export const attentionQuerySchema = z.object({
  view: z.enum(['open', 'unread', 'archived']).optional().default('open'),
  kind: z.array(attentionKindSchema).optional(),
  before: attentionCursorSchema,
  limit: boundedLimitSchema(25, 50),
  search: z
    .string()
    .optional()
    .transform(value => value?.trim().toLowerCase().slice(0, 200) || undefined),
});

const attentionActionPathSchema = z
  .object({
    id: uuidSchema,
    kind: attentionKindSchema,
    sourceId: z.string().min(1).max(256),
    occurrence: z
      .string()
      .regex(/^(0|[1-9]\d*)$/)
      .transform((value, context) => {
        const occurrence = Number(value);
        if (Number.isSafeInteger(occurrence)) return occurrence;
        context.addIssue({ code: 'custom', message: 'Invalid occurrence' });
        return z.NEVER;
      }),
  })
  .refine(input => new RegExp(UUID_PATTERN).test(input.sourceId), {
    message: 'Invalid attention source id',
    path: ['sourceId'],
  });

/** Largest SKILL.md a project may save as an edit. */
export const MAX_SKILL_OVERRIDE_LENGTH = 200_000;

const skillNameSchema = z
  .string()
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const skillPathSchema = z.object({ id: uuidSchema, name: skillNameSchema });
const skillResponseSchema = z.object({ skill: entitySchema });
/** `skill` is null when the request deleted a skill the project created. */
const skillRevertResponseSchema = z.object({ skill: entitySchema.nullable() });

/** Adds the runtime's SKILL.md validation errors, checking the frontmatter name against `directoryName` when given. */
function refineSkillContent(content: string, context: z.RefinementCtx, directoryName?: string) {
  const result = validateSkillContent({ content, directoryName });
  for (const message of result.errors) context.addIssue({ code: 'custom', message, path: ['content'] });
}

const skillContentSchema = z.string().min(1).max(MAX_SKILL_OVERRIDE_LENGTH);

export const skillOverrideBodySchema = z
  .object({ content: skillContentSchema })
  .strict()
  .superRefine((input, context) => refineSkillContent(input.content, context));

/**
 * The full save request: the edited SKILL.md must load under the skill's own
 * name, exactly as the runtime validates it.
 */
export const skillOverrideSaveRequestSchema = skillPathSchema
  .extend({ content: skillContentSchema })
  .superRefine((input, context) => refineSkillContent(input.content, context, input.name));

/** A new skill's SKILL.md must load under the name it is created with, exactly as the runtime validates it. */
export const skillCreateBodySchema = z
  .object({ name: skillNameSchema, content: skillContentSchema })
  .strict()
  .superRefine((input, context) => refineSkillContent(input.content, context, input.name));

export const FACTORY_ROUTE_CONTRACTS = {
  projectList: {
    method: 'GET',
    path: '/web/factory/projects',
    description: 'List Factory projects for the current organization, each with its linked repositories',
    responseSchema: z.object({ projects: z.array(projectListItemSchema) }),
  },
  projectCreate: {
    method: 'POST',
    path: '/web/factory/projects',
    description:
      'Create a Factory project. Creating a second project in an organization is deprecated: each organization will have one Factory project.',
    bodySchema: createProjectBodySchema,
    responseSchema: projectResponseSchema,
  },
  projectGet: {
    method: 'GET',
    path: '/web/factory/projects/:id',
    description: 'Get a Factory project',
    pathSchema: projectPathSchema,
    responseSchema: projectResponseSchema,
  },
  projectUpdate: {
    method: 'PATCH',
    path: '/web/factory/projects/:id',
    description: 'Update a Factory project',
    pathSchema: projectPathSchema,
    bodySchema: updateProjectBodySchema,
    responseSchema: projectResponseSchema,
  },
  projectEnvironmentGet: {
    method: 'GET',
    path: '/web/factory/projects/:id/environment',
    description: 'Get the sandbox environment of a Factory project: provider settings and its repositories in order',
    pathSchema: projectPathSchema,
    responseSchema: projectEnvironmentResponseSchema,
  },
  projectEnvironmentUpdate: {
    method: 'PATCH',
    path: '/web/factory/projects/:id/environment',
    description: 'Update the sandbox environment of a Factory project: provider settings, repository order and setup',
    pathSchema: projectPathSchema,
    bodySchema: updateProjectEnvironmentBodySchema,
    responseSchema: projectEnvironmentResponseSchema,
  },
  projectEnvironmentBuild: {
    method: 'POST',
    path: '/web/factory/projects/:id/environment/build',
    description: 'Build the sandbox environment template of a Factory project now',
    pathSchema: projectPathSchema,
    responseSchema: environmentBuildStartResponseSchema,
  },
  projectEnvironmentBuilds: {
    method: 'GET',
    path: '/web/factory/projects/:id/environment/builds',
    description:
      'List the environment template builds of a Factory project, newest first, when the provider keeps history',
    pathSchema: projectPathSchema,
    responseSchema: environmentBuildsResponseSchema,
  },
  projectEnvironmentBuildGet: {
    method: 'GET',
    path: '/web/factory/projects/:id/environment/builds/:buildId',
    description: 'Get the live status of one environment template build of a Factory project',
    pathSchema: buildPathSchema,
    responseSchema: environmentBuildResponseSchema,
  },
  projectSandboxEnvsList: {
    method: 'GET',
    path: '/web/factory/projects/:id/sandbox-envs',
    description:
      'List the sandbox environment variables of a Factory project: names and where they apply, never values',
    pathSchema: projectPathSchema,
    responseSchema: sandboxEnvsListResponseSchema,
  },
  projectSandboxEnvSet: {
    method: 'PUT',
    path: '/web/factory/projects/:id/sandbox-envs/:name',
    description: 'Create or replace a sandbox environment variable of a Factory project',
    pathSchema: sandboxEnvPathSchema,
    bodySchema: sandboxEnvSetBodySchema,
    responseSchema: sandboxEnvResponseSchema,
  },
  projectSandboxEnvUpdate: {
    method: 'PATCH',
    path: '/web/factory/projects/:id/sandbox-envs/:name',
    description: 'Change where a sandbox environment variable of a Factory project applies',
    pathSchema: sandboxEnvPathSchema,
    bodySchema: sandboxEnvUpdateBodySchema,
    responseSchema: sandboxEnvResponseSchema,
  },
  projectSandboxEnvDelete: {
    method: 'DELETE',
    path: '/web/factory/projects/:id/sandbox-envs/:name',
    description: 'Delete a sandbox environment variable of a Factory project',
    pathSchema: sandboxEnvPathSchema,
    responseSchema: z.null(),
  },
  projectDelete: {
    method: 'DELETE',
    path: '/web/factory/projects/:id',
    description: 'Delete a Factory project',
    pathSchema: projectPathSchema,
    responseSchema: z.null(),
  },
  metricsGet: {
    method: 'GET',
    path: '/web/factory/projects/:id/metrics',
    description: 'Get Factory project metrics',
    pathSchema: projectPathSchema,
    querySchema: metricsQuerySchema,
    responseSchema: z.object({ metrics: entitySchema }),
  },
  healthThresholdsGet: {
    method: 'GET',
    path: '/web/factory/projects/:id/health/thresholds',
    description: 'Get queue-health thresholds',
    pathSchema: projectPathSchema,
    responseSchema: z.object({ thresholds: z.array(z.number().finite()) }),
  },
  boardCatalog: {
    method: 'GET',
    path: '/web/factory/projects/:id/boards',
    description: 'List installed Factory boards',
    pathSchema: projectPathSchema,
    responseSchema: boardCatalogResponseSchema,
  },
  boardGet: {
    method: 'GET',
    path: '/web/factory/projects/:id/boards/:boardKey',
    description: "Get a project board's definition",
    pathSchema: boardPathSchema,
    responseSchema: storedBoardResponseSchema,
  },
  boardPhases: {
    method: 'GET',
    path: '/web/factory/projects/:id/boards/:boardKey/phases',
    description: 'List the cards under each phase of a board view, in order, with how many match',
    pathSchema: boardPathSchema,
    querySchema: boardPhasesQuerySchema,
    responseSchema: boardPhasesResponseSchema,
  },
  boardCreate: {
    method: 'POST',
    path: '/web/factory/projects/:id/boards',
    description: 'Create a board in a Factory project',
    pathSchema: projectPathSchema,
    bodySchema: storedBoardInputSchema,
    responseSchema: storedBoardResponseSchema,
  },
  boardReplace: {
    method: 'PATCH',
    path: '/web/factory/projects/:id/boards/:boardKey',
    description: "Replace a project board's definition",
    pathSchema: boardPathSchema,
    bodySchema: replaceBoardBodySchema,
    responseSchema: storedBoardResponseSchema,
  },
  boardReset: {
    method: 'POST',
    path: '/web/factory/projects/:id/boards/:boardKey/reset',
    description: 'Reset a built-in or app board to its code definition',
    pathSchema: boardPathSchema,
    bodySchema: boardResetBodySchema,
    responseSchema: storedBoardResponseSchema,
  },
  boardDelete: {
    method: 'DELETE',
    path: '/web/factory/projects/:id/boards/:boardKey',
    description: 'Delete a board from a Factory project',
    pathSchema: boardPathSchema,
    querySchema: boardDeleteQuerySchema,
    responseSchema: z.null(),
  },
  intakeRouteList: {
    method: 'GET',
    path: '/web/factory/projects/:id/intake-routes',
    description: "List a Factory project's intake routes in evaluation order",
    pathSchema: projectPathSchema,
    querySchema: intakeRouteListQuerySchema,
    responseSchema: intakeRouteListResponseSchema,
  },
  intakeRouteGet: {
    method: 'GET',
    path: '/web/factory/projects/:id/intake-routes/:routeId',
    description: 'Get a Factory intake route',
    pathSchema: intakeRoutePathSchema,
    responseSchema: intakeRouteResponseSchema,
  },
  intakeRouteCreate: {
    method: 'POST',
    path: '/web/factory/projects/:id/intake-routes',
    description:
      'Add an intake route to a Factory project, after its routes; a route that places new cards goes ahead of the first route that takes every new card',
    pathSchema: projectPathSchema,
    bodySchema: intakeRouteInputSchema,
    responseSchema: intakeRouteResponseSchema,
  },
  intakeRouteUpdate: {
    method: 'PATCH',
    path: '/web/factory/projects/:id/intake-routes/:routeId',
    description: 'Change a Factory intake route',
    pathSchema: intakeRoutePathSchema,
    bodySchema: intakeRoutePatchSchema,
    responseSchema: intakeRouteResponseSchema,
  },
  intakeRouteDelete: {
    method: 'DELETE',
    path: '/web/factory/projects/:id/intake-routes/:routeId',
    description: 'Delete a Factory intake route',
    pathSchema: intakeRoutePathSchema,
    querySchema: boardDeleteQuerySchema,
    responseSchema: z.null(),
  },
  intakeRouteReroutePreview: {
    method: 'GET',
    path: '/web/factory/projects/:id/intake-routes/reroute',
    description: "Untouched cards the project's intake routes would now file on a different board",
    pathSchema: projectPathSchema,
    responseSchema: intakeRerouteResponseSchema,
  },
  intakeRouteRerouteApply: {
    method: 'POST',
    path: '/web/factory/projects/:id/intake-routes/reroute',
    description: "Move untouched cards to the start of the board the project's intake routes now file them on",
    pathSchema: projectPathSchema,
    responseSchema: intakeRerouteApplyResponseSchema,
  },
  intakeRouteReorder: {
    method: 'POST',
    path: '/web/factory/projects/:id/intake-routes/reorder',
    description: "Reorder a Factory project's intake routes",
    pathSchema: projectPathSchema,
    bodySchema: intakeRouteReorderBodySchema,
    responseSchema: intakeRouteListResponseSchema,
  },
  intakeOrderGet: {
    method: 'GET',
    path: '/web/factory/projects/:id/intake-order',
    description: "The order a Factory project's boards are asked to take a new item, and the evaluator in use",
    pathSchema: projectPathSchema,
    responseSchema: intakeOrderResponseSchema,
  },
  intakeOrderUpdate: {
    method: 'PUT',
    path: '/web/factory/projects/:id/intake-order',
    description: "Set the order a Factory project's boards are asked to take a new item, or its evaluator",
    pathSchema: projectPathSchema,
    bodySchema: intakeOrderBodySchema,
    responseSchema: intakeOrderResponseSchema,
  },
  intakeNotRoutedList: {
    method: 'GET',
    path: '/web/factory/projects/:id/intake/not-routed',
    description: "Items no board's intake rules took, oldest first, a page at a time",
    pathSchema: projectPathSchema,
    querySchema: intakeNotRoutedQuerySchema,
    responseSchema: intakeNotRoutedResponseSchema,
  },
  intakeRouteAgain: {
    method: 'POST',
    path: '/web/factory/projects/:id/intake/not-routed/:decisionId/route-again',
    description: 'Run intake again for an item no board took, filing it where the rules now say',
    pathSchema: intakeDecisionPathSchema,
    responseSchema: intakeRouteAgainResponseSchema,
  },
  intakeSkippedList: {
    method: 'GET',
    path: '/web/factory/projects/:id/intake/skipped',
    description: 'How often each card-move rule was skipped in the last 30 days, with its newest skip',
    pathSchema: projectPathSchema,
    responseSchema: intakeSkippedResponseSchema,
  },
  intakeDryRun: {
    method: 'POST',
    path: '/web/factory/projects/:id/intake/dry-run',
    description:
      "Run a Factory project's intake rules, saved or unsaved, over its newest 200 items without filing anything",
    pathSchema: projectPathSchema,
    bodySchema: intakeDryRunBodySchema,
    responseSchema: intakeDryRunResponseSchema,
  },
  intakeTest: {
    method: 'POST',
    path: '/web/factory/projects/:id/intake/test',
    description: 'Show where intake would file one item, and what every rule answered, without filing it',
    pathSchema: projectPathSchema,
    bodySchema: intakeTestBodySchema,
    responseSchema: intakeTestResponseSchema,
  },
  workItemList: {
    method: 'GET',
    path: '/web/factory/projects/:id/work-items',
    description: 'List Factory work items',
    pathSchema: projectPathSchema,
    querySchema: workItemListQuerySchema,
    responseSchema: workItemListResponseSchema,
  },
  workItemStarters: {
    method: 'GET',
    path: '/web/factory/projects/:id/work-items/starters',
    description: 'Count the cards behind each new-session starter on the default board',
    pathSchema: projectPathSchema,
    responseSchema: workItemStartersResponseSchema,
  },
  workItemActivity: {
    method: 'GET',
    path: '/web/factory/projects/:id/work-items/activity',
    description: 'List when cards were created and completed since an instant',
    pathSchema: projectPathSchema,
    querySchema: workItemActivityQuerySchema,
    responseSchema: workItemActivityResponseSchema,
  },
  workItemFilterOptions: {
    method: 'GET',
    path: '/web/factory/projects/:id/work-items/filter-options',
    description: 'List the labels and people the cards of a project can be filtered by',
    pathSchema: projectPathSchema,
    responseSchema: workItemFilterOptionsResponseSchema,
  },
  sessionRows: {
    method: 'GET',
    path: '/web/factory/projects/:id/session-rows',
    description: "List the sidebar's session rows of a view, grouped and in order, with how many match",
    pathSchema: projectPathSchema,
    querySchema: sessionRowsQuerySchema,
    responseSchema: sessionRowsResponseSchema,
  },
  sessionActivity: {
    method: 'GET',
    path: '/web/factory/projects/:id/session-activity',
    description: "List which of a project's sessions are running or waiting on a person, and each card's status",
    pathSchema: projectPathSchema,
    responseSchema: sessionActivityResponseSchema,
  },
  workItemCreate: {
    method: 'POST',
    path: '/web/factory/projects/:id/work-items',
    description: 'Create a work item in Intake',
    pathSchema: projectPathSchema,
    bodySchema: createWorkItemBodySchema,
    responseSchema: workItemResponseSchema,
  },
  workItemUpdate: {
    method: 'PATCH',
    path: '/web/factory/work-items/:id',
    description: 'Update non-stage work-item fields',
    pathSchema: workItemPathSchema,
    bodySchema: updateWorkItemBodySchema,
    responseSchema: workItemResponseSchema,
  },
  workItemDelete: {
    method: 'DELETE',
    path: '/web/factory/work-items/:id',
    description: 'Delete a Factory work item',
    pathSchema: workItemPathSchema,
    responseSchema: z.object({ ok: z.literal(true) }),
  },
  workItemTransition: {
    method: 'POST',
    path: '/web/factory/projects/:id/work-items/:workItemId/transition',
    description:
      "Transition a work item with its expected revision; naming a board other than the card's moves it to that board's phase. Answers 202 with an inputId when the board's engine settles the move later; the project's feed-events stream then carries a `move` frame for that inputId",
    pathSchema: transitionPathSchema,
    bodySchema: transitionBodySchema,
    responseSchema: entitySchema,
  },
  workItemWorkingPullRequest: {
    method: 'PUT',
    path: '/web/factory/projects/:id/work-items/:workItemId/working-pull-request',
    description:
      "Make one of the pull requests linked to a card the one its sessions work on. The only way an outside author's pull request becomes a card's working pull request.",
    pathSchema: transitionPathSchema,
    bodySchema: z.object({
      pullRequest: z.number().int().positive(),
      expectedRevision: z.number().int().nonnegative(),
    }),
    responseSchema: workItemResponseSchema,
  },
  workItemSessionRepository: {
    method: 'GET',
    path: '/web/factory/projects/:id/work-items/:workItemId/session-repository',
    description: "The repository a session on the card is filed under, resolved as the card's runs resolve it",
    pathSchema: transitionPathSchema,
    responseSchema: workItemSessionRepositoryResponseSchema,
  },
  workItemStart: {
    method: 'POST',
    path: '/web/factory/projects/:id/runs/start',
    description: 'Explicitly start a Factory work-item run',
    pathSchema: projectPathSchema,
    bodySchema: startWorkItemBodySchema,
    responseSchema: entitySchema,
  },
  workItemAutomationRun: {
    method: 'POST',
    path: '/web/factory/projects/:id/work-items/:workItemId/automation-runs',
    description: 'Enqueue an idempotent deferred skill dispatch for a trusted external orchestrator',
    pathSchema: transitionPathSchema,
    bodySchema: automationRunStartBodySchema,
    responseSchema: entitySchema,
  },
  decisionList: {
    method: 'GET',
    path: '/web/factory/projects/:id/decisions',
    description: 'List Factory decisions',
    pathSchema: projectPathSchema,
    querySchema: decisionQuerySchema,
    responseSchema: decisionListResponseSchema,
  },
  runQueue: {
    method: 'GET',
    path: '/web/factory/projects/:id/run-queue',
    description:
      "List the project's automated runs waiting for a run slot, oldest first, and the runs holding one. The cap is per server process; manual starts are claimed ahead of this queue.",
    pathSchema: projectPathSchema,
    responseSchema: runQueueResponseSchema,
  },
  decisionApprove: {
    method: 'POST',
    path: '/web/factory/projects/:id/decisions/:decisionId/approve',
    description: 'Approve a proposed Factory decision',
    pathSchema: projectDecisionPathSchema,
    responseSchema: decisionResponseSchema,
  },
  decisionDismiss: {
    method: 'POST',
    path: '/web/factory/projects/:id/decisions/:decisionId/dismiss',
    description: 'Dismiss a proposed Factory decision',
    pathSchema: projectDecisionPathSchema,
    responseSchema: decisionResponseSchema,
  },
  decisionRetry: {
    method: 'POST',
    path: '/web/factory/projects/:id/decisions/:decisionId/retry',
    description: 'Retry a failed retryable Factory decision',
    pathSchema: projectDecisionPathSchema,
    responseSchema: decisionResponseSchema,
  },
  attentionList: {
    method: 'GET',
    path: '/web/factory/projects/:id/attention',
    description: 'List the Factory attention inbox',
    pathSchema: projectPathSchema,
    querySchema: attentionQuerySchema,
    responseSchema: z.object({
      items: z.array(entitySchema),
      kinds: z.record(
        attentionKindSchema,
        z.object({
          open: z.number(),
          unread: z.number(),
          latest: z.object({ key: z.string(), at: z.string(), unread: z.boolean() }).nullable(),
        }),
      ),
      hasMore: z.boolean(),
      nextCursor: z.string().optional(),
    }),
  },
  attentionReadAll: {
    method: 'POST',
    path: '/web/factory/projects/:id/attention/read-all',
    description: 'Mark all Factory attention as read',
    pathSchema: projectPathSchema,
    querySchema: z.object({ before: attentionCursorSchema }),
    responseSchema: z.object({ ok: z.literal(true), hasMore: z.boolean(), nextCursor: z.string().optional() }),
  },
  attentionRead: {
    method: 'POST',
    path: '/web/factory/projects/:id/attention/:kind/:sourceId/:occurrence/read',
    description: 'Mark a Factory attention receipt as read',
    pathSchema: attentionActionPathSchema,
    responseSchema: z.object({ receipt: entitySchema }),
  },
  attentionArchive: {
    method: 'POST',
    path: '/web/factory/projects/:id/attention/:kind/:sourceId/:occurrence/archive',
    description: 'Archive a Factory attention receipt',
    pathSchema: attentionActionPathSchema,
    responseSchema: z.object({ receipt: entitySchema }),
  },
  attentionRestore: {
    method: 'POST',
    path: '/web/factory/projects/:id/attention/:kind/:sourceId/:occurrence/restore',
    description: 'Restore an archived Factory attention receipt',
    pathSchema: attentionActionPathSchema,
    responseSchema: z.object({ receipt: entitySchema }),
  },
  skillList: {
    method: 'GET',
    path: '/web/factory/skills',
    description: "List Factory skills, with a project's edits when a project is given",
    querySchema: z.object({ projectId: uuidSchema.optional() }),
    responseSchema: z.object({ skills: z.array(entitySchema), canEdit: z.boolean().optional() }),
  },
  skillCreate: {
    method: 'POST',
    path: '/web/factory/projects/:id/skills',
    description: 'Create a skill for one Factory project',
    pathSchema: projectPathSchema,
    bodySchema: skillCreateBodySchema,
    responseSchema: skillResponseSchema,
  },
  skillOverrideSave: {
    method: 'PUT',
    path: '/web/factory/projects/:id/skills/:name',
    description: "Save a project's SKILL.md for a Factory skill: an edit of an app skill, or a skill it created",
    pathSchema: skillPathSchema,
    bodySchema: skillOverrideBodySchema,
    responseSchema: skillResponseSchema,
  },
  skillOverrideRevert: {
    method: 'DELETE',
    path: '/web/factory/projects/:id/skills/:name',
    description:
      "Revert a project's edited Factory skill to its original SKILL.md, or delete a skill the project created",
    pathSchema: skillPathSchema,
    responseSchema: skillRevertResponseSchema,
  },
} as const satisfies Record<string, FactoryRouteContract>;

export type FactoryRouteContractKey = keyof typeof FACTORY_ROUTE_CONTRACTS;

export { sessionActivityResponseSchema };
export type { SessionActivityResponse };
