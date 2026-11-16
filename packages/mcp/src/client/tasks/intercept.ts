import type { Transport } from '@modelcontextprotocol/client';
import { CreateTaskResultSchema, TASK_RESULT_TYPE } from '../../shared/tasks';
import type { MCPTask } from '../../shared/tasks';

/**
 * `_meta` key carrying an intercepted task handle. The `mastra.ai/` prefix keeps it out of the
 * reserved MCP namespace.
 */
export const TASK_HANDLE_META_KEY = 'mastra.ai/mcp-task';

/**
 * Lets task handles through on a connection that declared the Tasks extension.
 *
 * The SDK rejects `resultType: "task"` before any caller code runs. This rewrites such a response
 * into a complete `CallToolResult` with `isError: true` that carries the task under
 * {@link TASK_HANDLE_META_KEY}: `isError` keeps the SDK from applying the tool's output schema, and
 * if the marker is ever missed the call fails instead of returning a wrong result.
 * Call after `connect()`, which installs the protocol's own message handler.
 */
export function interceptTaskResults(transport: Transport): void {
  const deliver = transport.onmessage;
  if (!deliver) throw new Error('interceptTaskResults must run after the transport is connected');
  transport.onmessage = (message, extra) => {
    const result = 'result' in message ? (message.result as Record<string, unknown> | undefined) : undefined;
    if (result?.resultType === TASK_RESULT_TYPE) {
      const parsed = CreateTaskResultSchema.safeParse(result);
      if (parsed.success) {
        const { resultType: _resultType, _meta, ...task } = parsed.data;
        message = {
          ...message,
          result: {
            resultType: 'complete',
            isError: true,
            content: [{ type: 'text', text: `MCP task ${task.taskId} was not awaited` }],
            _meta: { ...(_meta ?? {}), [TASK_HANDLE_META_KEY]: task },
          },
        } as typeof message;
      }
    }
    deliver.call(transport, message, extra);
  };
}

/** The task handle a rewritten result carries, if any. */
export function takeTaskHandle(result: { _meta?: Record<string, unknown> }): MCPTask | undefined {
  const handle = result._meta?.[TASK_HANDLE_META_KEY];
  return handle && typeof handle === 'object' ? (handle as MCPTask) : undefined;
}
