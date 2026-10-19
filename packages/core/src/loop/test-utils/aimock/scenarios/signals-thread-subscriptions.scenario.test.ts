import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Thread subscriptions observe ordinary `agent.stream` runs (not only
 * signal-started ones): every subscriber on the thread gets the run, other
 * resources/threads do not, and completed runs are not replayed to late
 * subscribers. Moved from agent-signals.test.ts (#27420).
 */

// Bounded so a missing delivery fails the test instead of hanging it.
function withTimeout<T>(promise: Promise<T>, message: string, timeoutMs = 2000): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timeout));
}

async function readNextRun(iterator: AsyncIterator<any>) {
  let runId: string | undefined;
  let text = '';
  while (true) {
    const next = await iterator.next();
    if (next.done) return { runId, text, done: true };
    const part = next.value;
    runId ??= part.runId;
    if (part.type === 'text-delta') text += part.payload.text;
    if (part.type === 'finish' || part.type === 'error' || part.type === 'abort') {
      return { runId, text, done: false };
    }
  }
}

describeForAllEngines('AIMock scenario: thread subscriptions observe stream runs', engine => {
  const getMock = useLoopScenarioAimock();

  async function setup() {
    const memory = new MockMemory();
    const shared = await createSharedAgent(getMock(), { memory, engine });
    const fixtures = (llm: any) => {
      llm.on({ endpoint: 'chat' }, { content: 'thread response' });
    };
    const run = (threadId: string, resourceId: string) =>
      runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Hello',
        sharedAgent: shared,
        memory,
        threadId,
        resourceId,
        stopWhen: stepCountIs(1),
        fixtures,
      });
    return { shared, run };
  }

  it('delivers a stream run to every subscriber on the thread', async () => {
    const { shared, run } = await setup();
    // Warm-up run wraps the shared agent for this engine.
    await (
      await run('warmup-thread', 'multi-user')
    ).output.text;
    const agent = shared.agent;

    const first = await agent.subscribeToThread({ threadId: 'multi-thread', resourceId: 'multi-user' });
    const second = await agent.subscribeToThread({ threadId: 'multi-thread', resourceId: 'multi-user' });
    const firstRun = readNextRun(first.stream[Symbol.asyncIterator]());
    const secondRun = readNextRun(second.stream[Symbol.asyncIterator]());

    const { output } = await run('multi-thread', 'multi-user');
    expect(await output.text).toBe('thread response');

    const runId = (output as any).runId;
    await expect(withTimeout(firstRun, 'first subscriber got no run')).resolves.toEqual({
      runId,
      text: 'thread response',
      done: false,
    });
    await expect(withTimeout(secondRun, 'second subscriber got no run')).resolves.toEqual({
      runId,
      text: 'thread response',
      done: false,
    });

    first.unsubscribe();
    second.unsubscribe();
  });

  it('isolates subscriptions by resource and thread id', async () => {
    const { shared, run } = await setup();
    await (
      await run('warmup-thread', 'isolated-user')
    ).output.text;
    const agent = shared.agent;

    const target = await agent.subscribeToThread({ threadId: 'isolated-thread', resourceId: 'isolated-user' });
    const otherResource = await agent.subscribeToThread({ threadId: 'isolated-thread', resourceId: 'other-user' });
    const otherThread = await agent.subscribeToThread({ threadId: 'other-thread', resourceId: 'isolated-user' });
    const targetNext = readNextRun(target.stream[Symbol.asyncIterator]());
    const otherResourceNext = readNextRun(otherResource.stream[Symbol.asyncIterator]());
    const otherThreadNext = readNextRun(otherThread.stream[Symbol.asyncIterator]());

    const { output } = await run('isolated-thread', 'isolated-user');
    await output.text;

    // The target subscriber has fully received the run before the others are
    // closed, so any misrouted delivery would already be buffered for them.
    await expect(withTimeout(targetNext, 'target subscriber got no run')).resolves.toMatchObject({
      runId: (output as any).runId,
      done: false,
    });

    otherResource.unsubscribe();
    otherThread.unsubscribe();
    await expect(otherResourceNext).resolves.toEqual({ runId: undefined, text: '', done: true });
    await expect(otherThreadNext).resolves.toEqual({ runId: undefined, text: '', done: true });
    target.unsubscribe();
  });

  it('does not replay a completed run to a late subscriber', async () => {
    const { shared, run } = await setup();
    const { output } = await run('late-thread', 'late-user');
    expect(await output.text).toBe('thread response');
    const agent = shared.agent;

    const late = await agent.subscribeToThread({ threadId: 'late-thread', resourceId: 'late-user' });
    const lateNext = readNextRun(late.stream[Symbol.asyncIterator]());

    // Barrier: a full run on a sibling subscription completes, so a replay of
    // the earlier run (published synchronously on subscribe) would be queued.
    const sibling = await agent.subscribeToThread({ threadId: 'late-barrier', resourceId: 'late-user' });
    const siblingNext = readNextRun(sibling.stream[Symbol.asyncIterator]());
    await (
      await run('late-barrier', 'late-user')
    ).output.text;
    await expect(withTimeout(siblingNext, 'barrier subscriber got no run')).resolves.toMatchObject({ done: false });

    late.unsubscribe();
    sibling.unsubscribe();
    await expect(lateNext).resolves.toEqual({ runId: undefined, text: '', done: true });
  });
});
