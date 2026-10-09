import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import { afterEach, describe, expect, it } from 'vitest';

import { Observability } from './default';
import { TestExporter } from './exporters';

describe('signal interruption tracing', () => {
  let observability: Observability | undefined;

  afterEach(async () => {
    await observability?.shutdown();
  });

  it('gives a signal-cancelled model request its own inference span under the same step', async () => {
    let calls = 0;
    const model = new MockLanguageModelV2({
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
    const exporter = new TestExporter();
    const agent = new Agent({
      id: 'signal-interruption-agent',
      name: 'Signal Interruption Agent',
      instructions: 'Test',
      model,
      memory: new MockMemory(),
    });
    observability = new Observability({
      configs: { default: { serviceName: 'signal-interruption-tracing', exporters: [exporter] } },
    });
    const mastra = new Mastra({ logger: false, agents: { agent }, observability });
    const registered = mastra.getAgent('agent');
    const scope = { threadId: 'thread-1', resourceId: 'resource-1' };

    const output = await registered.stream('question', {
      memory: { thread: scope.threadId, resource: scope.resourceId },
    });
    let reasoningSeen!: () => void;
    const reasoningVisible = new Promise<void>(resolve => (reasoningSeen = resolve));
    const consumption = (async () => {
      for await (const chunk of output.fullStream) {
        if (chunk.type === 'reasoning-delta') reasoningSeen();
      }
    })();
    await reasoningVisible;
    const signal = await registered.sendSignal({ type: 'user-message', contents: 'follow-up' }, scope);
    await signal.accepted;
    await consumption;
    expect(await output.text).toBe('replacement answer');
    await new Promise(resolve => setTimeout(resolve, 100));

    const ended = exporter.getByEventType(TracingEventType.SPAN_ENDED).map(event => event.exportedSpan);
    const steps = ended.filter(span => span.type === SpanType.MODEL_STEP);
    const inferences = ended.filter(span => span.type === SpanType.MODEL_INFERENCE);
    expect(steps).toHaveLength(1);
    expect(inferences).toHaveLength(2);
    expect(inferences.map(span => span.parentSpanId)).toEqual([steps[0]!.id, steps[0]!.id]);
    expect(inferences.map(span => span.attributes?.finishReason)).toEqual(['interrupted', 'stop']);
    const chunkParents = (text: string) =>
      ended
        .filter(span => span.type === SpanType.MODEL_CHUNK && JSON.stringify(span.output).includes(text))
        .map(span => span.parentSpanId);
    expect(chunkParents('STALE_REASONING')).toEqual([inferences[0]!.id]);
    expect(chunkParents('replacement answer')).toEqual([inferences[1]!.id]);
    expect(exporter.getIncompleteSpans()).toEqual([]);
  });
});
