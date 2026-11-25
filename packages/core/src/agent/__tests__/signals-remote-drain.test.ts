import { beforeEach, describe, expect, it } from 'vitest';

import type { Agent } from '../agent';
import { AgentThreadStreamRuntime, agentThreadStreamRuntime } from '../thread-stream-runtime';
import { ControlledLeasePubSub, waitForCondition } from './signals-test-utils';

const agent = { id: 'remote-drain-agent' } as Agent<any, any, any, any>;
const target = { resourceId: 'remote-drain-resource', threadId: 'remote-drain-thread' };
const runId = 'remote-drain-run';

/** The process that started the run: it holds the run record and the signal queue. */
function startOwnerRun(pubsub: ControlledLeasePubSub) {
  const owner = new AgentThreadStreamRuntime();
  const options = owner.prepareRunOptions(
    { runId, memory: { resource: target.resourceId, thread: target.threadId } } as any,
    pubsub,
  );
  owner.registerRun(
    agent,
    {
      runId,
      status: 'running',
      fullStream: (async function* () {})(),
      _waitUntilFinished: () => new Promise<void>(() => {}),
    } as any,
    options,
    pubsub,
  );
  return owner;
}

async function steer(owner: AgentThreadStreamRuntime, pubsub: ControlledLeasePubSub, contents: string) {
  const pending = owner.sendSignal(agent, { type: 'user-message', contents }, target, pubsub);
  await pending.accepted;
  await pubsub.flush();
  return pending.signal;
}

describe('Agent signals: draining a run that executes in another process', () => {
  beforeEach(() => {
    agentThreadStreamRuntime.resetForTests();
  });

  it('delivers a steer to the executing process once and drops the starter copy', async () => {
    const pubsub = new ControlledLeasePubSub();
    const owner = startOwnerRun(pubsub);
    const follower = new AgentThreadStreamRuntime().followRemoteRun(runId, target, pubsub);
    await follower.ready;

    const signal = await steer(owner, pubsub, 'change course');

    expect(follower.drain().map(s => s.id)).toEqual([signal.id]);
    expect(follower.drain()).toEqual([]);
    await pubsub.flush();
    // Nothing left for the starter's completion handler to send as a follow-up run.
    await waitForCondition(() => owner.drainPendingSignals(runId, pubsub).length === 0);
    expect(owner.drainPendingSignals(runId, pubsub)).toEqual([]);
    follower.stop();
  });

  it('picks up a steer sent before the executing process followed the run', async () => {
    const pubsub = new ControlledLeasePubSub();
    const owner = startOwnerRun(pubsub);
    const signal = await steer(owner, pubsub, 'sent early');

    const follower = new AgentThreadStreamRuntime().followRemoteRun(runId, target, pubsub);
    await follower.ready;
    await pubsub.flush();

    expect(follower.drain().map(s => s.id)).toEqual([signal.id]);
    follower.stop();
  });

  it('leaves an undrained steer with the starter, which sends it as a follow-up', async () => {
    const pubsub = new ControlledLeasePubSub();
    const owner = startOwnerRun(pubsub);
    const follower = new AgentThreadStreamRuntime().followRemoteRun(runId, target, pubsub);
    await follower.ready;

    const signal = await steer(owner, pubsub, 'never drained');
    follower.stop();

    expect(owner.drainPendingSignals(runId, pubsub).map(s => s.id)).toEqual([signal.id]);
  });

  it('does not deliver a drained steer again when the run moves to another process', async () => {
    const pubsub = new ControlledLeasePubSub();
    const owner = startOwnerRun(pubsub);
    const first = new AgentThreadStreamRuntime().followRemoteRun(runId, target, pubsub);
    await first.ready;
    await steer(owner, pubsub, 'once');
    expect(first.drain()).toHaveLength(1);
    await pubsub.flush();
    first.stop();

    const second = new AgentThreadStreamRuntime().followRemoteRun(runId, target, pubsub);
    await second.ready;
    await pubsub.flush();
    expect(second.drain()).toEqual([]);
    second.stop();
  });

  it('keeps a pre-run drain to signals queued before the first model request', async () => {
    const pubsub = new ControlledLeasePubSub();
    const owner = startOwnerRun(pubsub);
    const follower = new AgentThreadStreamRuntime().followRemoteRun(runId, target, pubsub);
    await follower.ready;
    await steer(owner, pubsub, 'mid-run');

    expect(follower.drain('pre-run')).toEqual([]);
    expect(follower.drain()).toHaveLength(1);
    follower.stop();
  });
});
