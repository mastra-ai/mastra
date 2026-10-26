import { expect, it } from 'vitest';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  useLoopScenarioAimock,
} from '../aimock-scenario';

/**
 * The stream result's properties and methods must keep working after being
 * destructured off the result object (no reliance on `this` at call time).
 *
 * Replaces the hash-matched `agent.e2e` recording "should support destructuring
 * of stream properties and methods".
 */
describeForAllEngines('AIMock loop scenario: stream result destructuring', engine => {
  const getMock = useLoopScenarioAimock();
  const isDurableEngine = isDurableEngineVariant(engine);

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
    await consumeStream();

    expect(await text).toBe('Hello there!');
    expect(await usage).toBeDefined();
    expect(await toolCalls).toEqual([]);
    expect(await finishReason).toBe('stop');
    expect((await request)?.body).toEqual(isDurableEngine ? undefined : expect.anything());
    expect(llm.getRequests()).toHaveLength(1);
  });
});
