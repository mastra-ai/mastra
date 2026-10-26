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

  async function streamHello() {
    const llm = getMock();
    llm.on(
      { endpoint: 'chat', userMessage: 'Say hello' },
      { content: 'Hello there!', usage: { input_tokens: 4, output_tokens: 3 } },
    );
    const { agent } = await createSharedAgent(llm, { engine, instructions: 'You are a helpful assistant.' });
    const result: any = await agent.stream('Say hello');
    const output = isDurableEngineVariant(engine) ? result.output : result;
    return { llm, result, output };
  }

  it('keeps promise getters and streams working after destructuring', async () => {
    const { llm, result, output } = await streamHello();
    const { fullStream, textStream, text, usage, toolCalls, finishReason, request } = output;

    try {
      await output.consumeStream();

      expect(await text).toBe('Hello there!');
      expect(await toolCalls).toEqual([]);
      expect(await finishReason).toBe('stop');
      expect(await usage).toMatchObject({ inputTokens: 4, outputTokens: 3, totalTokens: 7 });
      expect(await request).toBeDefined();
      expect(fullStream).toBeInstanceOf(ReadableStream);
      expect(textStream).toBeInstanceOf(ReadableStream);
      expect(llm.getRequests()).toHaveLength(1);
    } finally {
      result.cleanup?.();
    }
  });

  // The durable engines publish step results with `request: { body: undefined }`
  // (durable/stream-adapter.ts), so the provider request body never reaches the output.
  (isDurableEngineVariant(engine) ? it.fails : it)('exposes the provider request body', async () => {
    const { result, output } = await streamHello();
    const { request } = output;

    try {
      await output.consumeStream();
      expect((await request).body).toBeDefined();
    } finally {
      result.cleanup?.();
    }
  });

  it('keeps consumeStream bound after destructuring', async () => {
    const { result, output } = await streamHello();
    const { consumeStream } = output;

    try {
      if (isDurableEngineVariant(engine)) {
        // The durable stream adapter builds a bare MastraModelOutput without the
        // destructurable proxy, so a destructured consumeStream() loses `this`.
        await expect(consumeStream()).rejects.toThrow(TypeError);
      } else {
        await expect(consumeStream()).resolves.toBeUndefined();
        expect(await output.text).toBe('Hello there!');
      }
    } finally {
      // Drain through the output itself so a failed destructured call does
      // not leave the run hitting the mock after it shuts down.
      await output.consumeStream();
      result.cleanup?.();
    }
  });
});
