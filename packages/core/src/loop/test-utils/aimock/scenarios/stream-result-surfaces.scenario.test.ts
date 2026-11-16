import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  useLoopScenarioAimock,
} from '../aimock-scenario';

/**
 * Text and structured-output surfaces of a stream result (moved from
 * llm/model/model.loop.e2e, which drove MastraLLMVNext.stream directly
 * against hash-matched recordings; agent.stream runs through it).
 *
 * Every surface reads the same run: the text and object promises,
 * getFullOutput(), fullStream, and objectStream, including reading a stream
 * again after the run has finished.
 */

const PERSON = z.object({ name: z.string(), age: z.number() });
const JOHN = { name: 'John Doe', age: 30 };

async function collect<T>(stream: ReadableStream<T> | AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of stream as AsyncIterable<T>) items.push(item);
  return items;
}

describeForAllEngines('AIMock loop scenario: stream result surfaces', engine => {
  const getMock = useLoopScenarioAimock();

  async function stream(prompt: string, options: Record<string, unknown> = {}) {
    const { agent } = await createSharedAgent(getMock(), { engine, instructions: 'You are a helpful assistant.' });
    const result: any = await agent.stream(prompt, options);
    return { result, output: isDurableEngineVariant(engine) ? result.output : result };
  }

  it('text: fullStream, the text promise and getFullOutput report the same reply', async () => {
    getMock().on({ endpoint: 'chat', userMessage: 'Hello, how are you?' }, { content: 'I am well, thanks!' });
    const { result, output } = await stream('Hello, how are you?');

    try {
      const chunks = await collect<any>(output.fullStream);
      const types = chunks.map(chunk => chunk.type);
      expect(types).toContain('text-delta');
      expect(types.at(-1)).toBe('finish');
      expect(
        chunks
          .filter(chunk => chunk.type === 'text-delta')
          .map(chunk => chunk.payload.text)
          .join(''),
      ).toBe('I am well, thanks!');

      expect(await output.text).toBe('I am well, thanks!');

      const full = await output.getFullOutput();
      expect(full.text).toBe('I am well, thanks!');
      expect(full.finishReason).toBe('stop');
    } finally {
      result.cleanup?.();
    }
  });

  it('structured output: objectStream, object, fullStream and getFullOutput agree, and replay after the run', async () => {
    const prompt = 'My name is John Doe and I am 30 years old.';
    getMock().on({ endpoint: 'chat', userMessage: prompt }, { content: JSON.stringify(JOHN) });
    const { result, output } = await stream(prompt, { structuredOutput: { schema: PERSON } });

    try {
      const live = await collect<any>(output.objectStream);
      expect(live.length).toBeGreaterThan(0);
      for (const partial of live) expect(partial).toBeTypeOf('object');
      expect(live.at(-1)).toEqual(JOHN);

      expect(await output.object).toEqual(JOHN);

      const replayed = await collect<any>(output.objectStream);
      expect(replayed).toEqual(live);

      const objectChunks = (await collect<any>(output.fullStream)).filter(chunk => chunk.type === 'object');
      expect(objectChunks.map(chunk => chunk.object)).toEqual(live);

      expect((await output.getFullOutput()).object).toEqual(JOHN);
    } finally {
      result.cleanup?.();
    }
  });
});
