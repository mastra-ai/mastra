import { it, expect } from 'vitest';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  useLoopScenarioAimock,
} from '../aimock-scenario';

/**
 * Destructuring the stream result (moved from save-and-errors.e2e, which ran
 * this once against a hash-matched recording on the normal engine).
 *
 * `const { consumeStream, text } = await agent.stream(...)` detaches methods
 * from the output object. They touch private fields, so they only work when
 * the output binds them (`createDestructurableOutput` in loop.ts).
 */
describeForAllEngines('AIMock loop scenario: stream result destructuring', engine => {
  const getMock = useLoopScenarioAimock();
  // The durable stream adapter builds a bare MastraModelOutput without the
  // destructurable proxy, so a destructured consumeStream() loses `this`.
  const itFailsOnDurable = isDurableEngineVariant(engine) ? it.fails : it;

  itFailsOnDurable('keeps methods and promise getters working after destructuring', async () => {
    const llm = getMock();
    llm.on(
      { endpoint: 'chat', userMessage: 'Say hello' },
      { content: 'Hello there!', usage: { input_tokens: 4, output_tokens: 3 } },
    );
    const { agent } = await createSharedAgent(llm, { engine, instructions: 'You are a helpful assistant.' });

    const result: any = await agent.stream('Say hello');
    const output = isDurableEngineVariant(engine) ? result.output : result;
    const { fullStream, textStream, text, usage, consumeStream, toolCalls, finishReason, request } = output;

    try {
      await consumeStream();

      expect(await text).toBe('Hello there!');
      expect(await toolCalls).toEqual([]);
      expect(await finishReason).toBe('stop');
      expect(await usage).toMatchObject({ inputTokens: 4, outputTokens: 3, totalTokens: 7 });
      expect((await request).body).toBeDefined();
      expect(fullStream).toBeInstanceOf(ReadableStream);
      expect(textStream).toBeInstanceOf(ReadableStream);
      expect(llm.getRequests()).toHaveLength(1);
    } finally {
      // Drain through the output itself so a failed destructured call does
      // not leave the run hitting the mock after it shuts down.
      await output.consumeStream();
      result.cleanup?.();
    }
  });
});
