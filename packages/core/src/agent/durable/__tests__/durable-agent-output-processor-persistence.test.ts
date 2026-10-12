/**
 * #26335: a processOutputStream rewrite of a model chunk must reach memory on a durable agent, the
 * same as on the default loop — memory holds what the client streamed, not the raw model output.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import type { Processor } from '../../../processors';
import { InMemoryStore } from '../../../storage';
import { Agent } from '../../agent';
import { createEventedAgent } from '../create-evented-agent';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function textModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 't' },
        { type: 'text-delta', id: 't', delta: 'The card number is ' },
        { type: 'text-delta', id: 't', delta: '4111-1111-1111-1111.' },
        { type: 'text-delta', id: 't', delta: ' SECRET-FOOTER' },
        { type: 'text-end', id: 't' },
        { type: 'finish', finishReason: 'stop', usage },
      ]),
    }),
  });
}

const redact: Processor = {
  id: 'redact',
  async processOutputStream({ part }) {
    if (part.type !== 'text-delta') return part;
    if (part.payload.text.includes('SECRET')) return null;
    return {
      ...part,
      payload: { ...part.payload, text: part.payload.text.replace(/\d{4}-\d{4}-\d{4}-\d{4}/g, '[REDACTED]') },
    };
  },
};

async function run(kind: 'plain' | 'durable') {
  const storage = new InMemoryStore();
  const agent = new Agent({
    id: `a-${kind}`,
    name: 'a',
    instructions: 'a',
    model: textModel(),
    outputProcessors: [redact],
    memory: new MockMemory({ storage }),
  });
  const registered =
    kind === 'plain'
      ? agent
      : createEventedAgent({ agent, pubsub: new EventEmitterPubSub(), cache: new InMemoryServerCache() });
  const mastra = new Mastra({ storage, logger: false, agents: { a: registered as any } });
  const a = mastra.getAgent('a') as any;

  const out = await a.stream('go', { memory: { thread: `th-${kind}`, resource: 'r' } });
  let streamed = '';
  for await (const chunk of kind === 'plain' ? out.fullStream : out.output.fullStream) {
    if (chunk.type === 'text-delta') streamed += chunk.payload.text;
  }
  out.cleanup?.();

  const memoryStore: any = await storage.getStore('memory');
  let stored = '';
  for (let i = 0; i < 50 && !stored; i++) {
    const { messages } = await memoryStore.listMessages({ threadId: `th-${kind}` });
    stored = messages
      .filter((m: any) => m.role === 'assistant')
      .flatMap((m: any) => m.content.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text))
      .join('');
    if (!stored) await new Promise(r => setTimeout(r, 20));
  }
  return { streamed, stored };
}

describe('durable agent persists processOutputStream output (#26335)', () => {
  it.each(['plain', 'durable'] as const)('%s stores the processed text it streamed', async kind => {
    const { streamed, stored } = await run(kind);
    expect(streamed).toBe('The card number is [REDACTED].');
    expect(stored).toBe('The card number is [REDACTED].');
  });
});

const toReasoning: Processor = {
  id: 'to-reasoning',
  async processOutputStream({ part }) {
    if (part.type !== 'text-delta' || !part.payload.text.includes('SECRET')) return part;
    return { ...part, type: 'reasoning-delta', payload: { id: 'r', text: 'moved' } } as any;
  },
};

describe('durable agent persists processor-changed chunk type (#26335)', () => {
  it.each(['plain', 'durable'] as const)('%s stores a retyped chunk under its new type', async kind => {
    const storage = new InMemoryStore();
    const agent = new Agent({
      id: `rt-${kind}`,
      name: 'rt',
      instructions: 'rt',
      model: textModel(),
      outputProcessors: [toReasoning],
      memory: new MockMemory({ storage }),
    });
    const registered =
      kind === 'plain'
        ? agent
        : createEventedAgent({ agent, pubsub: new EventEmitterPubSub(), cache: new InMemoryServerCache() });
    const mastra = new Mastra({ storage, logger: false, agents: { rt: registered as any } });
    const a = mastra.getAgent('rt') as any;
    const out = await a.stream('go', { memory: { thread: `rt-${kind}`, resource: 'r' } });
    for await (const _ of kind === 'plain' ? out.fullStream : out.output.fullStream);
    out.cleanup?.();

    const memoryStore: any = await storage.getStore('memory');
    let parts: any[] = [];
    for (let i = 0; i < 50 && !parts.length; i++) {
      const { messages } = await memoryStore.listMessages({ threadId: `rt-${kind}` });
      parts = messages.filter((m: any) => m.role === 'assistant').flatMap((m: any) => m.content.parts);
      if (!parts.length) await new Promise(r => setTimeout(r, 20));
    }
    const text = parts
      .filter(p => p.type === 'text')
      .map(p => p.text)
      .join('');
    expect(text).not.toContain('SECRET');
    expect(text).not.toContain('moved');
    expect(parts.some(p => p.type === 'reasoning')).toBe(true);
  });
});
