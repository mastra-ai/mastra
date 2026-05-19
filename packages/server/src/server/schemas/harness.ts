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

export const harnessInboxPathParams = harnessSessionPathParams.extend({
  itemId: z.string().min(1).describe('Pending inbox item id'),
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

const attachmentRefSchema = z
  .object({
    attachmentId: z.string().min(1),
    resourceId: z.string().min(1),
    ownerSessionId: z.string().min(1).optional(),
    bytes: z.number().int().nonnegative().optional(),
    sha256: z.string().min(1).optional(),
    source: z.enum(['inline', 'preupload', 'url', 'provider']).optional(),
    kind: z.enum(['file', 'primitive', 'element']).optional(),
    name: z.string().min(1).optional(),
    mimeType: z.string().min(1).optional(),
    primitiveType: z.string().min(1).optional(),
    elementType: z.string().min(1).optional(),
    renderer: jsonRecordSchema.optional(),
    schemaId: z.string().min(1).optional(),
    metadata: jsonRecordSchema.optional(),
    object: jsonRecordSchema.optional(),
  })
  .strict();

export const harnessMessageAdmissionBodySchema = z
  .object({
    content: z.string().min(1),
    admissionId: z.string().min(1),
    mode: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    attachments: z.array(attachmentRefSchema).optional(),
  })
  .strict();

export const harnessMessageAdmissionResponseSchema = z.object({
  accepted: z.literal(true),
  signalId: z.string(),
  runId: z.string().optional(),
  duplicate: z.boolean(),
});

export const harnessQueueAdmissionBodySchema = z
  .object({
    content: z.string().min(1),
    admissionId: z.string().min(1),
    mode: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    yolo: z.boolean().optional(),
    attachments: z.array(attachmentRefSchema).optional(),
  })
  .strict();

export const harnessQueueAdmissionResponseSchema = z.object({
  accepted: z.literal(true),
  queuedItemId: z.string(),
  duplicate: z.boolean(),
});

export const harnessStatePatchSchema = jsonRecordSchema;

export const harnessModePatchSchema = z
  .object({
    mode: z.string().min(1),
  })
  .strict();

export const harnessModeResponseSchema = z.object({
  modeId: z.string(),
});

export const harnessModelPatchSchema = z
  .object({
    model: z.string().min(1),
  })
  .strict();

export const harnessModelResponseSchema = z.object({
  modelId: z.string(),
});

export const harnessPermissionPatchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('grantCategory'), category: z.string().min(1) }).strict(),
  z.object({ action: z.literal('grantTool'), toolName: z.string().min(1) }).strict(),
  z.object({ action: z.literal('revokeCategory'), category: z.string().min(1) }).strict(),
  z.object({ action: z.literal('revokeTool'), toolName: z.string().min(1) }).strict(),
  z
    .object({
      action: z.literal('setPolicy'),
      category: z.string().min(1).optional(),
      toolName: z.string().min(1).optional(),
      policy: z.enum(['allow', 'ask', 'deny']),
    })
    .strict()
    .refine(value => (value.category === undefined) !== (value.toolName === undefined), {
      message: 'setPolicy requires exactly one of category or toolName',
      path: ['category'],
    }),
]);

export const harnessPermissionsResponseSchema = z.object({
  grants: z.object({
    categories: z.array(z.string()),
    tools: z.array(z.string()),
  }),
  rules: z.object({
    categories: z.record(z.string(), z.enum(['allow', 'ask', 'deny'])),
    tools: z.record(z.string(), z.enum(['allow', 'ask', 'deny'])),
  }),
});

export const harnessInboxResponseBodySchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('tool-approval'),
      approved: z.boolean(),
      reason: z.string().optional(),
      responseId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('tool-suspension'),
      resumeData: jsonValueSchema,
      responseId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('question'),
      answer: jsonValueSchema,
      responseId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('plan-approval'),
      approved: z.boolean(),
      revision: z.string().optional(),
      responseId: z.string().min(1),
      transitionToMode: z.string().min(1).optional(),
    })
    .strict(),
]);

export const harnessInboxResponseResultSchema = z.object({
  itemId: z.string(),
  kind: z.enum(['tool-approval', 'tool-suspension', 'question', 'plan-approval']),
  status: z.enum(['accepted', 'applied']),
  responseId: z.string(),
  duplicate: z.boolean(),
});

export const harnessGoalSchema = z.object({
  id: z.string(),
  objective: z.string(),
  status: z.enum(['active', 'paused', 'done']),
  turnsUsed: z.number(),
  maxTurns: z.number(),
  judgeModelId: z.string(),
  createdAt: z.number(),
  lastDecision: z
    .object({
      decision: z.enum(['done', 'continue', 'waiting']),
      reason: z.string(),
      judgedAt: z.number(),
    })
    .optional(),
});

export const harnessGoalBodySchema = z
  .object({
    objective: z.string().min(1),
    judgeModel: z.string().min(1).optional(),
    maxTurns: z.number().int().positive().optional(),
    kickoff: z.boolean().optional(),
  })
  .strict();

export const harnessGoalResponseSchema = z.object({
  goal: harnessGoalSchema.nullable(),
});

export const harnessErrorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean().optional(),
  details: jsonRecordSchema.optional(),
});
