import { Mastra } from '@mastra/core';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { EntityType, SpanType, TracingEventType } from '@mastra/core/observability';
import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { Observability } from '@mastra/observability';
import type { Client } from '@modelcontextprotocol/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { connectClient, serveHTTP } from './__tests__/harness.mock';
import type { ServedHTTP } from './__tests__/harness.mock';
import { MCPServer } from './server';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

const endedSpans: any[] = [];
const collectingExporter = {
  name: 'collecting-exporter',
  async exportTracingEvent(event: { type: string; exportedSpan?: any }) {
    if (event.type === TracingEventType.SPAN_ENDED) endedSpans.push(event.exportedSpan);
  },
  async flush() {},
  async shutdown() {},
};

const tools = {
  echoTool: createTool({
    id: 'echoTool',
    description: 'Echoes the message',
    inputSchema: z.object({ message: z.string() }),
    outputSchema: z.object({ echoed: z.string() }),
    execute: async ({ message }) => ({ echoed: message }),
  }),
  /** A successful tool whose ordinary output happens to use `error` as a data field. */
  flagTool: createTool({
    id: 'flagTool',
    description: 'Reports a flag using `error` as ordinary data',
    inputSchema: z.object({ id: z.string() }),
    outputSchema: z.object({ id: z.string(), error: z.boolean(), detail: z.string() }),
    execute: async ({ id }) => ({ id, error: true, detail: 'flagged' }),
  }),
  throwingTool: createTool({
    id: 'throwingTool',
    description: 'Throws a MastraError',
    inputSchema: z.object({}),
    execute: async () => {
      throw new MastraError({
        id: 'UPSTREAM_TIMEOUT',
        domain: ErrorDomain.MCP,
        category: ErrorCategory.THIRD_PARTY,
        text: 'Payment API timed out',
      });
    },
  }),
  askingTool: createTool({
    id: 'askingTool',
    description: 'Suspends for one round before answering',
    inputSchema: z.object({}),
    resumeSchema: z.object({ ok: z.boolean() }),
    execute: async (_args, context) => {
      if (!context.resumeData) {
        await context.suspend?.({ message: 'Confirm?' });
        return;
      }
      return `confirmed: ${context.resumeData.ok}`;
    },
  }),
};

