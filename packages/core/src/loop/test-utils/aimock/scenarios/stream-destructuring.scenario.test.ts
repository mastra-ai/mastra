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
    const { fullStream, textStream, text, usage, toolCalls, finishReason } = output;

    try {
      await output.consumeStream();

      expect(await text).toBe('Hello there!');
      expect(await toolCalls).toEqual([]);
      expect(await finishReason).toBe('stop');
      expect(await usage).toMatchObject({ inputTokens: 4, outputTokens: 3, totalTokens: 7 });
      expect(fullStream).toBeInstanceOf(ReadableStream);
      expect(textStream).toBeInstanceOf(ReadableStream);
      expect(llm.getRequests()).toHaveLength(1);
    } finally {
      result.cleanup?.();
    }
  });

  it('exposes the provider request after destructuring', async () => {
    const { result, output } = await streamHello();
    const { request } = output;

    try {
      await output.consumeStream();
      expect(await request).toBeDefined();
    } finally {
      result.cleanup?.();
    }
  });

  it('exposes the provider request body', async () => {
    const { result, output } = await streamHello();
    const { request } = output;

    try {
      await output.consumeStream();
      expect((await request).body).toBeDefined();
    } finally {
      result.cleanup?.();
    }
  });

  it('passes the provider request body to onFinish', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat', userMessage: 'Say hello' }, { content: 'Hello there!' });
    const { agent } = await createSharedAgent(llm, { engine });
    let finishRequest: unknown;
    const result: any = await agent.stream('Say hello', {
      onFinish: ({ request }) => {
        finishRequest = request;
      },
    });

    try {
      await (isDurableEngineVariant(engine) ? result.output : result).consumeStream();
      expect(finishRequest).toMatchObject({ body: expect.anything() });
    } finally {
      result.cleanup?.();
    }
  });

  it('keeps consumeStream bound after destructuring', async () => {
    const { result, output } = await streamHello();
    const { consumeStream } = output;

    try {
      await expect(consumeStream()).resolves.toBeUndefined();
      expect(await output.text).toBe('Hello there!');
    } finally {
      // Drain through the output itself so a failed destructured call does
      // not leave the run hitting the mock after it shuts down.
      await output.consumeStream();
      result.cleanup?.();
    }
  });
});
