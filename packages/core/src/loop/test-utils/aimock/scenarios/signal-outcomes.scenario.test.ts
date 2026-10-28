import { createOpenAI } from '@ai-sdk/openai-v5';
import { expect, it, vi } from 'vitest';
import { Observability } from '../../../../../../../observability/mastra/src/default';
import { MastraStorageExporter } from '../../../../../../../observability/mastra/src/exporters/mastra-storage';
import { Memory } from '../../../../../../../packages/memory/src';
import type { TracingEvent } from '../../../../observability';
import { SpanType, TracingEventType } from '../../../../observability';
import { InMemoryStore } from '../../../../storage';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

describeForAllEngines('signal interruption outcomes (OBS-724)', engine => {
  const getMock = useLoopScenarioAimock();

  it.each([false, true])(
    'interrupts the replaced inference and preserves transport metadata (callback=%s)',
    async withCallback => {
      const llm = getMock();
      const events: TracingEvent[] = [];
      const observability = new Observability({
        configs: {
          default: {
            serviceName: 'signal-outcomes',
            exporters: [
              new MastraStorageExporter({ maxBatchWaitMs: 60_000 }),
              {
                name: 'capture',
                exportTracingEvent: async event => void events.push(event),
                flush: async () => {},
                shutdown: async () => {},
              },
            ],
          },
        },
      });
      const memory = new Memory({ storage: new InMemoryStore() });
      const shared = await createSharedAgent(llm, {
        engine,
        memory,
        observability,
        model: createOpenAI({ apiKey: 'test', baseURL: `${llm.url}/v1` }).chat('gpt-4o-mini'),
      });
      const running = runLoopScenario({
        engine,
        llm,
        sharedAgent: shared,
        memory,
        threadId: 'signal-outcomes-thread',
        resourceId: 'signal-outcomes-user',
        prompt: 'Answer slowly',
        fixtures: mock => {
          mock.on(
            { endpoint: 'chat', sequenceIndex: 0 },
            { content: 'obsolete answer' },
            { streamingProfile: { ttft: 2000 } },
          );
          mock.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'updated answer' });
        },
      });
      await vi.waitFor(() => expect(llm.getRequests().length).toBe(1), { timeout: 10_000 });
      const signal = shared.agent.sendMessage(
        {
          contents: 'Use the updated instructions',
          attributes: { source: 'user-steer' },
          metadata: { task: 'revision', ...(withCallback ? { onDelivered: () => {} } : {}) },
        },
        { threadId: 'signal-outcomes-thread', resourceId: 'signal-outcomes-user' },
      );
      await signal.accepted;
      const result = await running;
      expect(await result.output.text).toBe('updated answer');
      const ended = events.filter(event => event.type === TracingEventType.SPAN_ENDED).map(event => event.exportedSpan);
      expect(
        ended.filter(span => span.type === SpanType.MODEL_INFERENCE).some(span => span.outcome === 'interrupted'),
      ).toBe(true);
      expect(
        ended.find(span => span.type === SpanType.MODEL_INFERENCE && span.outcome === 'interrupted'),
      ).toMatchObject({
        stopReason: 'signal_received',
        stopReasonContext: {
          reason: 'signal_received',
          signals: [
            expect.objectContaining({
              id: expect.any(String),
              createdAt: expect.any(String),
              type: 'user',
              contents: 'Use the updated instructions',
              attributes: { source: 'user-steer' },
              metadata: { task: 'revision' },
            }),
          ],
        },
      });
      if (engine === 'durable' || engine === 'evented' || engine === 'inngest') {
        expect(
          ended.filter(span => span.type === SpanType.MODEL_STEP).some(span => span.outcome === 'interrupted'),
        ).toBe(true);
      }
      expect(ended.filter(span => span.type === SpanType.AGENT_RUN).at(-1)).toMatchObject({ outcome: 'success' });
      expect(ended.filter(span => span.type === SpanType.MODEL_GENERATION).at(-1)).toMatchObject({
        outcome: 'success',
      });
      await observability.getDefaultInstance()!.flush();
      const interrupted = ended.find(span => span.type === SpanType.MODEL_INFERENCE && span.outcome === 'interrupted')!;
      const store = await shared.mastra.getStorage().getStore('observability');
      expect((await store.getSpan({ traceId: interrupted.traceId, spanId: interrupted.id }))?.span).toMatchObject({
        outcome: 'interrupted',
        stopReason: 'signal_received',
        stopReasonContext: interrupted.stopReasonContext,
      });
    },
  );
});
