import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { Observability } from './default';
import { TestExporter } from './exporters';

const SUSPENDED_STEP_USAGE = { inputTokens: 100, outputTokens: 20, totalTokens: 120 };

const askTool = createTool({
  id: 'ask',
  description: 'Ask a person',
  inputSchema: z.object({}),
  resumeSchema: z.object({ answer: z.string() }),
  execute: async (_input, { agent }) => agent!.suspend({ question: 'which one?' }),
});

const approvalTool = createTool({
  id: 'approve',
  description: 'Needs approval',
  inputSchema: z.object({}),
  requireApproval: true,
  execute: async () => ({ ok: true }),
});

describe('tracing when a tool call suspends', () => {
  let observability: Observability | undefined;

  afterEach(async () => {
    await observability?.shutdown();
  });

  describe.each(['suspend', 'approval'] as const)('%s', kind => {
    it('records the suspended step usage on model spans and token metrics', async () => {
      const toolName = kind === 'suspend' ? 'ask' : 'approve';
      const exporter = new TestExporter();
      const model = new MockLanguageModelV2({
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'tool-call', toolCallId: 'call-1', toolName, input: '{}', providerExecuted: false },
            { type: 'finish', finishReason: 'tool-calls', usage: SUSPENDED_STEP_USAGE },
          ]),
        }),
      });
      const agent = new Agent({
        id: 'usage-agent',
        name: 'usage-agent',
        instructions: 'use the tool',
        model,
        tools: kind === 'suspend' ? { ask: askTool } : { approve: approvalTool },
      });
      observability = new Observability({
        configs: { default: { serviceName: 'suspended-usage', exporters: [exporter] } },
      });
      new Mastra({ logger: false, agents: { agent }, storage: new InMemoryStore(), observability });

      const output = await agent.stream('Hello');
      await output.consumeStream();
      expect(output.status).toBe('suspended');
      await new Promise(resolve => setTimeout(resolve, 100));

      const ended = (type: SpanType) =>
        exporter
          .getByEventType(TracingEventType.SPAN_ENDED)
          .filter(event => event.exportedSpan.type === type)
          .map(event => event.exportedSpan);

      const expectedUsage = { inputTokens: 100, outputTokens: 20 };
      for (const type of [SpanType.MODEL_GENERATION, SpanType.MODEL_STEP, SpanType.MODEL_INFERENCE]) {
        const spans = ended(type);
        expect(spans, `${type} spans`).toHaveLength(1);
        expect(spans[0]!.attributes?.usage, `${type} usage`).toMatchObject(expectedUsage);
      }
      expect(ended(SpanType.MODEL_STEP)[0]!.attributes?.finishReason).toBe('suspended');
      expect(exporter.getIncompleteSpans().map(entry => entry.span?.name)).toEqual([]);

      const metricValue = (name: string) =>
        exporter.getMetricsByName(name).reduce((sum, metric) => sum + metric.value, 0);
      expect(metricValue('mastra_model_total_input_tokens')).toBe(100);
      expect(metricValue('mastra_model_total_output_tokens')).toBe(20);
    });
  });
});
