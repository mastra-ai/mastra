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

export const harnessAttachmentPathParams = harnessSessionPathParams.extend({
  attachmentId: z.string().min(1).describe('Harness attachment id'),
});

export const harnessInboxPathParams = harnessSessionPathParams.extend({
  itemId: z.string().min(1).describe('Pending inbox item id'),
});

export const harnessMessageResultPathParams = harnessSessionPathParams.extend({
  signalId: z.string().min(1).describe('Message signal id'),
});

export const harnessQueueResultPathParams = harnessSessionPathParams.extend({
  queuedItemId: z.string().min(1).describe('Queued item id'),
});

export const listHarnessSessionsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  includeClosed: includeClosedSchema,
});

export const harnessChannelDiagnosticsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict();

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

const channelDiagnosticErrorSchema = z
  .object({
    code: z.string(),
    retryable: z.boolean().optional(),
  })
  .strict();

const channelDiagnosticLeaseSchema = z
  .object({
    attempts: z.number(),
    claimExpiresAt: z.number().optional(),
    nextAttemptAt: z.number().optional(),
  })
  .strict();

const channelBindingDiagnosticSchema = z
  .object({
    harnessName: z.string(),
    channelId: z.string(),
    bindingId: z.string(),
    providerId: z.string(),
    platform: z.string(),
    callbackTarget: z.string(),
    durableId: z.string(),
  })
  .strict();

const channelInboxDiagnosticSchema = z
  .object({
    id: z.string(),
    status: z.enum(['received', 'admitted', 'accepted', 'queued', 'failed', 'dead']),
    channelId: z.string(),
    providerId: z.string(),
    bindingId: z.string().optional(),
    admissionId: z.string(),
    resourceId: z.string().optional(),
    threadId: z.string().optional(),
    sessionId: z.string().optional(),
    runId: z.string().optional(),
    signalId: z.string().optional(),
    queuedItemId: z.string().optional(),
    externalMessageId: z.string(),
    delivery: z.enum(['message', 'queue']).optional(),
    mode: z.string().optional(),
    model: z.string().optional(),
    receivedAt: z.number(),
    admittedAt: z.number().optional(),
    acceptedAt: z.number().optional(),
    queuedAt: z.number().optional(),
    failedAt: z.number().optional(),
    deadAt: z.number().optional(),
    updatedAt: z.number(),
    lease: channelDiagnosticLeaseSchema,
    lastError: channelDiagnosticErrorSchema.optional(),
  })
  .strict();

const channelActionTokenDiagnosticSchema = z
  .object({
    actionTokenId: z.string(),
    status: z.enum(['active', 'expired', 'revoked']),
    channelId: z.string(),
    providerId: z.string(),
    bindingId: z.string(),
    bindingGeneration: z.number(),
    resourceId: z.string(),
    owningSessionId: z.string(),
    itemId: z.string(),
    kind: z.enum(['tool-approval', 'tool-suspension', 'question', 'plan-approval']),
    runId: z.string(),
    pendingRequestedAt: z.number(),
    expiresAt: z.number().optional(),
    revokedAt: z.number().optional(),
    revokedReason: z.enum(['session_deleted']).optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .strict();

const channelActionReceiptDiagnosticSchema = z
  .object({
    id: z.string(),
    status: z.enum(['received', 'accepted', 'applied', 'conflict', 'failed', 'dead']),
    channelId: z.string(),
    providerId: z.string(),
    actionTokenId: z.string(),
    actionId: z.string(),
    bindingId: z.string(),
    bindingGeneration: z.number(),
    resourceId: z.string(),
    owningSessionId: z.string(),
    itemId: z.string(),
    kind: z.enum(['tool-approval', 'tool-suspension', 'question', 'plan-approval']),
    runId: z.string(),
    pendingRequestedAt: z.number(),
    conflictReason: z.string().optional(),
    acceptedAt: z.number().optional(),
    appliedAt: z.number().optional(),
    failedAt: z.number().optional(),
    deadAt: z.number().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
    lease: channelDiagnosticLeaseSchema,
    lastError: channelDiagnosticErrorSchema.optional(),
  })
  .strict();

const channelOutboxDiagnosticSchema = z
  .object({
    id: z.string(),
    status: z.enum(['pending', 'claimed', 'sent', 'failed', 'dead']),
    channelId: z.string(),
    providerId: z.string(),
    bindingId: z.string(),
    bindingGeneration: z.number(),
    resourceId: z.string(),
    threadId: z.string(),
    sessionId: z.string().optional(),
    owningSessionId: z.string().optional(),
    source: z.object({ kind: z.string(), id: z.string().optional() }).strict().optional(),
    kind: z.string(),
    operationKind: z.string(),
    operationName: z.string().optional(),
    deliverySemantics: z.string(),
    sentAt: z.number().optional(),
    failedAt: z.number().optional(),
    deadAt: z.number().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
    lease: channelDiagnosticLeaseSchema,
    lastError: channelDiagnosticErrorSchema.optional(),
  })
  .strict();

export const harnessChannelDiagnosticsResponseSchema = z
  .object({
    harnessName: z.string(),
    resourceId: z.string(),
    sessionId: z.string(),
    visibleSessionIds: z.array(z.string()),
    bindings: z.array(channelBindingDiagnosticSchema),
    inbox: z.array(channelInboxDiagnosticSchema),
    actionTokens: z.array(channelActionTokenDiagnosticSchema),
    actionReceipts: z.array(channelActionReceiptDiagnosticSchema),
    outbox: z.array(channelOutboxDiagnosticSchema),
    limit: z.number(),
    truncated: z.boolean(),
    redacted: z.literal(true),
  })
  .strict();

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
    renderer: z.unknown().optional(),
    schemaId: z.string().min(1).optional(),
    metadata: jsonRecordSchema.optional(),
    object: z.unknown().optional(),
  })
  .strict();

