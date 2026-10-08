/**
 * Durable and evented agents must persist `metadata.structuredOutput` on the saved
 * assistant message, as plain `Agent` does (issue #26432).
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage/mock';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';

const THREAD = 'structured-output-thread';
const RESOURCE = 'structured-output-resource';
const schema = z.object({ name: z.string(), age: z.number() });
const expected = { name: 'Alice', age: 30 };

function createJsonModel(text: string, finishReason: 'stop' | 'length' | 'content-filter' = 'stop') {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason, usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

type Engine = 'plain' | 'durable' | 'evented';

async function runAndRecall(
  engine: Engine,
  structuredOutput: Record<string, unknown>,
  text: string,
  finishReason?: 'stop' | 'length' | 'content-filter',
) {
  const memory = new MockMemory();
  const agent = new Agent({
    id: `so-persist-${engine}`,
    name: 'Structured Output Persistence Agent',
    instructions: 'Return the person',
    model: createJsonModel(text, finishReason) as LanguageModelV2,
    memory,
  });
  const wrapper =
    engine === 'durable'
      ? createDurableAgent({ agent, pubsub: new EventEmitterPubSub() })
      : engine === 'evented'
        ? createEventedAgent({ agent })
        : agent;
  new Mastra({ agents: { [agent.id]: wrapper }, storage: new InMemoryStore(), logger: false });

  const result = await wrapper.stream('Who is it?', {
    structuredOutput: structuredOutput as any,
    memory: { thread: THREAD, resource: RESOURCE },
  });
  const output = 'output' in result ? result.output : result;
  // Schema validation failures reject getFullOutput(); persistence still runs.
  const object = await output
    .getFullOutput()
    .then(full => full.object)
    .catch(() => undefined);
  if ('cleanup' in result) result.cleanup();

  const { messages } = await memory.recall({ threadId: THREAD, resourceId: RESOURCE });
  const assistant = messages.findLast(m => m.role === 'assistant');
  return { object, metadata: assistant?.content.metadata };
}

describe('structured output persistence (issue #26432)', () => {
  it.each(['plain', 'durable', 'evented'] as const)(
    'saves metadata.structuredOutput on the assistant message (%s)',
    async engine => {
      const { object, metadata } = await runAndRecall(engine, { schema }, JSON.stringify(expected));

      expect(object).toEqual(expected);
      expect(metadata?.structuredOutput).toEqual(expected);
    },
  );

  it.each(['durable', 'evented'] as const)(
    'does not save structuredOutput when validation fails (%s)',
    async engine => {
      const { metadata } = await runAndRecall(engine, { schema }, JSON.stringify({ name: 'Alice' }));

      expect(metadata).toBeDefined();
      expect(metadata?.structuredOutput).toBeUndefined();
    },
  );

  // The caller rejects truncated output even when the partial text parses, so nothing is saved.
  it.each(['plain', 'durable', 'evented'] as const)(
    'does not save structuredOutput when the model output was truncated (%s)',
    async engine => {
      const { object, metadata } = await runAndRecall(engine, { schema }, JSON.stringify(expected), 'length');

      expect(object).toBeUndefined();
      expect(metadata?.structuredOutput).toBeUndefined();
    },
  );

  it.each(['plain', 'durable', 'evented'] as const)(
    'saves the fallbackValue when validation fails with errorStrategy fallback (%s)',
    async engine => {
      const fallbackValue = { name: 'Fallback', age: 1 };
      const { object, metadata } = await runAndRecall(
        engine,
        { schema, errorStrategy: 'fallback', fallbackValue },
        JSON.stringify({ name: 'Alice' }),
      );

      expect(object).toEqual(fallbackValue);
      expect(metadata?.structuredOutput).toEqual(fallbackValue);
    },
  );

  // Refinements and transforms do not survive the JSON Schema conversion, so in-process
  // runs must validate with the live schema to match the object returned to the caller.
  it.each(['plain', 'durable', 'evented'] as const)(
    'applies live-schema refinements and transforms (%s)',
    async engine => {
      const liveSchema = z.object({
        name: z.string().transform(name => name.toUpperCase()),
        age: z.number().refine(age => age >= 18),
      });

      const saved = await runAndRecall(engine, { schema: liveSchema }, JSON.stringify(expected));
      expect(saved.object).toEqual({ name: 'ALICE', age: 30 });
      expect(saved.metadata?.structuredOutput).toEqual({ name: 'ALICE', age: 30 });

      const rejected = await runAndRecall(engine, { schema: liveSchema }, JSON.stringify({ name: 'Bob', age: 12 }));
      expect(rejected.metadata?.structuredOutput).toBeUndefined();
    },
  );

  // A separate structuring model is not run on the durable path yet (#26431), so the caller
  // gets no object. Persisting one parsed from the main model's text would disagree with it.
  it('does not save structuredOutput when a structuring model is configured (durable)', async () => {
    const { metadata } = await runAndRecall(
      'durable',
      { schema, model: createJsonModel(JSON.stringify(expected)) },
      JSON.stringify(expected),
    );

    expect(metadata).toBeDefined();
    expect(metadata?.structuredOutput).toBeUndefined();
  });
});
