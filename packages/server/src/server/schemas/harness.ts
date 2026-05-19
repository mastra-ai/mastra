import { z } from 'zod/v4';

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const jsonRecordSchema = z.record(z.string(), jsonValueSchema);

const includeClosedSchema = z
  .preprocess(value => {
    if (value === undefined) return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  }, z.boolean())
  .optional();

export const harnessNamePathParams = z.object({
  name: z.string().min(1).describe('Harness registration name'),
});

export const harnessSessionPathParams = harnessNamePathParams.extend({
  sessionId: z.string().min(1).describe('Harness session id'),
});

export const listHarnessSessionsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  includeClosed: includeClosedSchema,
});

export const createHarnessSessionBodySchema = z
  .object({
    sessionId: z.string().min(1).optional(),
    threadId: z.union([z.string().min(1), z.object({ fresh: z.literal(true) }).strict()]).optional(),
    parentSessionId: z.string().min(1).optional(),
    origin: z.literal('top-level').optional(),
    modeId: z.string().min(1).optional(),
    modelId: z.string().min(1).optional(),
  })
  .strict();

const lifecycleSchema = z.enum(['active', 'closing', 'closed']);

const pendingInboxSummarySchema = z.object({
  count: z.number(),
  kinds: z.array(z.enum(['tool-approval', 'tool-suspension', 'question', 'plan-approval'])),
  sessionOwnedOnly: z.literal(true),
});

const durableWorkListSummarySchema = z.object({
  activeCount: z.number(),
  waitingCount: z.number(),
  retryingCount: z.number(),
  failedCount: z.number(),
  latest: z
    .object({
      kind: z.string(),
      status: z.string(),
      sourceDurability: z.enum(['durable', 'best-effort', 'live-only']),
      proof: z.object({ kind: z.string(), id: z.string() }),
      updatedAt: z.number().optional(),
      lastError: z.object({ code: z.string(), retryable: z.boolean().optional() }).optional(),
    })
    .optional(),
  sessionOwnedOnly: z.literal(true),
});

export const harnessSessionListItemSchema = z.object({
  sessionId: z.string(),
  harnessName: z.string(),
  resourceId: z.string(),
  threadId: z.string(),
  parentSessionId: z.string().optional(),
  lifecycle: lifecycleSchema,
  createdAt: z.number(),
  lastActivityAt: z.number(),
  closingAt: z.number().optional(),
  closeDeadlineAt: z.number().optional(),
  closedAt: z.number().optional(),
  modeId: z.string(),
  modelId: z.string(),
  busy: z.boolean(),
  queueDepth: z.number(),
  pendingInbox: pendingInboxSummarySchema,
  durableWork: durableWorkListSummarySchema,
  goal: z
    .object({
      id: z.string(),
      status: z.enum(['active', 'paused', 'done']),
      turnsUsed: z.number(),
      maxTurns: z.number(),
      lastDecision: z
        .object({
          decision: z.enum(['done', 'continue', 'waiting']),
          judgedAt: z.number(),
        })
        .optional(),
    })
    .optional(),
});

export const listHarnessSessionsResponseSchema = z.object({
  items: z.array(harnessSessionListItemSchema),
  nextCursor: z.string().optional(),
  truncated: z.boolean(),
});

export const harnessSessionSnapshotSchema = z.object({
  summary: harnessSessionListItemSchema,
  state: jsonValueSchema,
  queue: z.object({
    depth: z.number(),
    queuedItemIds: z.array(z.string()),
  }),
  pendingInbox: z.array(z.unknown()),
  durableWork: z.object({
    active: z.array(z.unknown()),
    recentTerminal: z.array(z.unknown()),
    truncated: z.boolean(),
    nextCursor: z.string().optional(),
    sessionOwnedOnly: z.literal(true),
  }),
  displayState: z.unknown().optional(),
  goal: z.unknown().nullable().optional(),
  channelBindings: z.array(z.unknown()),
  tokenUsage: z.object({
    promptTokens: z.number(),
    completionTokens: z.number(),
    totalTokens: z.number(),
  }),
  messages: z.object({
    cursor: z.object({
      threadId: z.string(),
      route: z.literal('thread-messages'),
      cursor: z.string().optional(),
    }),
    recent: z
      .object({
        messages: z.array(z.unknown()),
        nextCursor: z.string().optional(),
        truncated: z.boolean(),
      })
      .optional(),
  }),
});

export const createHarnessSessionResponseSchema = z.object({
  session: harnessSessionSnapshotSchema,
});

export const harnessErrorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean().optional(),
  details: jsonRecordSchema.optional(),
});
