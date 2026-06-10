import { z } from 'zod/v4';

export const harnessIdPathParams = z.object({
  harnessId: z.string(),
});

export const harnessSessionIdPathParams = harnessIdPathParams.extend({
  sessionId: z.string(),
});

export const listHarnessSessionsQuerySchema = z.object({
  resourceId: z.string().optional(),
  threadId: z.string().optional(),
});

export const createHarnessSessionBodySchema = z.object({
  resourceId: z.string(),
  threadId: z.string(),
  modeId: z.string().optional(),
  modelId: z.string().optional(),
});

export const switchHarnessSessionModeBodySchema = z.object({
  modeId: z.string(),
});

export const switchHarnessSessionModelBodySchema = z.object({
  modelId: z.string(),
});

export const sendHarnessSessionMessageBodySchema = z.object({
  messages: z.unknown(),
  options: z.record(z.string(), z.unknown()).optional(),
});

export const harnessModeSchema = z.object({
  id: z.string(),
  defaultModelId: z.string(),
  description: z.string().optional(),
  instructions: z.string().optional(),
  transitionsTo: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const harnessSummarySchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  modes: z.array(harnessModeSchema),
});

export const harnessPendingItemSchema = z.object({
  id: z.string(),
  kind: z.enum(['tool-approval', 'tool-suspension', 'question', 'plan-approval']),
  status: z.enum(['pending', 'responded', 'canceled', 'failed']),
  sessionId: z.string(),
  runId: z.string().nullable().optional(),
  traceId: z.string().nullable().optional(),
  runtimeCompatibilityGeneration: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  payload: z.record(z.string(), z.unknown()).optional(),
  response: z.record(z.string(), z.unknown()).optional(),
});

export const harnessSessionRecordSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  resourceId: z.string(),
  threadId: z.string(),
  parentSessionId: z.string().optional(),
  subagentDepth: z.number().optional(),
  source: z
    .object({
      type: z.enum(['top-level', 'subagent-tool', 'direct-local', 'remote-resolve']),
      parentSessionId: z.string().optional(),
      parentRunId: z.string().nullable().optional(),
      parentTraceId: z.string().nullable().optional(),
      subagentType: z.string().optional(),
    })
    .optional(),
  origin: z.enum(['top-level', 'subagent-tool', 'direct-local', 'remote-resolve']),
  runtimeCompatibilityGeneration: z.string().nullable().optional(),
  modeId: z.string(),
  modelId: z.string(),
  title: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  state: z.record(z.string(), z.unknown()).optional(),
  pending: z.array(harnessPendingItemSchema).optional(),
  createdAt: z.date(),
  lastActivityAt: z.date(),
  closingAt: z.date().nullable().optional(),
  closeDeadlineAt: z.date().nullable().optional(),
  closedAt: z.date().nullable().optional(),
  deletedAt: z.date().nullable().optional(),
});

export const harnessSessionInfoSchema = harnessSessionRecordSchema.extend({
  isBusy: z.boolean(),
  queueDepth: z.number(),
  currentRunId: z.string().nullable(),
  currentTraceId: z.string().nullable(),
});

export const listHarnessesResponseSchema = z.object({
  harnesses: z.array(harnessSummarySchema),
});

export const getHarnessResponseSchema = z.object({
  harness: harnessSummarySchema,
});

export const listHarnessModesResponseSchema = z.object({
  modes: z.array(harnessModeSchema),
});

export const listHarnessSessionsResponseSchema = z.object({
  sessions: z.array(harnessSessionRecordSchema),
});

export const getHarnessSessionResponseSchema = z.object({
  session: harnessSessionInfoSchema,
});

export const getHarnessSessionThreadResponseSchema = z.object({
  thread: z.unknown().nullable(),
});

export const getHarnessSessionMessagesResponseSchema = z.object({
  messages: z.array(z.unknown()),
});

export const sendHarnessSessionMessageResponseSchema = z.object({
  result: z.unknown(),
});
