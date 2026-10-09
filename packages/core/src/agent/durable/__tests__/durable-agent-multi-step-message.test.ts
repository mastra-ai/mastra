import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { InMemoryServerCache } from '../../../cache';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createEventedAgent } from '../create-evented-agent';
import { createScriptModel, toolResults } from './restart-agreement-support';

const toolThriceThenText = () =>
  createScriptModel(prompt => {
    const n = toolResults(prompt).length;
    return n < 3 ? { tools: [{ name: 'weather', args: {}, id: `call-${n + 1}` }] } : { text: 'done' };
  });

function setup() {
  const storage = new InMemoryStore();
  const memory = new MockMemory({ storage });
  const weather = createTool({
    id: 'weather',
    description: 'weather',
    inputSchema: z.object({}),
    execute: async () => ({ temp: 20 }),
  });
  return { storage, memory, weather };
}

async function assistantShapes(storage: InMemoryStore, thread: string) {
  const store = await storage.getStore('memory');
  const { messages } = await store!.listMessages({
    threadId: thread,
    perPage: false,
    orderBy: { field: 'createdAt', direction: 'ASC' },
  });
  return messages
    .filter(m => m.role === 'assistant')
    .map(m => ({ id: m.id, parts: m.content.parts.map((p: any) => p.type) }));
}

const expectedParts = [
  'step-start',
  'tool-invocation',
  'step-start',
  'tool-invocation',
  'step-start',
  'tool-invocation',
  'step-start',
  'text',
];

describe('durable agent multi-step turn persistence (#26332)', () => {
  it('stores a multi-step turn as one assistant message, like the plain loop', async () => {
    const plain = setup();
    const plainAgent = new Agent({
      id: 'plain-agent',
      name: 'plain-agent',
      instructions: 'x',
      model: toolThriceThenText() as any,
      tools: { weather: plain.weather },
      memory: plain.memory,
    });
    const plainOut = await plainAgent.stream('go', { memory: { thread: 't', resource: 'r' } });
    await plainOut.consumeStream();

    const durable = setup();
    const baseAgent = new Agent({
      id: 'durable-agent',
      name: 'durable-agent',
      instructions: 'x',
      model: toolThriceThenText() as any,
      tools: { weather: durable.weather },
      memory: durable.memory,
    });
    const evented = createEventedAgent({ agent: baseAgent, pubsub: new EventEmitterPubSub() });
    new Mastra({
      agents: { evented },
      storage: durable.storage,
      cache: new InMemoryServerCache(),
      logger: false,
    });
    const { output, cleanup } = await (evented as any).stream('go', { memory: { thread: 't', resource: 'r' } });
    let startMessageId: string | undefined;
    for await (const chunk of output.fullStream) {
      if (chunk.type === 'start') startMessageId ??= chunk.payload?.messageId;
    }
    cleanup?.();

    const plainShapes = await assistantShapes(plain.storage, 't');
    const durableShapes = await assistantShapes(durable.storage, 't');

    const strip = (parts: string[]) => parts.filter(p => p !== 'step-start');
    expect(plainShapes).toHaveLength(1);
    expect(durableShapes).toHaveLength(1);
    expect(strip(durableShapes[0]!.parts)).toEqual(strip(expectedParts));
    expect(durableShapes[0]!.parts).toEqual(plainShapes[0]!.parts);
    expect(startMessageId).toBe(durableShapes[0]!.id);
  });
});
