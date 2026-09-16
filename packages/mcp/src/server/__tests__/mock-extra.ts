import { vi } from 'vitest';
import type { MCPRequestHandlerExtra } from '../types';

/**
 * Builds a ServerContext-shaped `extra` for invoking SDK request handlers
 * directly in tests. The MCP 2.0 SDK wraps tools/call, prompts/get and
 * resources/read handlers with a seam that reads `ctx.mcpReq` (e.g.
 * `requestState()`), so handler mocks must carry a real `mcpReq` envelope.
 * The flattened fields mirror what `toMCPRequestHandlerExtra` derives so
 * test assertions can keep referencing the mock object directly.
 */
export const makeMockExtra = ({
  sessionId,
  authInfo,
  requestId = 'test-request-id',
}: {
  sessionId?: string;
  authInfo?: Record<string, unknown>;
  requestId?: string;
} = {}): MCPRequestHandlerExtra => {
  const signal = new AbortController().signal;
  const sendNotification = vi.fn();
  const sendRequest = vi.fn();
  return {
    signal,
    ...(sessionId !== undefined ? { sessionId } : {}),
    ...(authInfo !== undefined ? { authInfo, http: { authInfo } } : {}),
    requestId,
    sendNotification,
    sendRequest,
    mcpReq: {
      signal,
      id: requestId,
      notify: sendNotification,
      send: sendRequest,
      requestState: () => undefined,
    },
  } as unknown as MCPRequestHandlerExtra;
};
