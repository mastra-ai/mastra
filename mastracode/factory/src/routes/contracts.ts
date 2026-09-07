import { z } from 'zod';

export type FactoryRouteContract = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  pathSchema?: z.ZodType;
  querySchema?: z.ZodType;
  bodySchema?: z.ZodType;
  responseSchema: z.ZodType;
};

export const UUID_PATTERN = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
const uuidSchema = z.string().regex(new RegExp(UUID_PATTERN));
const entitySchema = z.record(z.string(), z.unknown());
const nonEmptyTrimmed = (max: number) => z.string().trim().min(1).max(max);
const rawBoundedTrimmed = (max: number) =>
  z
    .string()
    .max(max)
    .transform(value => value.trim())
    .pipe(z.string().min(1));
const trimmedUuidSchema = z.string().trim().regex(new RegExp(UUID_PATTERN));
const nullableTrimmed = (max: number) =>
  z.union([
    z
      .string()
      .trim()
      .max(max)
      .transform(value => value || null),
    z.null(),
  ]);
const projectPathSchema = z.object({ id: uuidSchema });
const projectDecisionPathSchema = z.object({ id: uuidSchema, decisionId: uuidSchema });
const workItemPathSchema = z.object({ id: uuidSchema });
const transitionPathSchema = z.object({ id: uuidSchema, workItemId: uuidSchema });

const projectSchema = entitySchema;
const projectResponseSchema = z.object({ project: projectSchema });
const workItemResponseSchema = z.object({ workItem: entitySchema });
const decisionResponseSchema = z.object({ decision: entitySchema });

export const createProjectBodySchema = z.object({
  name: nonEmptyTrimmed(200),
  description: nullableTrimmed(2_000).optional().default(null),
});

export const updateProjectBodySchema = z
  .object({
    name: nonEmptyTrimmed(200).optional(),
    description: nullableTrimmed(2_000).optional(),
    defaultModelId: nullableTrimmed(200).optional(),
    slackWorkItemsEnabled: z.boolean().optional(),
    autoRunEnabled: z.boolean().optional(),
    autoApprovePlans: z.boolean().optional(),
  })
  .refine(input => Object.keys(input).length > 0, { message: 'At least one project field is required' });

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
      ...metadata
    } = value;
    return metadata;
  });

export const createWorkItemBodySchema = z.object({
  title: rawBoundedTrimmed(500),
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
    board: z.string().min(1).max(128).optional(),
    parentWorkItemId: uuidSchema.nullable().optional(),
    stages: stagesSchema.optional(),
    sessions: sessionsSchema.optional(),
    metadata: metadataSchema.optional(),
    plansPreapproved: z.literal(true).optional(),
  })
  .refine(input => Object.keys(input).length > 0, { message: 'At least one work-item field is required' });

export const transitionBodySchema = z
  .object({
    board: z.enum(['work', 'review']),
    stage: z.enum(['intake', 'triage', 'planning', 'execute', 'review', 'done', 'canceled']),
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
const boundedLimitSchema = (defaultValue: number, max: number) =>
  z
    .string()
    .optional()
    .transform(value => {
      const parsed = value ? Number.parseInt(value, 10) : defaultValue;
      return Number.isFinite(parsed) ? Math.max(1, Math.min(max, parsed)) : defaultValue;
    });
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

const attentionKindSchema = z.enum([
  'automation-failed',
  'automation-proposed',
  'mention',
  'activity',
  'supervisor-finding',
]);
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
  tier: z.enum(['all', 'badge', 'activity']).optional().default('all'),
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
  .refine(
    input =>
      input.kind === 'supervisor-finding'
        ? /^[a-z0-9:_-]{1,256}$/i.test(input.sourceId)
        : new RegExp(UUID_PATTERN).test(input.sourceId),
    { message: 'Invalid attention source id', path: ['sourceId'] },
  );

export const FACTORY_ROUTE_CONTRACTS = {
  projectList: {
    method: 'GET',
    path: '/web/factory/projects',
    description: 'List Factory projects for the current organization',
    responseSchema: z.object({ projects: z.array(projectSchema) }),
  },
  projectCreate: {
    method: 'POST',
    path: '/web/factory/projects',
    description: 'Create a Factory project',
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
  workItemList: {
    method: 'GET',
    path: '/web/factory/projects/:id/work-items',
    description: 'List Factory work items and running sessions',
    pathSchema: projectPathSchema,
    responseSchema: z.object({ workItems: z.array(entitySchema), runningSessionIds: z.array(z.string()) }),
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
    description: 'Transition a work item with its expected revision',
    pathSchema: transitionPathSchema,
    bodySchema: transitionBodySchema,
    responseSchema: entitySchema,
  },
  workItemStart: {
    method: 'POST',
    path: '/web/factory/projects/:id/runs/start',
    description: 'Explicitly start a Factory work-item run',
    pathSchema: projectPathSchema,
    bodySchema: startWorkItemBodySchema,
    responseSchema: entitySchema,
  },
  decisionList: {
    method: 'GET',
    path: '/web/factory/projects/:id/decisions',
    description: 'List Factory decisions',
    pathSchema: projectPathSchema,
    querySchema: decisionQuerySchema,
    responseSchema: z.object({ decisions: z.array(entitySchema), nextCursor: z.string().optional() }),
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
      openCount: z.number(),
      badgeCount: z.number(),
      unreadCount: z.number(),
      activityUnreadCount: z.number(),
      latestOccurrenceKey: z.string().nullable(),
      latestOccurrenceAt: z.string().nullable(),
      latestOccurrenceUnread: z.boolean(),
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
  supervisorSession: {
    method: 'POST',
    path: '/web/factory/projects/:id/supervisor/session',
    description: 'Get the deterministic Factory supervisor session address',
    pathSchema: projectPathSchema,
    responseSchema: z.object({ sessionId: z.string(), threadId: z.string(), factoryProjectId: uuidSchema }),
  },
  supervisorHealth: {
    method: 'GET',
    path: '/web/factory/projects/:id/supervisor/health',
    description: 'Run the deterministic Factory supervisor health check',
    pathSchema: projectPathSchema,
    responseSchema: z.object({
      checkedAt: z.string(),
      findings: z.array(entitySchema),
      counts: z.record(z.string(), z.number().int().nonnegative()),
    }),
  },
} as const satisfies Record<string, FactoryRouteContract>;

export type FactoryRouteContractKey = keyof typeof FACTORY_ROUTE_CONTRACTS;
