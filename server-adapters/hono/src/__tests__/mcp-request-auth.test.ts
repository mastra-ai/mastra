import type { IncomingMessage } from 'node:http';
import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import type { ServerRoute } from '@mastra/server/server-adapter';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { MastraServer } from '../index';

/**
 * Regression coverage for https://github.com/mastra-ai/mastra/issues/17291.
 *
 * The Hono adapter regenerates a Node request via `toReqRes` before handing it to
 * `MCPServer.startHTTP`. The MCP SDK reads `req.auth` off that regenerated request, so
 * without an explicit bridge the principal resolved by auth middleware never reaches
 * tool execution and `extra.authInfo` stays undefined.
 */

const MCP_HTTP_ROUTE = { responseType: 'mcp-http' } as unknown as ServerRoute;

function createAdapter(mcpOptions?: Record<string, unknown>) {
  return new MastraServer({
    app: new Hono<any, any, any>(),
    mastra: {
      getLogger: () => undefined,
      getServer: () => undefined,
      setMastraServer: () => {},
    } as unknown as Mastra,
    mcpOptions: mcpOptions as any,
  });
}

function createHonoContext(requestContext?: RequestContext): Context {
  const raw = new Request('http://localhost/api/mcp/test/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
  });

  return {
    req: { raw, url: raw.url },
    get: (key: string) => (key === 'requestContext' ? requestContext : undefined),
    header: () => {},
  } as unknown as Context;
}

/**
 * Stands in for MCPServer, capturing what the transport would have read off `req.auth`
 * and closing the response so `toFetchResponse` resolves.
 */
function createCapturingMcpServer() {
  const captured: { auth?: unknown; options?: unknown } = {};
  return {
    captured,
    server: {
      startHTTP: async ({ req, res, options }: { req: IncomingMessage; res: any; options?: unknown }) => {
        captured.auth = (req as IncomingMessage & { auth?: unknown }).auth;
        captured.options = options;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{}');
      },
    },
  };
}

async function runMcpHttpResponse({
  requestContext,
  mcpOptions,
  routeMcpOptions,
}: {
  requestContext?: RequestContext;
  mcpOptions?: Record<string, unknown>;
  routeMcpOptions?: Record<string, unknown>;
}) {
  const adapter = createAdapter(mcpOptions);
  const { server, captured } = createCapturingMcpServer();

  const response = await (adapter as any).sendResponse(MCP_HTTP_ROUTE, createHonoContext(requestContext), {
    server,
    httpPath: '/mcp/test/mcp',
    mcpOptions: routeMcpOptions,
  });
  // Drain so the background startHTTP call has definitely completed.
  await response.text();

  return captured;
}

describe('MCP streamable HTTP request auth bridge (issue #17291)', () => {
  it('bridges the authenticated principal onto req.auth', async () => {
    const requestContext = new RequestContext();
    requestContext.set('mastra__user', { id: 'user-1', scopes: ['read'] });
    requestContext.set('mastra__authToken', 'tok-abc');

    const captured = await runMcpHttpResponse({ requestContext });

    expect(captured.auth).toEqual({
      token: 'tok-abc',
      clientId: 'user-1',
      scopes: ['read'],
      extra: { user: { id: 'user-1', scopes: ['read'] } },
    });
  });

  it('leaves req.auth undefined for unauthenticated requests', async () => {
    const captured = await runMcpHttpResponse({ requestContext: new RequestContext() });

    expect(captured.auth).toBeUndefined();
  });

  it('lets a custom setRequestAuth hook own the result and keeps it out of transport options', async () => {
    const requestContext = new RequestContext();
    requestContext.set('bearerPayload', { sub: 'oauth-user', scope: 'tools:call' });

    const captured = await runMcpHttpResponse({
      requestContext,
      mcpOptions: {
        serverless: true,
        setRequestAuth: (req: IncomingMessage, ctx: RequestContext) => {
          const payload = ctx.get('bearerPayload') as { sub: string; scope: string };
          (req as any).auth = { token: 'verified', clientId: payload.sub, scopes: [payload.scope] };
        },
      },
    });

    expect(captured.auth).toEqual({ token: 'verified', clientId: 'oauth-user', scopes: ['tools:call'] });
    expect(captured.options).toEqual({ serverless: true });
  });

  it('applies the bridge in serverless/stateless mode', async () => {
    const requestContext = new RequestContext();
    requestContext.set('mastra__user', { sub: 'user-2' });

    const captured = await runMcpHttpResponse({ requestContext, mcpOptions: { serverless: true } });

    expect((captured.auth as any).clientId).toBe('user-2');
    expect(captured.options).toEqual({ serverless: true });
  });

  it('passes the resolved auth info to the SSE transport', async () => {
    const requestContext = new RequestContext();
    requestContext.set('mastra__user', { id: 'user-sse' });
    requestContext.set('mastra__authToken', 'tok-sse');

    const adapter = createAdapter();
    let captured: any;
    const server = {
      startHonoSSE: async (args: any) => {
        captured = args;
        return new Response('ok');
      },
    };

    await (adapter as any).sendResponse(
      { responseType: 'mcp-sse' } as unknown as ServerRoute,
      createHonoContext(requestContext),
      { server, ssePath: '/mcp/test/sse', messagePath: '/mcp/test/messages' },
    );

    expect(captured.authInfo).toEqual({
      token: 'tok-sse',
      clientId: 'user-sse',
      scopes: [],
      extra: { user: { id: 'user-sse' } },
    });
  });

  it('lets a route-level hook override the class-level one', async () => {
    const requestContext = new RequestContext();
    requestContext.set('mastra__user', { id: 'user-3' });

    const captured = await runMcpHttpResponse({
      requestContext,
      mcpOptions: {
        setRequestAuth: (req: IncomingMessage) => {
          (req as any).auth = { token: '', clientId: 'class-level', scopes: [] };
        },
      },
      routeMcpOptions: {
        setRequestAuth: (req: IncomingMessage) => {
          (req as any).auth = { token: '', clientId: 'route-level', scopes: [] };
        },
      },
    });

    expect((captured.auth as any).clientId).toBe('route-level');
  });
});
