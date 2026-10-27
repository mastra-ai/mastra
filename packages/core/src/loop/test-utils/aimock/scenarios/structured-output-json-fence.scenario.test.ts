import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  useLoopScenarioAimock,
} from '../aimock-scenario';

/**
 * Regression class: structured output wrapped in a ```json code fence.
 *
 * Some models wrap their JSON reply in a ```json ... ``` block even when a
 * response format is requested. The structured-output handlers strip the fence
 * so the final object parses, and strip the opening fence from partial text so
 * objectStream still emits progressive partials while the reply streams in.
 */

async function collect<T>(stream: ReadableStream<T> | AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of stream as AsyncIterable<T>) items.push(item);
  return items;
}

function fenced(value: unknown) {
  return '```json\n' + JSON.stringify(value) + '\n```';
}

describeForAllEngines('AIMock loop scenario: structured output in a json code fence', engine => {
  const getMock = useLoopScenarioAimock();

  async function stream(prompt: string, schema: z.ZodType) {
    const { agent } = await createSharedAgent(getMock(), { engine, instructions: 'You are a helpful assistant.' });
    const result: any = await agent.stream(prompt, { structuredOutput: { schema } });
    return { result, output: isDurableEngineVariant(engine) ? result.output : result };
  }

  it('unwraps a fenced object and streams partials while the fence is still open', async () => {
    const prompt = 'Greet the world.';
    const content = 'Hello, wonderful world!';
    getMock().on({ endpoint: 'chat', userMessage: prompt }, { content: fenced({ content }) }, { chunkSize: 4 });
    const { result, output } = await stream(prompt, z.object({ content: z.string() }));

    try {
      const partials = await collect<any>(output.objectStream);

      // Partial objects arrive before the closing fence, each a prefix of the final value.
      const progressive = partials.filter(p => typeof p?.content === 'string' && p.content.length < content.length);
      expect(progressive.length).toBeGreaterThan(0);
      for (const partial of partials) {
        expect(partial).toBeTypeOf('object');
        if (partial.content !== undefined) expect(content.startsWith(partial.content)).toBe(true);
      }
      expect(partials.at(-1)).toEqual({ content });

      expect(await output.object).toEqual({ content });
    } finally {
      result.cleanup?.();
    }
  });

  it('unwraps a fenced top-level array and streams elements progressively', async () => {
    const prompt = 'List two elements.';
    const elements = [{ content: 'element 1' }, { content: 'element 2' }];
    getMock().on({ endpoint: 'chat', userMessage: prompt }, { content: fenced({ elements }) }, { chunkSize: 6 });
    const { result, output } = await stream(prompt, z.array(z.object({ content: z.string() })));

    try {
      const partials = await collect<any>(output.objectStream);

      // The first element is emitted on its own before the second arrives.
      expect(partials).toContainEqual([elements[0]]);
      expect(partials.at(-1)).toEqual(elements);

      expect(await output.object).toEqual(elements);
    } finally {
      result.cleanup?.();
    }
  });
});
