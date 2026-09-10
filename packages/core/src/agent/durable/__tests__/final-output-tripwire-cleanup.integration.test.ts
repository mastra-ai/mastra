import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import type { ChunkType } from '../../../stream/types';
import { MastraLanguageModelV2Mock } from '../../../test-utils/llm-mock';
import { Agent } from '../../agent';
import { DurableAgent } from '../durable-agent';
import { globalRunRegistry } from '../run-registry';

describe.each(['stream', 'observe'] as const)('final TripWire %s cleanup', consumer => {
  it.each([false, true])(
    'finishes even when onChunk throws: %s',
    async callbackThrows => {
      const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network forbidden'));
      const reached = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const pubsub = new EventEmitterPubSub();
      const base = new Agent({
        id: randomUUID(),
        name: 'Tripwire cleanup',
        instructions: 'Answer once.',
        model: new MastraLanguageModelV2Mock({
          doStream: async () => ({
            stream: new ReadableStream({
              start(controller) {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                controller.enqueue({ type: 'text-start', id: 'text' });
                controller.enqueue({ type: 'text-delta', id: 'text', delta: 'Rejected answer.' });
                controller.enqueue({ type: 'text-end', id: 'text' });
                controller.enqueue({
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                });
                controller.close();
              },
            }),
          }),
        }),
        outputProcessors: [
          {
            id: 'terminal-guard',
            async processOutputResult({ abort }) {
              reached.resolve();
              await release.promise;
              abort('Output rejected', { retry: false, metadata: { policy: 'cleanup-test' } });
            },
          },
        ],
      });
      // In the observe case the producer has automatic cleanup disabled, so
      // only the observer's terminal lifecycle can remove the global run entry.
      const producer = new DurableAgent({
        agent: base,
        pubsub,
        cache: false,
        cleanupTimeoutMs: consumer === 'stream' ? 40 : 0,
      });
      const observer = new DurableAgent({ agent: base, pubsub, cache: false, cleanupTimeoutMs: 40 });
      const mastra = new Mastra({
        agents: { producer },
        pubsub,
        storage: new InMemoryStore(),
        logger: false,
        workers: false,
        scheduler: { enabled: false },
        recovery: { durableAgents: 'off' },
      });
      const onChunk = vi.fn((chunk: ChunkType) => {
        if (callbackThrows && chunk.type === 'tripwire') throw new Error('Consumer callback failed');
      });
      let source: Awaited<ReturnType<DurableAgent['stream']>> | undefined;
      let observed: Awaited<ReturnType<DurableAgent['observe']>> | undefined;
      try {
        source = await producer.stream('Answer.', consumer === 'stream' ? { onChunk } : {});
        await reached.promise;
        expect(globalRunRegistry.has(source.runId)).toBe(true);
        if (consumer === 'observe') observed = await observer.observe(source.runId, { onChunk });
        release.resolve();
        const target = observed ?? source;
        await target.output.consumeStream();
        expect(target.output.tripwire).toMatchObject({ reason: 'Output rejected', processorId: 'terminal-guard' });
        expect(onChunk.mock.calls.filter(([chunk]) => chunk.type === 'tripwire')).toHaveLength(1);
        await vi.waitFor(
          () => {
            expect(globalRunRegistry.has(source!.runId)).toBe(false);
          },
          { timeout: 1000, interval: 20 },
        );
        if (consumer === 'stream') expect(producer.runRegistry.has(source.runId)).toBe(false);
        expect(network).not.toHaveBeenCalled();
      } finally {
        release.resolve();
        observed?.cleanup();
        source?.cleanup();
        await mastra.shutdown();
        await pubsub.close();
        network.mockRestore();
      }
    },
    15_000,
  );
});
