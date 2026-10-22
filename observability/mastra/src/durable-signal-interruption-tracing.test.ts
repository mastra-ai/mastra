import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { SpanType } from '@mastra/core/observability';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { Observability } from './default';
import { TestExporter } from './exporters';

function reasoningThenAnswerModel() {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async ({ abortSignal }) => {
      calls++;
      if (calls === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({ type: 'reasoning-start', id: 'stale' });
              controller.enqueue({ type: 'reasoning-delta', id: 'stale', delta: 'STALE_REASONING' });
              abortSignal?.addEventListener('abort', () => controller.error(abortSignal.reason), { once: true });
            },
          }),
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'replacement answer' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 } },
        ]),
      };
    },
  });
}

describe.each(['durable', 'evented'] as const)('%s signal interruption tracing', variant => {
  it('ends the cancelled attempt’s step and inference spans as interrupted', async () => {
    const exporter = new TestExporter();
    const agent = new Agent({
      id: `signal-interruption-${variant}`,
      name: 'Signal Interruption Agent',
      instructions: 'Test',
      model: reasoningThenAnswerModel(),
      memory: new MockMemory(),
    });
    const wrapped = variant === 'durable' ? createDurableAgent({ agent }) : createEventedAgent({ agent });
    const mastra = new Mastra({
      logger: false,
      agents: { wrapped } as any,
      storage: new InMemoryStore(),
      observability: new Observability({
        configs: { default: { serviceName: 'durable-signal-interruption', exporters: [exporter] } },
      }),
    });
    const registered = mastra.getAgent('wrapped') as any;
    const scope = { threadId: crypto.randomUUID(), resourceId: crypto.randomUUID() };

    const res = await registered.stream('question', { memory: { thread: scope.threadId, resource: scope.resourceId } });
    let reasoningSeen!: () => void;
    const reasoningVisible = new Promise<void>(resolve => (reasoningSeen = resolve));
    const consumption = (async () => {
      for await (const chunk of res.fullStream) {
        if (chunk.type === 'reasoning-delta') reasoningSeen();
      }
    })();
    try {
      await reasoningVisible;
      const signal = await registered.sendSignal({ type: 'user-message', contents: 'follow-up' }, scope);
      await signal.accepted;
      await consumption;
      expect(await res.output.text).toBe('replacement answer');
      await new Promise(resolve => setTimeout(resolve, 300));
    } finally {
      res.cleanup?.();
    }

    const steps = exporter.getSpansByType(SpanType.MODEL_STEP);
    const inferences = exporter.getSpansByType(SpanType.MODEL_INFERENCE);
    const interruptedStep = steps.find(span => span.attributes?.finishReason === 'interrupted');
    const answeredStep = steps.find(span => span.attributes?.finishReason === 'stop');
    expect(steps).toHaveLength(2);
    expect(interruptedStep).toBeDefined();
    expect(answeredStep).toBeDefined();
    const inferenceUnder = (stepId: string) => inferences.filter(span => span.parentSpanId === stepId);
    expect(inferenceUnder(interruptedStep!.id).map(span => span.attributes?.finishReason)).toEqual(['interrupted']);
    expect(inferenceUnder(answeredStep!.id).map(span => span.attributes?.finishReason)).toEqual(['stop']);
    expect(exporter.getIncompleteSpans()).toEqual([]);
  }, 30_000);
});
