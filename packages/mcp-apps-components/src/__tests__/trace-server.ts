import { createTool } from '@mastra/core/tools';
import { MCPServer } from '@mastra/mcp';
import type { AppResources } from '@mastra/mcp';
import { z } from 'zod';

export const TRACE_VIEWER_URI = 'ui://mastra/trace-viewer';

const at = (seconds: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, seconds)).toISOString();

/** An agent run that called a tool, as the built-in server's `get_trace` returns its spans. */
export const traceSpans = [
  {
    spanId: 'root',
    parentSpanId: null,
    name: "agent run: 'weather-agent'",
    spanType: 'agent_run',
    startedAt: at(0),
    endedAt: at(6),
  },
  {
    spanId: 'llm',
    parentSpanId: 'root',
    name: "llm: 'gpt-5'",
    spanType: 'model_generation',
    startedAt: at(1),
    endedAt: at(3),
  },
  {
    spanId: 'tool',
    parentSpanId: 'root',
    name: "tool: 'get-weather'",
    spanType: 'tool_call',
    startedAt: at(3),
    endedAt: at(5),
  },
].map(span => ({ traceId: 'trace-1', isEvent: false, createdAt: span.startedAt, updatedAt: span.endedAt, ...span }));

/**
 * The tools the trace viewer uses, answering as the built-in server does: `get_trace` returns light spans,
 * `pageSize` at a time with a `nextOffset` while more remain, and `get_span` returns one span in full.
 */
export function traceServer({ pageSize = traceSpans.length, appResources = {} as AppResources } = {}) {
  const calls: { tool: string; args: Record<string, unknown> }[] = [];
  const server = new MCPServer({
    id: 'traces',
    name: 'Traces',
    version: '1.0.0',
    appResources,
    tools: {
      get_trace: createTool({
        id: 'get_trace',
        description: 'Reads a trace',
        inputSchema: z.object({ traceId: z.string(), offset: z.number().optional() }),
        mcp: { _meta: { ui: { resourceUri: TRACE_VIEWER_URI } } },
        execute: async args => {
          calls.push({ tool: 'get_trace', args });
          if (args.traceId !== 'trace-1') throw new Error(`Trace ${args.traceId} not found`);
          const offset = args.offset ?? 0;
          const spans = traceSpans.slice(offset, offset + pageSize);
          const next = offset + spans.length;
          return {
            traceId: 'trace-1',
            spanCount: traceSpans.length,
            spans,
            ...(next < traceSpans.length ? { nextOffset: next } : {}),
          };
        },
      }),
      get_span: createTool({
        id: 'get_span',
        description: 'Reads a span',
        inputSchema: z.object({ traceId: z.string(), spanId: z.string() }),
        execute: async args => {
          calls.push({ tool: 'get_span', args });
          const span = traceSpans.find(candidate => candidate.spanId === args.spanId);
          if (!span) throw new Error(`Span ${args.spanId} not found`);
          return { span: { ...span, input: { city: 'Lisbon' }, output: { forecast: 'Sunny, 24°C' } } };
        },
      }),
    },
  });
  return { server, calls };
}
