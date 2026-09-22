import { MCPServer } from '@mastra/mcp';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, it } from 'vitest';

declare const req: IncomingMessage;
declare const res: ServerResponse;

describe('consumer transport boundary', () => {
  const server = new MCPServer({ name: 'transport-types', version: '2.0.0', tools: {} });

  it('accepts Node request and response objects on the Streamable HTTP entry point', () => {
    void server.startHTTP({ url: new URL('http://localhost/mcp'), httpPath: '/mcp', req, res });
  });

  it('does not expose the legacy Hono SSE surface', () => {
    // @ts-expect-error connectHonoSSE was removed with the HTTP+SSE transport in @mastra/mcp 2.x
    void server.connectHonoSSE;
    // @ts-expect-error getSseHonoTransport was removed with the HTTP+SSE transport in @mastra/mcp 2.x
    void server.getSseHonoTransport;
  });
});
