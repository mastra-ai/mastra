import type { Client } from '@modelcontextprotocol/client';
import { GetTaskResultSchema, TASKS_METHODS, TaskAckResultSchema } from '../../shared/tasks';
import type { MCPDetailedTask, MCPTaskInputResponses } from '../../shared/tasks';

export interface TaskRequestOptions {
  signal?: AbortSignal;
}

export interface TaskRequesterOptions {
  timeout?: number;
  /** `_meta` to send with each request, e.g. trace context. */
  meta?: () => Record<string, unknown> | undefined;
}

/**
 * Sends `tasks/get`, `tasks/update` and `tasks/cancel` to one server. Each is sent with an explicit
 * result schema, which the SDK requires for the Tasks extension's methods on the 2026-07-28 revision.
 * The SDK sets the `Mcp-Name: <taskId>` routing header on Streamable HTTP.
 */
export class TaskRequester {
  constructor(
    private readonly client: Pick<Client, 'request'>,
    private readonly options: TaskRequesterOptions = {},
  ) {}

  async get(taskId: string, options: TaskRequestOptions = {}): Promise<MCPDetailedTask> {
    const result = await this.client.request(
      { method: TASKS_METHODS.get, params: this.params({ taskId }) },
      GetTaskResultSchema,
      this.requestOptions(options),
    );
    const { resultType: _resultType, _meta, ...task } = result;
    return task as MCPDetailedTask;
  }

  async update(taskId: string, inputResponses: MCPTaskInputResponses, options: TaskRequestOptions = {}): Promise<void> {
    await this.client.request(
      { method: TASKS_METHODS.update, params: this.params({ taskId, inputResponses }) },
      TaskAckResultSchema,
      this.requestOptions(options),
    );
  }

  async cancel(taskId: string, options: TaskRequestOptions = {}): Promise<void> {
    await this.client.request(
      { method: TASKS_METHODS.cancel, params: this.params({ taskId }) },
      TaskAckResultSchema,
      this.requestOptions(options),
    );
  }

  private params<T extends Record<string, unknown>>(params: T): T & { _meta?: Record<string, unknown> } {
    const meta = this.options.meta?.();
    return meta ? { ...params, _meta: meta } : params;
  }

  private requestOptions(options: TaskRequestOptions): { timeout?: number; signal?: AbortSignal } {
    return { timeout: this.options.timeout, signal: options.signal };
  }
}
