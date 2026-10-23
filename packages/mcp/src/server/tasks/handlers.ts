import { ProtocolError } from '@modelcontextprotocol/server';
import type { Server, ServerContext } from '@modelcontextprotocol/server';
import {
  CancelTaskRequestParamsSchema,
  GetTaskRequestParamsSchema,
  GetTaskResultSchema,
  TASKS_ERROR_CODES,
  TASKS_METHODS,
  TaskAckResultSchema,
  UpdateTaskHandlerParamsSchema,
} from '../../shared/tasks';
import type { MCPTaskInputResponses } from '../../shared/tasks';
import type { MCPTaskStore } from './store';

export interface TaskHandlerDeps {
  store: MCPTaskStore;
  /** The authenticated caller of a request, as tasks are bound to it at creation. */
  principal: (ctx: ServerContext) => Promise<string>;
}

function notFound(): ProtocolError {
  // Unknown, expired and foreign tasks share one answer so a caller cannot probe for other callers' tasks.
  return new ProtocolError(TASKS_ERROR_CODES.InvalidParams, 'Task not found');
}

/**
 * Registers `tasks/get`, `tasks/update` and `tasks/cancel` on one protocol instance. They are
 * registered with explicit schemas, which the SDK requires to serve the Tasks extension's methods on
 * the 2026-07-28 revision.
 */
export function registerTaskHandlers(server: Server, deps: TaskHandlerDeps): void {
  const { store } = deps;

  server.setRequestHandler(
    TASKS_METHODS.get,
    { params: GetTaskRequestParamsSchema, result: GetTaskResultSchema },
    async (params, ctx) => {
      const task = await store.get(params.taskId, { principal: await deps.principal(ctx) });
      if (!task) throw notFound();
      return task;
    },
  );

  server.setRequestHandler(
    TASKS_METHODS.update,
    { params: UpdateTaskHandlerParamsSchema, result: TaskAckResultSchema },
    async (params, ctx) => {
      // The SDK lifts `inputResponses` off the params and keeps only bare response objects.
      const inputResponses = (ctx.mcpReq.inputResponses ?? {}) as MCPTaskInputResponses;
      const found = await store.update(params.taskId, inputResponses, { principal: await deps.principal(ctx) });
      if (!found) throw notFound();
      return {};
    },
  );

  server.setRequestHandler(
    TASKS_METHODS.cancel,
    { params: CancelTaskRequestParamsSchema, result: TaskAckResultSchema },
    async (params, ctx) => {
      const found = await store.cancel(params.taskId, { principal: await deps.principal(ctx) });
      if (!found) throw notFound();
      return {};
    },
  );
}
