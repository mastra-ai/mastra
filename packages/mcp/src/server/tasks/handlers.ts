import { RequestContext } from '@mastra/core/request-context';
import { ProtocolError } from '@modelcontextprotocol/server';
import type { Server, ServerContext } from '@modelcontextprotocol/server';
import {
  CancelTaskRequestParamsSchema,
  GetTaskRequestParamsSchema,
  GetTaskResultSchema,
  TASKS_ERROR_CODES,
  TASKS_METHODS,
  TaskAckResultSchema,
  taskKeyOf,
  UpdateTaskHandlerParamsSchema,
} from '../../shared/tasks';
import type { MCPDetailedTask, MCPTaskInputResponses } from '../../shared/tasks';
import type { MCPTaskStore, MCPTaskTrace } from './store';

/** How a `tasks/*` request is traced. */
export interface TaskRequestTracing {
  /** Run without a span: polls are frequent and change nothing. */
  untraced?: boolean;
  /** The task's trace, which the request's span joins; `undefined` traces the request on its own. */
  parentOf?: (requestContext: RequestContext) => Promise<MCPTaskTrace | undefined>;
  /** Recorded on the request's span. Never the task id, which is a bearer token. */
  metadata?: Record<string, unknown>;
}

export interface TaskHandlerDeps {
  store: MCPTaskStore;
  /** Resolves the request's context and runs `fn` under the request's span. Defaults to an empty context, untraced. */
  trace?: <T>(
    server: Server,
    method: string,
    params: Record<string, unknown>,
    ctx: ServerContext,
    fn: (requestContext: RequestContext) => Promise<T>,
    tracing?: TaskRequestTracing,
  ) => Promise<T>;
  /** The authenticated caller of a request, as tasks are bound to it at creation. */
  principal: (ctx: ServerContext, requestContext: RequestContext) => string | Promise<string>;
  /** Further narrows which callers may read, answer or cancel a task they created. */
  authorize?: (context: {
    principal: string;
    task: MCPDetailedTask;
    requestContext: RequestContext;
  }) => boolean | Promise<boolean>;
}

function notFound(): ProtocolError {
  // Unknown, expired, foreign and unauthorized tasks share one answer so a caller cannot probe for other callers' tasks.
  return new ProtocolError(TASKS_ERROR_CODES.InvalidParams, 'Task not found');
}

/**
 * Registers `tasks/get`, `tasks/update` and `tasks/cancel` on one protocol instance. They are
 * registered with explicit schemas, which the SDK requires to serve the Tasks extension's methods on
 * the 2026-07-28 revision.
 */
export function registerTaskHandlers(server: Server, deps: TaskHandlerDeps): void {
  const { store, authorize } = deps;
  const trace = deps.trace ?? ((_server, _method, _params, _ctx, fn) => fn(new RequestContext()));

  /** `tasks/update` and `tasks/cancel` check `authorize` against the task before acting on it. */
  const serve = <T>(
    method: string,
    params: { taskId: string },
    ctx: ServerContext,
    fn: (access: { principal: string }) => Promise<T>,
    metadata?: Record<string, unknown>,
  ) => {
    const mcpTaskKey = taskKeyOf(params.taskId);
    return trace(
      server,
      method,
      { mcpTaskKey },
      ctx,
      async requestContext => {
        const principal = await deps.principal(ctx, requestContext);
        if (authorize) {
          const task = await store.get(params.taskId, { principal });
          if (!task || !(await authorize({ principal, task, requestContext }))) throw notFound();
        }
        return fn({ principal });
      },
      {
        parentOf: store.traceOf
          ? async requestContext =>
              store.traceOf!(params.taskId, { principal: await deps.principal(ctx, requestContext) })
          : undefined,
        metadata: { mcpTaskKey, ...metadata },
      },
    );
  };

  server.setRequestHandler(
    TASKS_METHODS.get,
    { params: GetTaskRequestParamsSchema, result: GetTaskResultSchema },
    (params, ctx) =>
      trace(
        server,
        TASKS_METHODS.get,
        {},
        ctx,
        async requestContext => {
          const principal = await deps.principal(ctx, requestContext);
          const task = await store.get(params.taskId, { principal });
          if (!task || (authorize && !(await authorize({ principal, task, requestContext })))) throw notFound();
          return task;
        },
        { untraced: true },
      ),
  );

  server.setRequestHandler(
    TASKS_METHODS.update,
    { params: UpdateTaskHandlerParamsSchema, result: TaskAckResultSchema },
    (params, ctx) =>
      serve(TASKS_METHODS.update, params, ctx, async access => {
        // The SDK lifts `inputResponses` off the params and keeps only bare response objects.
        const inputResponses = (ctx.mcpReq.inputResponses ?? {}) as MCPTaskInputResponses;
        if (!(await store.update(params.taskId, inputResponses, access))) throw notFound();
        return {};
      }),
  );

  server.setRequestHandler(
    TASKS_METHODS.cancel,
    { params: CancelTaskRequestParamsSchema, result: TaskAckResultSchema },
    (params, ctx) =>
      serve(
        TASKS_METHODS.cancel,
        params,
        ctx,
        async access => {
          if (!(await store.cancel(params.taskId, access))) throw notFound();
          return {};
        },
        { mcpTaskStatus: 'cancelled' },
      ),
  );
}