const urlAttachmentSchema = z
  .object({
    kind: z.literal('url'),
    url: z.string().url(),
    name: z.string().min(1),
    mimeType: z.string().min(1).optional(),
    sha256: z.string().min(1).optional(),
    metadata: jsonRecordSchema.optional(),
  })
  .strict();

const refAttachmentSchema = attachmentRefSchema
  .omit({ kind: true })
  .extend({
    kind: z.literal('ref'),
    attachmentKind: z.enum(['file', 'primitive', 'element']).optional(),
  })
  .strict();

const wireAttachmentSchema = z.union([attachmentRefSchema, refAttachmentSchema, urlAttachmentSchema]);

const admissionAttachmentsSchema = z.object({
  attachments: z.array(wireAttachmentSchema).optional(),
  files: z.array(wireAttachmentSchema).optional(),
});

export const harnessAttachmentUploadBodySchema = z
  .object({
    kind: z.enum(['file', 'primitive', 'element']).optional(),
    file: z.unknown().optional(),
    data: z.unknown().optional(),
    payload: z.unknown().optional(),
    dataBase64: z.string().optional(),
    filename: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    contentType: z.string().min(1).optional(),
    mimeType: z.string().min(1).optional(),
    primitiveType: z.string().min(1).optional(),
    value: z.unknown().optional(),
    elementType: z.string().min(1).optional(),
    renderer: z.unknown().optional(),
    schemaId: z.string().min(1).optional(),
    metadata: jsonRecordSchema.optional(),
  })
  .strict();

export const harnessAttachmentUploadResponseSchema = attachmentRefSchema;

export const harnessMessageAdmissionBodySchema = z
  .object({
    content: z.string().min(1),
    admissionId: z.string().min(1),
    mode: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    attachments: admissionAttachmentsSchema.shape.attachments,
    files: admissionAttachmentsSchema.shape.files,
  })
  .strict()
  .refine(body => body.attachments === undefined || body.files === undefined, {
    message: 'Use either "attachments" or "files", not both',
    path: ['attachments'],
  });

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
    attachments: admissionAttachmentsSchema.shape.attachments,
    files: admissionAttachmentsSchema.shape.files,
  })
  .strict()
  .refine(body => body.attachments === undefined || body.files === undefined, {
    message: 'Use either "attachments" or "files", not both',
    path: ['attachments'],
  });

export const harnessQueueAdmissionResponseSchema = z.object({
  accepted: z.literal(true),
  queuedItemId: z.string(),
  duplicate: z.boolean(),
});

const operationResultBaseSchema = z.object({
  status: z.enum(['pending', 'completed', 'failed', 'expired', 'not_found']),
  source: z.enum(['message', 'queue']),
});

export const harnessOperationResultResponseSchema = z.discriminatedUnion('status', [
  operationResultBaseSchema.extend({ status: z.literal('pending'), runId: z.string().optional() }),
  operationResultBaseSchema.extend({
    status: z.literal('completed'),
    runId: z.string().optional(),
    result: z.unknown(),
  }),
  operationResultBaseSchema.extend({
    status: z.literal('failed'),
    runId: z.string().optional(),
    error: z.object({ code: z.string(), message: z.string() }),
  }),
  operationResultBaseSchema.extend({
    status: z.literal('expired'),
    runId: z.string().optional(),
    expiredAt: z.number().optional(),
  }),
  operationResultBaseSchema.extend({ status: z.literal('not_found') }),
]);

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
