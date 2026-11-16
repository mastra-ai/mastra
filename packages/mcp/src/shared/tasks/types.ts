import type { z } from 'zod/v4';
import type {
  CreateTaskResultSchema,
  DetailedTaskSchema,
  TaskInputRequestSchema,
  TaskInputRequestsSchema,
  TaskInputResponsesSchema,
  TaskSchema,
} from './schemas';

/** @experimental SEP-2663 extension; API may change. */
export type MCPTask = z.infer<typeof TaskSchema>;
/** A task with its `inputRequests`, `result` or `error` inlined, as `tasks/get` returns it. @experimental */
export type MCPDetailedTask = z.infer<typeof DetailedTaskSchema>;
/** @experimental SEP-2663 extension; API may change. */
export type MCPCreateTaskResult = z.infer<typeof CreateTaskResultSchema>;
/** @experimental SEP-2663 extension; API may change. */
export type MCPTaskInputRequest = z.infer<typeof TaskInputRequestSchema>;
/** @experimental SEP-2663 extension; API may change. */
export type MCPTaskInputRequests = z.infer<typeof TaskInputRequestsSchema>;
/** @experimental SEP-2663 extension; API may change. */
export type MCPTaskInputResponses = z.infer<typeof TaskInputResponsesSchema>;
/** A JSON-RPC error object carried by a `failed` task. @experimental */
export interface MCPTaskError {
  code: number;
  message: string;
  data?: unknown;
}
