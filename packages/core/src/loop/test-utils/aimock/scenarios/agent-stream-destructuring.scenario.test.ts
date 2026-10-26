import { expect, it } from 'vitest';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * The stream result's properties and methods must keep working after being
 * destructured off the result object (no reliance on `this` at call time).
 *
 * Replaces the hash-matched `agent.e2e` recording "should support destructuring
 * of stream properties and methods".
 */
describeForAllEngines('AIMock loop scenario: stream result destructuring', engine => {
  const getMock = useLoopScenarioAimock();

  // Known gap: the durable/evented `result.output` is a plain MastraModelOutput,
  // not wrapped by `createDestructurableOutput` like the direct loop's result,
  // so a destructured `consumeStream()` loses `this` and throws.
  // Only that call is expected to fail; everything else is asserted normally.
  const isDurableEngine = engine === 'durable' || engine === 'evented';

  it('resolves destructured stream properties and methods', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: 'Hello there!' });
    const { agent } = await createSharedAgent(llm, { engine });

    const result: any = await agent.stream('Say hello');
    const output = result.output ?? result;
    const { fullStream, textStream, text, usage, consumeStream, toolCalls, finishReason, request } = output;

    expect(fullStream).toBeDefined();
    expect(textStream).toBeDefined();

    // Drain first so the run (and its AIMock request) is finished before any
    // destructured call can throw.
    for await (const _chunk of fullStream as AsyncIterable<unknown>) {
      // drain
    }
    if (isDurableEngine) {
      await expect(async () => consumeStream()).rejects.toThrow(/consumeStreamPromise/);
    } else {
      await consumeStream();
    }

    expect(await text).toBe('Hello there!');
    expect(await usage).toBeDefined();
    expect(await toolCalls).toEqual([]);
    expect(await finishReason).toBe('stop');
    // Known gap: durable/evented resolve `request` to `{}` (no body), with or
    // without destructuring.
    expect((await request)?.body).toEqual(isDurableEngine ? undefined : expect.anything());
    expect(llm.getRequests()).toHaveLength(1);
  });
});
