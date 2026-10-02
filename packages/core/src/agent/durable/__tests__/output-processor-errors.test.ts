import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage/mock';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import { globalRunRegistry } from '../run-registry';

const sensitiveText = 'card: 4111-1111-1111-1111';

function createModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream<any>([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'response-1', modelId: 'mock-model', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: sensitiveText },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
    }),
  });
}

describe('durable output processor errors', () => {
  const pubsubs: EventEmitterPubSub[] = [];

  afterEach(async () => {
    globalRunRegistry.clear();
    await Promise.all(pubsubs.splice(0).map(pubsub => pubsub.close()));
  });

  it.each(['durable', 'evented'] as const)(
    '%s engine fails before emitting an unprocessed sensitive chunk',
    async engine => {
      const pubsub = new EventEmitterPubSub();
      pubsubs.push(pubsub);
      const agent = new Agent({
        id: `output-processor-error-${engine}`,
        name: `Output Processor Error ${engine}`,
        instructions: 'You are a test agent.',
        model: createModel() as LanguageModelV2,
        outputProcessors: [
          {
            id: 'throwing-redactor',
            name: 'Throwing redactor',
            processOutputStream: async ({ part }) => {
              if (part.type === 'text-delta' && part.payload.text.includes('4111')) {
                throw new Error('redactor crashed');
              }
              return part;
            },
          },
        ],
      });
      const outputAgent =
        engine === 'durable' ? createDurableAgent({ agent, pubsub }) : createEventedAgent({ agent, pubsub });

      new Mastra({
        agents: { [agent.id]: outputAgent as any },
        storage: new InMemoryStore(),
        pubsub,
        logger: false,
      });

      const chunks: any[] = [];
      let error: unknown;
      const { output, cleanup } = await outputAgent.stream('Reveal the card number');

      try {
        for await (const chunk of output.fullStream) {
          chunks.push(chunk);
        }
      } catch (streamError) {
        error = streamError;
      }

      expect(JSON.stringify(chunks)).not.toContain(sensitiveText);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('redactor crashed');
      await expect(output.text).rejects.toThrow('redactor crashed');
      await expect(output.finishReason).rejects.toThrow('redactor crashed');
      cleanup();
    },
    15_000,
  );
});
