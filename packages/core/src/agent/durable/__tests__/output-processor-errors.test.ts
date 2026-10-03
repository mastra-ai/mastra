import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage/mock';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import { globalRunRegistry } from '../run-registry';

const sensitiveText = 'card: 4111-1111-1111-1111';

function createModel(deltas: string[] = [sensitiveText]) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream<any>([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'response-1', modelId: 'mock-model', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        ...deltas.map(delta => ({ type: 'text-delta', id: 'text-1', delta })),
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
      const { output, cleanup } = await outputAgent.stream('Reveal the card number');

      for await (const chunk of output.fullStream) {
        chunks.push(chunk);
      }

      expect(JSON.stringify(chunks)).not.toContain(sensitiveText);
      const errorChunks = chunks.filter(chunk => chunk.type === 'error');
      expect(errorChunks).toHaveLength(1);
      expect(errorChunks[0].payload.error.message).toContain('redactor crashed');
      await expect(output.text).resolves.toBe('');
      await expect(output.finishReason).resolves.toBe('error');
      cleanup();
    },
    15_000,
  );

  it('regular engine settles when an output processor throws on step-finish', async () => {
    const agent = new Agent({
      id: 'output-processor-error-regular-step-finish',
      name: 'Output Processor Error Regular Step Finish',
      instructions: 'You are a test agent.',
      model: createModel(['hello']) as LanguageModelV2,
      outputProcessors: [
        {
          id: 'throwing-processor',
          name: 'Throwing processor',
          processOutputStream: async ({ part }) => {
            if (part.type === 'step-finish') {
              throw new Error('threw on step-finish');
            }
            return part;
          },
        },
      ],
    });

    const output = await agent.stream('Say hello');
    let streamError: unknown;
    try {
      for await (const _chunk of output.fullStream) {
        // drain
      }
    } catch (error) {
      streamError = error;
    }

    expect(streamError).toBeInstanceOf(Error);
    expect((streamError as Error).message).toContain('threw on step-finish');
    await expect(output.text).rejects.toThrow('threw on step-finish');
    await expect(output.finishReason).rejects.toThrow('threw on step-finish');
  });

  it.each([
    ['durable', 'start'],
    ['evented', 'start'],
    ['durable', 'step-start'],
    ['evented', 'step-start'],
    ['durable', 'step-finish'],
    ['evented', 'step-finish'],
    ['durable', 'finish'],
    ['evented', 'finish'],
  ] as const)(
    '%s engine settles when an output processor throws on %s',
    async (engine, chunkType) => {
      const pubsub = new EventEmitterPubSub();
      pubsubs.push(pubsub);
      const agent = new Agent({
        id: `output-processor-error-${engine}-${chunkType}`,
        name: `Output Processor Error ${engine} ${chunkType}`,
        instructions: 'You are a test agent.',
        model: createModel(['hello']) as LanguageModelV2,
        outputProcessors: [
          {
            id: 'throwing-processor',
            name: 'Throwing processor',
            processOutputStream: async ({ part }) => {
              if (part.type === chunkType) {
                throw new Error(`threw on ${chunkType}`);
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

      const { output, cleanup } = await outputAgent.stream('Say hello');
      let streamError: unknown;
      try {
        for await (const _chunk of output.fullStream) {
          // drain
        }
      } catch (error) {
        streamError = error;
      }

      expect(streamError).toBeInstanceOf(Error);
      expect((streamError as Error).message).toContain(`threw on ${chunkType}`);
      await expect(output.text).rejects.toThrow(`threw on ${chunkType}`);
      await expect(output.finishReason).rejects.toThrow(`threw on ${chunkType}`);
      cleanup();
    },
    15_000,
  );

  it.each(['durable', 'evented'] as const)(
    '%s engine stops publishing when an output processor blocks a chunk',
    async engine => {
      const pubsub = new EventEmitterPubSub();
      pubsubs.push(pubsub);
      const published: any[] = [];
      const publish = pubsub.publish.bind(pubsub);
      pubsub.publish = async (topic, event) => {
        if (topic.startsWith('agent.stream.')) published.push(event);
        return publish(topic, event);
      };
      const agent = new Agent({
        id: `output-processor-block-${engine}`,
        name: `Output Processor Block ${engine}`,
        instructions: 'You are a test agent.',
        model: createModel(['hello ', 'SECRET ', 'after']) as LanguageModelV2,
        outputProcessors: [
          {
            id: 'guard',
            name: 'Guard',
            processOutputStream: async ({ part, abort }) => {
              if (part.type === 'text-delta' && part.payload.text.includes('SECRET')) {
                abort('blocked');
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
      const { output, cleanup } = await outputAgent.stream('Say hello');
      for await (const chunk of output.fullStream) {
        chunks.push(chunk);
      }

      expect(chunks.filter(chunk => chunk.type === 'tripwire')).toHaveLength(1);
      await expect(output.text).resolves.toBe('hello ');
      // Wait for the run to finish so any chunk published after the tripwire is captured.
      await vi.waitFor(() => expect(published.some(event => event.type === 'finish')).toBe(true));
      const topic = JSON.stringify(published);
      expect(topic).not.toContain('SECRET');
      expect(topic).not.toContain('after');
      cleanup();
    },
    15_000,
  );

  it('keeps already-streamed output in memory when a later chunk fails processing', async () => {
    const pubsub = new EventEmitterPubSub();
    pubsubs.push(pubsub);
    const memory = new MockMemory();
    const agent = new Agent({
      id: 'output-processor-error-memory',
      name: 'Output Processor Error Memory',
      instructions: 'You are a test agent.',
      model: createModel(['hello ', sensitiveText]) as LanguageModelV2,
      memory,
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
    const durableAgent = createDurableAgent({ agent, pubsub });
    new Mastra({
      agents: { [agent.id]: durableAgent as any },
      storage: new InMemoryStore(),
      pubsub,
      logger: false,
    });

    const threadId = 'thread-output-processor-error';
    const resourceId = 'resource-output-processor-error';
    const { output, cleanup } = await durableAgent.stream('Reveal the card number', {
      memory: { thread: threadId, resource: resourceId },
    });
    for await (const _chunk of output.fullStream) {
      // drain
    }
    await expect(output.finishReason).resolves.toBe('error');

    await vi.waitFor(async () => {
      const { messages } = await memory.recall({ threadId, resourceId });
      expect(messages.some(message => message.role === 'assistant')).toBe(true);
    });
    const { messages } = await memory.recall({ threadId, resourceId });
    const assistantMessage = messages.find(message => message.role === 'assistant');
    const content = JSON.stringify(assistantMessage?.content);
    expect(content).toContain('hello');
    expect(content).not.toContain(sensitiveText);
    expect(assistantMessage?.content.parts?.some(part => part.type === 'error')).toBe(true);
    cleanup();
  }, 15_000);
});