describe('MCPServer tracing', () => {
  let served: ServedHTTP;
  let client: Client;
  let server: MCPServer;

  beforeAll(async () => {
    server = new MCPServer({
      id: 'traced-server',
      name: 'Traced Server',
      version: '3.2.1',
      tools,
      resources: {
        listResources: async () => [{ uri: 'file://known', name: 'known' }],
        getResourceContent: async () => ({ text: 'known content' }),
      },
      prompts: {
        listPrompts: async () => [{ name: 'greet', version: '1' }],
        getPromptMessages: async () => ({ messages: [] }),
      },
    });
    new Mastra({
      logger: false,
      mcpServers: { server },
      observability: new Observability({
        configs: { default: { serviceName: 'mcp-tracing-test', exporters: [collectingExporter] } },
      }),
    });
    served = await serveHTTP(server);
    client = await connectClient(served.url);
  });

  afterAll(async () => {
    await client?.close();
    await served?.close();
  });

  beforeEach(() => {
    endedSpans.length = 0;
  });

  const spansOfType = (type: SpanType) => endedSpans.filter(span => span.type === type);
  const requestSpans = () => spansOfType(SpanType.MCP_SERVER_REQUEST);
  /** The SDK stamps `_meta` on after the handler returns; the span holds what the handler produced. */
  const handlerResult = (result: unknown) => {
    const { _meta, ...rest } = result as Record<string, unknown>;
    return rest;
  };

  describe('caller trace context', () => {
    const CALLER_TRACE = '0af7651916cd43dd8448eb211c80319c';
    const CALLER_SPAN = 'b7ad6b7169203331';
    const traceparent = (flags = '01') => `00-${CALLER_TRACE}-${CALLER_SPAN}-${flags}`;
    const callEcho = (target: Client = client, meta?: Record<string, unknown>) =>
      target.callTool({ name: 'echoTool', arguments: { message: 'hi' }, ...(meta ? { _meta: meta } : {}) });

    it('keeps its own trace and links to the span named by `_meta.traceparent`', async () => {
      await callEcho(client, { traceparent: traceparent() });

      const span = requestSpans()[0];
      expect(span.links).toEqual([{ traceId: CALLER_TRACE, spanId: CALLER_SPAN }]);
      expect(span.traceId).toMatch(/^[0-9a-f]{32}$/);
      expect(span.traceId).not.toBe(CALLER_TRACE);
      expect(span.isRootSpan).toBe(true);
      expect(span.parentSpanId).toBeUndefined();
      expect(span.externalParentSpanId).toBeUndefined();
    });

    it('returns the request span in the reply `_meta` to a caller that sent trace context', async () => {
      const result = await callEcho(client, { traceparent: traceparent() });

      const span = requestSpans()[0];
      expect((result._meta as any)?.mastra?.traceparent).toBe(`00-${span.traceId}-${span.id}-01`);
      // The span records the handler's own result, not the added key.
      expect(span.output._meta?.mastra).toBeUndefined();
    });

    it('returns no span in the reply to a caller without trace context', async () => {
      const result = await callEcho(client);

      expect((result._meta as any)?.mastra).toBeUndefined();
    });

    it('records the request input without the trace fields', async () => {
      await callEcho(client, {
        traceparent: traceparent(),
        tracestate: 'vendor=1',
        baggage: 'tenant=one',
        custom: true,
      });
      await callEcho(client, { traceparent: traceparent() });

      expect(requestSpans()[0].input).toEqual({
        name: 'echoTool',
        arguments: { message: 'hi' },
        _meta: { custom: true },
      });
      expect(requestSpans()[1].input).toEqual({ name: 'echoTool', arguments: { message: 'hi' } });
    });

    it('links to the span named by the HTTP `traceparent` header', async () => {
      const headerClient = await connectClient(served.url, {}, { traceparent: traceparent() });
      try {
        endedSpans.length = 0;
        await callEcho(headerClient);
      } finally {
        await headerClient.close();
      }

      const span = requestSpans()[0];
      expect(span.links).toEqual([{ traceId: CALLER_TRACE, spanId: CALLER_SPAN }]);
      expect(span.traceId).not.toBe(CALLER_TRACE);
    });

    it('prefers `_meta.traceparent` over the HTTP header', async () => {
      const headerClient = await connectClient(
        served.url,
        {},
        { traceparent: '00-11111111111111111111111111111111-2222222222222222-01' },
      );
      try {
        endedSpans.length = 0;
        await callEcho(headerClient, { traceparent: traceparent() });
      } finally {
        await headerClient.close();
      }

      expect(requestSpans()[0].links).toEqual([{ traceId: CALLER_TRACE, spanId: CALLER_SPAN }]);
    });

    it('traces the request when the caller does not sample its own trace', async () => {
      await callEcho(client, { traceparent: traceparent('00') });

      expect(requestSpans()[0].links).toEqual([{ traceId: CALLER_TRACE, spanId: CALLER_SPAN }]);
    });

    it.each([
      ['not a traceparent', 'garbage'],
      ['an all-zero trace id', `00-${'0'.repeat(32)}-${CALLER_SPAN}-01`],
      ['an all-zero span id', `00-${CALLER_TRACE}-${'0'.repeat(16)}-01`],
      ['an invalid version', `ff-${CALLER_TRACE}-${CALLER_SPAN}-01`],
      ['uppercase hex', `00-${CALLER_TRACE.toUpperCase()}-${CALLER_SPAN}-01`],
      ['a non-string value', 42],
    ])('records no link when `traceparent` is %s', async (_label, value) => {
      await callEcho(client, { traceparent: value });

      expect(requestSpans()[0].links).toBeUndefined();
    });

    it('records no link for a request without trace context', async () => {
      await callEcho(client);

      expect(requestSpans()[0].links).toBeUndefined();
    });
  });

  it('records one root request span for a served tool call, and no separate tool span', async () => {
    const result = await client.callTool({ name: 'echoTool', arguments: { message: 'hi' } });

    expect(requestSpans()).toHaveLength(1);
    expect(spansOfType(SpanType.TOOL_CALL)).toHaveLength(0);

    const span = requestSpans()[0];
    expect(span.isRootSpan).toBe(true);
    expect(span.name).toBe('tools/call echoTool');
    expect(span.entityType).toBe(EntityType.MCP_SERVER);
    expect(span.entityId).toBe('traced-server');
    expect(span.entityName).toBe('Traced Server');
    expect(span.input).toEqual({ name: 'echoTool', arguments: { message: 'hi' } });
    expect(span.output).toEqual(handlerResult(result));
    expect(span.errorInfo).toBeUndefined();
    expect(span.attributes).toMatchObject({
      mcpMethod: 'tools/call',
      targetName: 'echoTool',
      mcpServer: 'Traced Server',
      serverVersion: '3.2.1',
      mcpProtocolVersion: '2026-07-28',
      clientName: 'test-client',
      clientVersion: '1.0.0',
    });
  });

  it.each([
    ['tools/list', () => client.listTools()],
    ['resources/list', () => client.listResources()],
    ['prompts/list', () => client.listPrompts()],
  ])('records a request span for %s, which reached no tool', async (method, call) => {
    await call();

    const span = requestSpans()[0];
    expect(requestSpans()).toHaveLength(1);
    expect(span.name).toBe(method);
    expect(span.attributes.mcpMethod).toBe(method);
    expect(span.attributes.targetName).toBeUndefined();
    expect(span.errorInfo).toBeUndefined();
  });

  it('names the request span after the resource it reads', async () => {
    await client.readResource({ uri: 'file://known' });

    const span = requestSpans()[0];
    expect(span.name).toBe('resources/read file://known');
    expect(span.attributes.targetName).toBe('file://known');
  });

  it('fails the request span when the tool is unknown', async () => {
    await client.callTool({ name: 'nope', arguments: {} });

    const span = requestSpans()[0];
    expect(span.errorInfo?.id).toBe('MCP_SERVER_REQUEST_FAILED');
    expect(span.errorInfo?.message).toContain('Unknown tool: nope');
  });

  it('ends the span successfully when a tool returns `error` as ordinary data', async () => {
    const result = await client.callTool({ name: 'flagTool', arguments: { id: 'r1' } });

    const span = requestSpans()[0];
    expect(span.errorInfo).toBeUndefined();
    expect(span.output).toEqual(handlerResult(result));
    expect((result as any).structuredContent).toEqual({ id: 'r1', error: true, detail: 'flagged' });
  });

  it('ends the span successfully when a tool suspends for more input', async () => {
    // A suspension is a completed round, not a failure: the span ends via `end()`.
    const asking = await connectClient(served.url, {
      inputRequired: { autoFulfill: false },
      capabilities: { elicitation: { form: {} } },
    });
    try {
      const result = await asking.callTool({ name: 'askingTool', arguments: {} }, { allowInputRequired: true });

      expect((result as any).resultType).toBe('input_required');
      const span = requestSpans()[0];
      expect(span.errorInfo).toBeUndefined();
      expect(span.output).toEqual(handlerResult(result));
    } finally {
      await asking.close();
    }
  });

  it('fails the span with the error itself, not its serialized text', async () => {
    const result = await client.callTool({ name: 'throwingTool', arguments: {} });

    expect((result as any).isError).toBe(true);
    const span = requestSpans()[0];
    // The client is handed `JSON.stringify(error.toJSON())`; the span keeps the error.
    expect(span.errorInfo?.message).toBe('Payment API timed out');
    expect(span.errorInfo?.message).not.toContain('{');
  });

  it('records a request span for an in-process executeTool call', async () => {
    const execution = await server.executeTool('echoTool', { message: 'direct' });

    expect(requestSpans()).toHaveLength(1);
    expect(spansOfType(SpanType.TOOL_CALL)).toHaveLength(0);

    const span = requestSpans()[0];
    expect(span.isRootSpan).toBe(true);
    expect(span.name).toBe('tools/call echoTool');
    expect(span.input).toEqual({ name: 'echoTool', arguments: { message: 'direct' } });
    expect(span.output).toEqual(execution);
    expect(span.attributes.mcpProtocolVersion).toBeUndefined();
  });

  it('records a failed request span when executeTool is given an unknown tool', async () => {
    await expect(server.executeTool('nope', {})).rejects.toThrow('Unknown tool: nope');

    expect(requestSpans()).toHaveLength(1);
    const span = requestSpans()[0];
    expect(span.name).toBe('tools/call nope');
    expect(span.errorInfo?.id).toBe('MCP_SERVER_TOOL_EXECUTE_PREPARATION_FAILED');
  });

  it('carries the request context executeTool was given', async () => {
    const requestContext = new RequestContext();
    requestContext.set('user', { id: 'studio-user' });
    await server.executeTool('echoTool', { message: 'direct' }, { requestContext });

    expect(requestSpans()[0].requestContext).toMatchObject({ user: { id: 'studio-user' } });
  });

  it('fails the request span when executeTool rejects the arguments', async () => {
    await expect(server.executeTool('echoTool', { wrong: 'shape' })).rejects.toThrow();

    const span = requestSpans()[0];
    expect(span.errorInfo?.id).toBe('MCP_SERVER_TOOL_INVALID_INPUT');
  });

  it('carries the caller identity on the span', async () => {
    // The span can only be given a request context when it is created, so the
    // auth mapper has to run first. Without that the span shows no caller.
    const authed = new MCPServer({
      id: 'authed-server',
      name: 'Authed Server',
      version: '1.0.0',
      tools: { echoTool: tools.echoTool },
      mapAuthInfoToUser: async () => ({ id: 'user-1' }),
    });
    const authedSpans: any[] = [];
    new Mastra({
      logger: false,
      mcpServers: { authed },
      observability: new Observability({
        configs: {
          default: {
            serviceName: 'mcp-auth-test',
            exporters: [
              {
                name: 'auth-collector',
                async exportTracingEvent(event: { type: string; exportedSpan?: any }) {
                  if (event.type === TracingEventType.SPAN_ENDED) authedSpans.push(event.exportedSpan);
                },
                async flush() {},
                async shutdown() {},
              },
            ],
          },
        },
      }),
    });
    const authedHttp = await serveHTTP(authed, { auth: { token: 't', clientId: 'c1', scopes: [] } });
    try {
      const authedClient = await connectClient(authedHttp.url);
      await authedClient.callTool({ name: 'echoTool', arguments: { message: 'hi' } });
      await authedClient.close();

      const span = authedSpans.find(s => s.type === SpanType.MCP_SERVER_REQUEST);
      expect(span.requestContext).toMatchObject({ user: { id: 'user-1' }, authInfo: { clientId: 'c1' } });
    } finally {
      await authedHttp.close();
    }
  });
});
