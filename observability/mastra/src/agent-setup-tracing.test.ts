import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { TracingEventType } from '@mastra/core/observability';
import type { AnyExportedSpan, ObservabilityExporter, TracingEvent } from '@mastra/core/observability';
import { MockStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { Observability } from './default';

class EndedSpans implements ObservabilityExporter {
  name = 'ended-spans';
  spans: AnyExportedSpan[] = [];
  async exportTracingEvent(event: TracingEvent) {
    if (event.type === TracingEventType.SPAN_ENDED) this.spans.push(event.exportedSpan);
  }
  async flush() {}
  async shutdown() {}
  named(name: string) {
    return this.spans.filter(span => span.name === name);
  }
}

function mockModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'response-metadata', id: '1' },
        { type: 'text-delta', id: '1', delta: 'done' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
}

let observability: Observability | undefined;

afterEach(async () => {
  await observability?.shutdown();
  observability = undefined;
});

describe('agent setup tracing', () => {
  it('records how long the tool sources and the thread load take before the first model call', async () => {
    const exporter = new EndedSpans();
    observability = new Observability({ configs: { test: { serviceName: 'agent-setup', exporters: [exporter] } } });
    const lookup = createTool({
      id: 'lookup',
      description: 'Look something up',
      inputSchema: z.object({}),
      execute: async () => 'ok',
    });
    const agent = new Agent({
      id: 'setup',
      name: 'Setup',
      instructions: 'Test',
      model: mockModel(),
      memory: new MockMemory(),
      // A slow dynamic tool source, like one that lists an MCP server's tools on every run.
      tools: async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
        return { lookup };
      },
    });
    const mastra = new Mastra({ storage: new MockStore(), observability, agents: { agent } });

    const output = await mastra.getAgent('agent').stream('hi', { memory: { thread: 'thread-1', resource: 'user-1' } });
    await output.consumeStream();
    await observability.flush();

    const [run] = exporter.named("agent run: 'setup'");
    const [prepare] = exporter.named('agent:prepare-tools');
    const [thread] = exporter.named('agent:load-thread');
    expect(run).toBeDefined();
    expect(prepare?.parentSpanId).toBe(run!.id);
    const prepared = prepare!.output as { toolCount: number; slowSourcesMs?: Record<string, number> };
    expect(prepared.toolCount).toBeGreaterThanOrEqual(1);
    // Only the slow source is named; the fast ones stay out of the span.
    expect(Object.keys(prepared.slowSourcesMs ?? {})).toEqual(['assigned']);
    expect(prepared.slowSourcesMs!.assigned).toBeGreaterThanOrEqual(140);
    expect(thread?.traceId).toBe(run!.traceId);
    expect(thread!.output).toEqual({ created: true });
  });
});
