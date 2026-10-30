/**
 * Zod schemas for the MCP Tasks extension (SEP-2663) wire format.
 *
 * Objects are loose so fields added by later revisions pass through. `resultType` is required on
 * the raw `tools/call` task handle, as the 2026-07-28 revision requires it there.
 *
 * @experimental SEP-2663 extension; API may change.
 */
import { z } from 'zod/v4';
import { TASK_RESULT_TYPE, TASK_STATUSES } from './constants';

const JsonObjectSchema = z.record(z.string(), z.unknown());
const MetaSchema = JsonObjectSchema.optional();

export const TaskStatusSchema = z.enum(TASK_STATUSES);

/** An embedded elicitation, sampling or roots request (`{ method, params }`). */
export const TaskInputRequestSchema = z.looseObject({
  method: z.string(),
  params: JsonObjectSchema.optional(),
});

/** Keyed by identifiers that are unique over the task's lifetime. */
export const TaskInputRequestsSchema = z.record(z.string(), TaskInputRequestSchema);

/** The bare result object answering the input request with the same key. */
export const TaskInputResponsesSchema = z.record(z.string(), JsonObjectSchema);

const TaskShape = {
  taskId: z.string().min(1),
  status: TaskStatusSchema,
  statusMessage: z.string().optional(),
  createdAt: z.string(),
  lastUpdatedAt: z.string(),
  ttlMs: z.number().int().nonnegative().nullable(),
  pollIntervalMs: z.number().int().nonnegative().optional(),
};

export const TaskSchema = z.looseObject(TaskShape);

export const DetailedTaskSchema = z.discriminatedUnion('status', [
  z.looseObject({ ...TaskShape, status: z.literal('working') }),
  z.looseObject({ ...TaskShape, status: z.literal('input_required'), inputRequests: TaskInputRequestsSchema }),
  // The original request's result, e.g. a `CallToolResult`.
  z.looseObject({ ...TaskShape, status: z.literal('completed'), result: JsonObjectSchema }),
  // A JSON-RPC error object.
  z.looseObject({ ...TaskShape, status: z.literal('failed'), error: JsonObjectSchema }),
  z.looseObject({ ...TaskShape, status: z.literal('cancelled') }),
]);

/** What a server returns from `tools/call` instead of a `CallToolResult` when it creates a task. */
export const CreateTaskResultSchema = z.looseObject({
  ...TaskShape,
  resultType: z.literal(TASK_RESULT_TYPE),
  _meta: MetaSchema,
});

const TaskIdParamsSchema = z.looseObject({ taskId: z.string().min(1), _meta: MetaSchema });

export const GetTaskRequestParamsSchema = TaskIdParamsSchema;
export const CancelTaskRequestParamsSchema = TaskIdParamsSchema;
/**
 * `tasks/update` params as sent on the wire. `inputResponses` is a reserved retry field on the
 * 2026-07-28 revision: a receiving SDK moves it to `ctx.mcpReq.inputResponses` before the handler
 * runs, so a server validates the remaining params with {@link UpdateTaskHandlerParamsSchema}.
 */
export const UpdateTaskRequestParamsSchema = TaskIdParamsSchema.extend({ inputResponses: TaskInputResponsesSchema });
export const UpdateTaskHandlerParamsSchema = TaskIdParamsSchema;

// The SDK strips `resultType` from decoded results, so these result schemas leave it optional.
const CompleteResultShape = { resultType: z.literal('complete').optional(), _meta: MetaSchema };

/** `tasks/get` result: the full task. */
export const GetTaskResultSchema = z.intersection(z.looseObject(CompleteResultShape), DetailedTaskSchema);

/** `tasks/update` and `tasks/cancel` only acknowledge. */
export const TaskAckResultSchema = z.looseObject(CompleteResultShape);
