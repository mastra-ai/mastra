/**
 * On Inngest the LLM step's tracing span is rebuilt and never exported, so a
 * client_tool_call span parented on it pointed at a span missing from the trace.
 * It must be parented on the exported agent_run span.
 */
import { Agent } from '@mastra/core/agent';
import type { AnyExportedSpan, ObservabilityExporter, TracingEvent } from '@mastra/core/observability';
import { TracingEventType } from '@mastra/core/observability';
import { Observability } from '@mastra/observability';
import { simulateReadableStream } from 'ai';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createInngestAgent } from '../durable-agent';
import {
  getSharedInngest,
  getSharedMastra,
  setupSharedTestInfrastructure,
  teardownSharedTestInfrastructure,
} from './durable-agent.test.utils';

vi.setConfig({ testTimeout: 150_000, hookTimeout: 90_000 });

const ended: AnyExportedSpan[] = [];

function clientToolModel(): any {
  let call = 0;
  return {
    specificationVersion: 'v2',
    provider: 'mock',
    modelId: 'client-tool-model',
    supportedUrls: {},
    async doGenerate() {
      throw new Error('doGenerate not used');
    },
    async doStream() {
      const first = call++ === 0;
      const chunks: any[] = [
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: `resp-${call}`, modelId: 'client-tool-model', timestamp: new Date(0) },
      ];
      if (first) {
        chunks.push({ type: 'tool-call', toolCallId: 'call-1', toolName: 'getLocation', input: '{}' });
      } else {
        chunks.push(
          { type: 'text-start', id: 't1' },
          { type: 'text-delta', id: 't1', delta: 'done' },
          { type: 'text-end', id: 't1' },
        );
      }
      chunks.push({
        type: 'finish',
        finishReason: first ? 'tool-calls' : 'stop',
        usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
      });
      return { stream: simulateReadableStream({ chunks }), rawCall: { rawPrompt: null, rawSettings: {} } };
    },
  };
}

function textOnlyModel(): any {
  return {
    specificationVersion: 'v2',
    provider: 'mock',
    modelId: 'text-only-model',
    supportedUrls: {},
    async doGenerate() {
      throw new Error('doGenerate not used');
    },
    async doStream() {
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'resp-text', modelId: 'text-only-model', timestamp: new Date(0) },
            { type: 'text-start', id: 't1' },
            { type: 'text-delta', id: 't1', delta: 'done' },
            { type: 'text-end', id: 't1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ],
        }),
      };
    },
  };
}

const clockOf = (s: AnyExportedSpan | undefined) => {
  const value = (s?.attributes as { completionStartTime?: Date | string } | undefined)?.completionStartTime;
  return value ? new Date(value).getTime() : undefined;
};

/** The first inference, generation and agent_run of the named agent must share its clocks and time to first token. */
async function expectSharedClock(agentName: string) {
  await vi.waitFor(() => {
    expect(ended.some(s => s.type === 'agent_run' && s.entityName === agentName)).toBe(true);
  });
  const agentRun = ended.find(s => s.type === 'agent_run' && s.entityName === agentName)!;
  const inTrace = ended.filter(s => s.traceId === agentRun.traceId);
  const inference = inTrace
    .filter(s => s.type === 'model_inference')
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0];
  expect(clockOf(inference)).toBeTypeOf('number');
  expect(inference!.timeToFirstTokenMs).toBeTypeOf('number');
  for (const span of [inTrace.find(s => s.type === 'model_generation'), agentRun]) {
    const inferenceStartTime = (span?.attributes as { inferenceStartTime?: Date | string } | undefined)
      ?.inferenceStartTime;
    expect(clockOf(span)).toBe(clockOf(inference));
    expect(inferenceStartTime && new Date(inferenceStartTime).getTime()).toBe(inference!.startTime.getTime());
    expect(span?.timeToFirstTokenMs).toBe(inference!.timeToFirstTokenMs);
  }
}

describe('Inngest client tool span parent', () => {
  beforeAll(async () => {
    await setupSharedTestInfrastructure({
      observability: new Observability({
        configs: {
          default: {
            serviceName: 'inngest-client-tool-span-test',
            exporters: [
              {
                name: 'capture',
                async exportTracingEvent(event: TracingEvent) {
                  if (event.type === TracingEventType.SPAN_ENDED) ended.push(event.exportedSpan);
                },
                async shutdown() {},
              } satisfies ObservabilityExporter,
            ],
          },
        },
      }),
    });
  });

  afterAll(async () => {
    await teardownSharedTestInfrastructure();
  });

  it('parents client_tool_call on the exported agent_run span', async () => {
    const agent = new Agent({
      id: `client-tool-span-agent-${Date.now()}`,
      name: 'Client Tool Span Agent',
      instructions: 'Get the location.',
      model: clientToolModel(),
    });
    const inngestAgent = createInngestAgent({ agent, inngest: getSharedInngest() });
    getSharedMastra().addAgent(inngestAgent);

    const result = await inngestAgent.stream([{ role: 'user', content: 'Where am I?' }], {
      clientTools: {
        getLocation: { id: 'getLocation', description: 'Get the user location', inputSchema: z.object({}) } as any,
      },
    });
    try {
      for await (const _chunk of result.output.fullStream) {
        // drain
      }
    } finally {
      result.cleanup();
    }

    await vi.waitFor(() => {
      expect(ended.some(s => s.type === 'client_tool_call')).toBe(true);
      expect(ended.some(s => s.type === 'agent_run')).toBe(true);
    });
    const clientSpan = ended.find(s => s.type === 'client_tool_call')!;
    const parent = ended.find(s => s.id === clientSpan.parentSpanId);
    expect(parent?.type).toBe('agent_run');
  });

  it('ends generation and agent_run with the first chunk clock carried through the loop state', async () => {
    const agent = new Agent({
      id: `ttfc-span-agent-${Date.now()}`,
      name: 'TTFC Span Agent',
      instructions: 'Get the location.',
      model: clientToolModel(),
    });
    const inngestAgent = createInngestAgent({ agent, inngest: getSharedInngest() });
    getSharedMastra().addAgent(inngestAgent);

    const result = await inngestAgent.stream([{ role: 'user', content: 'Where am I?' }], {
      clientTools: {
        getLocation: { id: 'getLocation', description: 'Get the user location', inputSchema: z.object({}) } as any,
      },
    });
    try {
      for await (const _chunk of result.output.fullStream) {
        // drain
      }
    } finally {
      result.cleanup();
    }

    await expectSharedClock('TTFC Span Agent');
  });

  it('carries the first chunk clock on a run without tool calls', async () => {
    const agent = new Agent({
      id: `ttfc-text-agent-${Date.now()}`,
      name: 'TTFC Text Agent',
      instructions: 'Say done.',
      model: textOnlyModel(),
    });
    const inngestAgent = createInngestAgent({ agent, inngest: getSharedInngest() });
    getSharedMastra().addAgent(inngestAgent);

    const result = await inngestAgent.stream([{ role: 'user', content: 'Go' }]);
    try {
      for await (const _chunk of result.output.fullStream) {
        // drain
      }
    } finally {
      result.cleanup();
    }

    await expectSharedClock('TTFC Text Agent');
  });
});
