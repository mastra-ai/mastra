import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { MockMemory } from '@mastra/core/memory';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import { Observability } from '@mastra/observability';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { McpServer } from '@modelcontextprotocol/server';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MCPClient } from './configuration.js';

/**
 * End-to-end acceptance test for the MCP `isError` fix (#18481).
 *
 * A spec-compliant MCP server reports a tool *execution* failure in-band by
 * returning a normal `CallToolResult` with `isError: true` and the failure text
 * in `content`. The fix routes that onto Mastra's failed-tool-call path (the
 * wrapped tool throws), so the failure must be visible in all four downstream
 * surfaces. This test drives a real Agent against a real MCP server through the
 * real `MCPClient` and asserts the *same* failed call shows up as failed in:
 *
 *   1. the stream (a `tool-error` chunk),
 *   2. the persisted assistant message part (`state: 'output-error'`),
 *   3. the tool span (span carries `errorInfo`),
 *   4. the scorer/eval input (`scoringData.output`).
 */
describe('MCP isError - agent integration (four surfaces)', () => {
  const ERROR_TEXT = 'API key invalid: simulated MCP tool failure';
  const SERVER_NAME = 'failing';
  const TOOL_NAME = 'boom';
  // MCPClient namespaces tools as `${serverName}_${toolName}`.
  const NAMESPACED_TOOL = `${SERVER_NAME}_${TOOL_NAME}`;

  let httpServer: HttpServer;
  let mcpServer: McpServer;
  let baseUrl: URL;
  let mcp: MCPClient;

  beforeAll(async () => {
    httpServer = createServer();
    mcpServer = new McpServer({ name: 'failing-mcp-server', version: '1.0.0' }, { capabilities: { tools: {} } });

    // A spec-compliant in-band failure: isError + the reason in `content`.
    mcpServer.registerTool(
      TOOL_NAME,
      {
        description: 'A tool that always fails in-band',
        inputSchema: { reason: z.string().describe('Why the caller wants to run it').default('go') },
      },
      async (): Promise<CallToolResult> => {
        return {
          isError: true,
          content: [{ type: 'text', text: ERROR_TEXT }],
        };
      },
    );

    // Stateless mode: SDK requires a fresh transport per request.
    httpServer.on('request', async (req, res) => {
      await mcpServer.close().catch(() => {});
      const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res);
    });

    baseUrl = await new Promise<URL>(resolve => {
      httpServer.listen(0, '127.0.0.1', () => {
        const addr = httpServer.address() as AddressInfo;
        resolve(new URL(`http://127.0.0.1:${addr.port}/mcp`));
      });
    });

    mcp = new MCPClient({
      id: 'iserror-integration',
      servers: {
        [SERVER_NAME]: { url: baseUrl },
      },
    });
  });

  afterAll(async () => {
    await mcp?.disconnect().catch(() => {});
    await mcpServer?.close().catch(() => {});
    httpServer?.close();
  });

  it('surfaces the same failed MCP call in stream, persistence, span, and scorer input', async () => {
    const tools = await mcp.listTools();
    expect(tools[NAMESPACED_TOOL]).toBeDefined();

    // Model calls the failing tool on step 1, then (after seeing the error fed
    // back) returns text on step 2 so the loop terminates cleanly.
    let step = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        step++;
        if (step === 1) {
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolCallType: 'function',
                toolName: NAMESPACED_TOOL,
                input: '{"reason":"go"}',
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
          };
        }
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'I could not complete that, the tool failed.' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    });

    // --- Surface 3 wiring: collect exported spans ---
    const endedSpans: any[] = [];
    const collectingExporter = {
      name: 'collecting-exporter',
      async exportTracingEvent(event: { type: string; exportedSpan?: any }) {
        if (event.type === TracingEventType.SPAN_ENDED) {
          endedSpans.push(event.exportedSpan);
        }
      },
      async flush() {},
      async shutdown() {},
    };
    const observability = new Observability({
      // Keep the raw error text intact so we can assert on it.
      sensitiveDataFilter: false,
      configs: {
        default: {
          serviceName: 'mcp-iserror-test',
          exporters: [collectingExporter],
        },
      },
    });

    // --- Surface 2 wiring: persistence ---
    const memory = new MockMemory();
    const thread = randomUUID();
    const resource = randomUUID();

    const agent = new Agent({
      id: 'mcp-iserror-agent',
      name: 'mcp-iserror-agent',
      instructions: 'Call the failing tool when asked.',
      model,
      tools,
      memory,
    });

    const mastra = new Mastra({
      logger: false,
      observability,
      agents: { agent },
    });

    const boundAgent = mastra.getAgent('agent');

    const stream = await boundAgent.stream('Please call the failing tool', {
      memory: { thread, resource },
      returnScorerData: true,
      maxSteps: 3,
    });

    // --- Surface 1: stream chunk ---
    const toolErrorChunks: any[] = [];
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-error') {
        toolErrorChunks.push(chunk);
      }
    }
    expect(toolErrorChunks.length).toBeGreaterThan(0);
    const toolErrorChunk = toolErrorChunks.find(c => c.payload?.toolName === NAMESPACED_TOOL) ?? toolErrorChunks[0];
    expect(String(toolErrorChunk.payload.error?.message ?? toolErrorChunk.payload.error)).toContain(ERROR_TEXT);

    const out = await stream.getFullOutput();

    // --- Surface 4: scorer / eval input ---
    // The error text must reach the scorer payload so an eval/judge can see why
    // the call failed (and the trace stays enough to replay the failure path).
    expect(out.scoringData).toBeDefined();
    const scoredToolInvocation = (out.scoringData!.output as any[])
      .filter(m => m.role === 'assistant' && Array.isArray(m.content?.parts))
      .flatMap(m => m.content.parts)
      .find((part: any) => part?.type === 'tool-invocation' && part.toolInvocation?.toolName === NAMESPACED_TOOL);
    expect(scoredToolInvocation).toBeDefined();
    expect(JSON.stringify(scoredToolInvocation.toolInvocation)).toContain(ERROR_TEXT);

    // --- Surface 2: persisted message part ---
    // The persisted tool invocation must carry the server's error text as its
    // payload, so the stored trace explains the failure.
    const recalled = await memory.recall({ threadId: thread, resourceId: resource });
    const persistedToolPart = recalled.messages
      .filter((m: any) => m.role === 'assistant' && Array.isArray(m.content?.parts))
      .flatMap((m: any) => m.content.parts)
      .find((part: any) => part?.type === 'tool-invocation' && part.toolInvocation?.toolName === NAMESPACED_TOOL);
    expect(persistedToolPart).toBeDefined();
    expect(JSON.stringify(persistedToolPart.toolInvocation)).toContain(ERROR_TEXT);

    // --- Surface 3: tool span status ---
    const erroredToolSpan = endedSpans.find(
      span =>
        (span.type === SpanType.TOOL_CALL || span.type === SpanType.MCP_TOOL_CALL) &&
        span.errorInfo != null &&
        String(span.errorInfo.message).includes(ERROR_TEXT),
    );
    expect(erroredToolSpan).toBeDefined();
  });
});
