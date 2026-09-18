import { MCPServer } from '@mastra/mcp';
import type { Context } from 'hono';
import type { SSEStreamingApi } from 'hono/streaming';
import { describe, it } from 'vitest';

declare const stream: SSEStreamingApi;
declare const context: Context;

describe('consumer Hono type identity (#23775)', () => {
  const server = new MCPServer({ name: 'hono-types', version: '1.0.0', tools: {} });

  it('accepts a consumer SSE stream', () => {
    void server.connectHonoSSE({ messagePath: '/message', stream });
  });

  it('accepts a consumer Context through the vendored transport', () => {
    const transport = server.getSseHonoTransport('session');
    if (transport) {
      void transport.handlePostMessage(context);
    }
  });
});
