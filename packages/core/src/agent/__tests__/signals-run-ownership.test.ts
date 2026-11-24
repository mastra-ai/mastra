import { beforeEach, describe, expect, it } from 'vitest';

import { MockMemory } from '../../memory/mock';
import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import { createBlockingFirstTextStreamModel, waitForActiveRun, waitForCondition } from './signals-test-utils';

describe('Agent signals: run ownership', () => {
  beforeEach(() => {
    agentThreadStreamRuntime.resetForTests();
  });

  async function startRun() {
    const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel('owner response', 'later');
    const agent = new Agent({
      id: 'run-ownership-agent',
      name: 'Run Ownership Agent',
      instructions: 'Test',
      model,
      memory: new MockMemory(),
    });
    const subscription = await agent.subscribeToThread({ threadId: 'owner-thread', resourceId: 'owner-user' });
    const stream = await agent.stream('Hello', { memory: { thread: 'owner-thread', resource: 'owner-user' } });
    await expect(waitForActiveRun(subscription)).resolves.toBe(stream.runId);
    await waitForCondition(() => stream._getImmediateText() === 'owner response');
    return { agent, stream, subscription, releaseFirst, getStreamCount };
  }

  it.each(['sendSignal', 'sendMessage', 'queueSignal', 'queueMessage'] as const)(
    '%s refuses a runId target naming another resource',
    async method => {
      const { agent, stream, subscription, releaseFirst, getStreamCount } = await startRun();
      const target = { runId: stream.runId, resourceId: 'attacker-user', threadId: 'attacker-thread' };
      const send = () =>
        method === 'sendSignal' || method === 'queueSignal'
          ? agent[method]({ type: 'user-message', contents: 'injected' }, target)
          : agent[method]('injected', target);

      expect(send).toThrow(`Agent run ${stream.runId} belongs to a different resource`);

      releaseFirst();
      await expect(stream.text).resolves.toBe('owner response');
      expect(getStreamCount()).toBe(1);
      subscription.unsubscribe();
    },
  );

  it('accepts a runId target naming the run’s own resource', async () => {
    const { agent, stream, subscription, releaseFirst } = await startRun();

    const result = agent.sendSignal(
      { type: 'user-message', contents: 'follow-up' },
      { runId: stream.runId, resourceId: 'owner-user', threadId: 'owner-thread' },
    );
    await expect(result.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });

    releaseFirst();
    await stream.text;
    subscription.unsubscribe();
  });
});
