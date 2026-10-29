import type { CallToolResult, Transport } from '@modelcontextprotocol/server';
import { TASK_RESULT_TYPE } from '../../shared/tasks';
import type { MCPTask } from '../../shared/tasks';

/** `_meta` key a tool handler uses to hand a task to {@link emitTaskResults}. */
const TASK_RESULT_META_KEY = 'mastra.ai/mcp-task-result';

/**
 * A `tools/call` result standing in for a task handle. The SDK only lets a tool handler return a
 * `CallToolResult`; {@link emitTaskResults} replaces this one with the `CreateTaskResult` on the
 * wire. `isError` keeps the SDK from applying the tool's output schema to the placeholder.
 */
export function taskHandleResult(task: MCPTask): CallToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: `MCP task ${task.taskId}` }],
    _meta: { [TASK_RESULT_META_KEY]: task },
  };
}

/**
 * Sends results built by {@link taskHandleResult} as `CreateTaskResult`s. Only call handlers that
 * checked the caller declared the Tasks extension may build them.
 */
export function emitTaskResults(transport: Transport): void {
  const send = transport.send.bind(transport);
  transport.send = (message, options) => {
    const result = 'result' in message ? (message.result as Record<string, unknown> | undefined) : undefined;
    const meta = result?._meta as Record<string, unknown> | undefined;
    const task = meta?.[TASK_RESULT_META_KEY] as MCPTask | undefined;
    if (task) {
      const { [TASK_RESULT_META_KEY]: _task, ...rest } = meta!;
      message = {
        ...message,
        result: { ...task, resultType: TASK_RESULT_TYPE, ...(Object.keys(rest).length > 0 ? { _meta: rest } : {}) },
      } as typeof message;
    }
    return send(message, options);
  };
}
