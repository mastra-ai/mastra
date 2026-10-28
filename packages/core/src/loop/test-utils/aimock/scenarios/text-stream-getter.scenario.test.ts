import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  useLoopScenarioAimock,
} from '../aimock-scenario';

/**
 * Regression class: the `textStream` getter on a stream result.
 *
 * `textStream` yields the text deltas as plain strings, filtered out of the
 * full chunk stream. It must stream the reply piece by piece, carry no tool or
 * lifecycle chunks, span every step of a tool loop, and replay after the run.
 */

async function collect<T>(stream: ReadableStream<T> | AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of stream as AsyncIterable<T>) items.push(item);
  return items;
}

describeForAllEngines('AIMock loop scenario: textStream', engine => {
  const getMock = useLoopScenarioAimock();

  it('streams the reply as string deltas and replays after the run', async () => {
    const reply = 'Hello, wonderful streaming world!';
    getMock().on({ endpoint: 'chat', userMessage: 'Say hello' }, { content: reply }, { chunkSize: 5 });
    const { agent } = await createSharedAgent(getMock(), { engine, instructions: 'You are a helpful assistant.' });
    const result: any = await agent.stream('Say hello');
    const output = isDurableEngineVariant(engine) ? result.output : result;

    try {
      const deltas = await collect<unknown>(output.textStream);
      expect(deltas.length).toBeGreaterThan(1);
      for (const delta of deltas) expect(delta).toBeTypeOf('string');
      expect(deltas.join('')).toBe(reply);

      expect(await collect<unknown>(output.textStream)).toEqual(deltas);
      expect(await output.text).toBe(reply);
    } finally {
      result.cleanup?.();
    }
  });

  it('carries only text across a tool loop', async () => {
    const lookup = createTool({
      id: 'lookup',
      description: 'Look up a value.',
      inputSchema: z.object({ key: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ({ key }) => ({ value: `VALUE_${key}` }),
    });
    const llm = getMock();
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      { content: 'Looking it up. ', toolCalls: [{ id: 'call_1', name: 'lookup', arguments: { key: 'a' } }] },
    );
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'The value is VALUE_a.' });

    const { agent } = await createSharedAgent(llm, {
      engine,
      instructions: 'You are a helpful assistant.',
      tools: { lookup },
    });
    const result: any = await agent.stream('Look up a', { stopWhen: stepCountIs(3) });
    const output = isDurableEngineVariant(engine) ? result.output : result;

    try {
      const deltas = await collect<unknown>(output.textStream);
      for (const delta of deltas) expect(delta).toBeTypeOf('string');
      expect(deltas.join('')).toBe('Looking it up. The value is VALUE_a.');
      expect(llm.getRequests()).toHaveLength(2);
    } finally {
      result.cleanup?.();
    }
  });
});
