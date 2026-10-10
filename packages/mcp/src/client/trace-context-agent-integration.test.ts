import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import { createTool } from '@mastra/core/tools';
import { Observability } from '@mastra/observability';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { serveHTTP } from '../server/__tests__/harness.mock';
import type { ServedHTTP } from '../server/__tests__/harness.mock';
import { MCPServer } from '../server/server';
import { MCPClient } from './configuration.js';

/**
 * A Mastra agent calls a Mastra MCP server through the real `MCPClient` over
 * HTTP. The agent and the server each have their own Mastra instance and
 * exporter, as two processes would.
 */
describe('MCP trace context - agent to MCPServer round trip', () => {
  const agentSpans: any[] = [];
  const serverSpans: any[] = [];
  const collectInto = (spans: any[]) => ({
    name: 'collecting-exporter',
    async exportTracingEvent(event: { type: string; exportedSpan?: any }) {
      if (event.type === TracingEventType.SPAN_ENDED) spans.push(event.exportedSpan);
    },
    async flush() {},
    async shutdown() {},
  });

  let served: ServedHTTP;
  let mcp: MCPClient;

  beforeAll(async () => {
    const server = new MCPServer({
      id: 'weather-server',
      name: 'Weather Server',
      version: '1.0.0',
      tools: {
        weather: createTool({
          id: 'weather',
          description: 'Reports the weather for a city',
          inputSchema: z.object({ city: z.string() }),
          execute: async ({ city }) => ({ city, forecast: 'sunny' }),
        }),
      },
    });
    new Mastra({
      logger: false,
      mcpServers: { server },
      observability: new Observability({
        configs: { default: { serviceName: 'mcp-server-side', exporters: [collectInto(serverSpans)] } },
      }),
    });
    served = await serveHTTP(server);
    mcp = new MCPClient({ id: 'trace-context-integration', servers: { weather: { url: served.url } } });
  });

  afterAll(async () => {
    await mcp?.disconnect().catch(() => {});
    await served?.close();
  });

  it('links the MCP tool call span and the served request to each other', async () => {
    let step = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        step++;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: `id-${step}`, modelId: 'mock-model-id', timestamp: new Date(0) },
            ...(step === 1
              ? [
                  {
                    type: 'tool-call' as const,
                    toolCallId: 'call-1',
                    toolCallType: 'function' as const,
                    toolName: 'weather_weather',
                    input: '{"city":"Paris"}',
                  },
                ]
              : [
                  { type: 'text-start' as const, id: 'text-1' },
                  { type: 'text-delta' as const, id: 'text-1', delta: 'It is sunny in Paris.' },
                  { type: 'text-end' as const, id: 'text-1' },
                ]),
            {
              type: 'finish',
              finishReason: step === 1 ? ('tool-calls' as const) : ('stop' as const),
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    });

    const agent = new Agent({
      id: 'weather-agent',
      name: 'Weather Agent',
      instructions: 'Use the weather tool.',
      model,
      tools: await mcp.listTools(),
    });
    const mastra = new Mastra({
      logger: false,
      agents: { agent },
      observability: new Observability({
        configs: { default: { serviceName: 'agent-side', exporters: [collectInto(agentSpans)] } },
      }),
    });

    const stream = await mastra.getAgent('agent').stream('What is the weather in Paris?');
    expect(await stream.text).toBe('It is sunny in Paris.');

    const toolCall = agentSpans.find(span => span.type === SpanType.MCP_TOOL_CALL);
    const request = serverSpans.find(span => span.name === 'tools/call weather');
    expect(toolCall).toBeDefined();
    expect(request).toBeDefined();

    // Each side keeps its own trace and links to the other.
    expect(request.traceId).not.toBe(toolCall.traceId);
    expect(request.links).toEqual([{ traceId: toolCall.traceId, spanId: toolCall.id }]);
    expect(toolCall.links).toEqual([{ traceId: request.traceId, spanId: request.id }]);
    // Requests made outside a tool call (discovery) carry no caller span.
    const discovery = serverSpans.find(span => span.name === 'tools/list');
    expect(discovery.links).toBeUndefined();
  });
});
