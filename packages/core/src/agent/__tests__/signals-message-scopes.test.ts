/**
 * A thread-targeted signal that names `scopes` joins an active run only when that run was
 * started with exactly those scopes. Every admission branch that would hand the signal to a
 * run applies the rule; a run whose scopes this process can't see (another process owns it)
 * never matches. Scope-less signals and another agent's run behave as before.
 */
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it } from 'vitest';

import { EventEmitterPubSub } from '../../events/event-emitter';
import { Agent } from '../agent';
import { AgentThreadStreamRuntime, agentThreadStreamRuntime } from '../thread-stream-runtime';
import {
  ControlledLeasePubSub,
  createTextStreamModel,
  readNextRunWithParts,
  waitForCondition,
} from './signals-test-utils';

const agentNamed = (id: string) =>
  new Agent({ id, name: id, instructions: 'Test', model: createTextStreamModel('response') });

/** A run output that stays running until `finish()`. */
function runningOutput(runId: string) {
  let finish!: () => void;
  const finished = new Promise<void>(resolve => (finish = resolve));
  return {
    output: {
      runId,
      status: 'running',
      fullStream: (async function* () {})(),
      _waitUntilFinished: () => finished,
    } as any,
    finish,
  };
}

describe('Agent signals: per-message scopes', () => {
  beforeEach(() => {
    agentThreadStreamRuntime.resetForTests();
  });

  it('delivers into a local run only a signal naming the scopes that run started with', async () => {
    const pubsub = new EventEmitterPubSub();
    const runtime = new AgentThreadStreamRuntime();
    const agent = agentNamed('local-scopes-agent');
    const ids = { resourceId: 'local-scopes-resource', threadId: 'local-scopes-thread' };
    const run = runningOutput('local-run');
    await pubsub.acquireLease(`${ids.resourceId}\u0000${ids.threadId}`, 'local-run', 15000);
    runtime.registerRun(
      agent,
      run.output,
      {
        runId: 'local-run',
        memory: { resource: ids.resourceId, thread: ids.threadId },
        scopes: ['request:r1', { scope: 'org:self', access: 'read' }],
      } as any,
      pubsub,
    );
    const send = (scopes?: any[]) =>
      runtime.sendSignal(
        agent,
        { type: 'user-message', contents: 'x' },
        { ...ids, ...(scopes ? { scopes } : {}) },
        pubsub,
      ).accepted;

    // Same tags and access, in any order: joins.
    await expect(send([{ scope: 'org:self', access: 'read' }, 'request:r1'])).resolves.toEqual({
      action: 'deliver',
      runId: 'local-run',
    });
    // No scopes: joins, as before.
    await expect(send()).resolves.toMatchObject({ action: 'deliver', runId: 'local-run' });
    // Another tag, a missing tag, or the same tag with other access: refused.
    for (const scopes of [
      ['request:r2', { scope: 'org:self', access: 'read' }],
      ['request:r1'],
      ['request:r1', { scope: 'org:self', access: 'write' }],
    ]) {
      await expect(send(scopes)).resolves.toEqual({ action: 'blocked', reason: 'scope-mismatch', runId: 'local-run' });
    }
    expect(runtime.drainPendingSignals('local-run', pubsub)).toHaveLength(2);
    run.finish();
  });

  it('refuses a scoped signal into a suspended run started with other scopes, and queues one with its scopes', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const agent = agentNamed('suspended-scopes-agent');
    const ids = { resourceId: 'suspended-scopes-resource', threadId: 'suspended-scopes-thread' };
    const runId = 'suspended-scopes-run';
    let finish!: () => void;
    const finished = new Promise<void>(resolve => (finish = resolve));
    const subscription = await runtime.subscribeToThread(agent, ids);
    const iterator = subscription.stream[Symbol.asyncIterator]();
    runtime.registerRun(
      agent,
      {
        runId,
        status: 'suspended',
        fullStream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'start', runId });
            controller.enqueue({
              type: 'tool-call-approval',
              runId,
              payload: { toolCallId: 'tool-call-1', toolName: 'testTool' },
            });
          },
        }),
        _waitUntilFinished: () => finished,
      } as any,
      { runId, memory: { resource: ids.resourceId, thread: ids.threadId }, scopes: ['request:r1'] } as any,
    );
    await iterator.next();
    await iterator.next();
    expect(runtime.getThreadState(ids)).toBe('active');
    const send = (scopes: string[]) =>
      runtime.sendSignal(agent, { type: 'user-message', contents: scopes.join() }, { ...ids, scopes }).accepted;

    await expect(send(['request:r2'])).resolves.toEqual({ action: 'blocked', reason: 'scope-mismatch', runId });
    await expect(send(['request:r1'])).resolves.toEqual({ action: 'deliver', runId });
    expect(runtime.drainPendingSignals(runId).map(signal => signal.contents)).toEqual(['request:r1']);

    finish();
    subscription.unsubscribe();
  });

  it('never delivers a signal naming scopes into a run another process owns', async () => {
    const pubsub = new EventEmitterPubSub();
    const ownerRuntime = new AgentThreadStreamRuntime();
    const senderRuntime = new AgentThreadStreamRuntime();
    const owner = agentNamed('remote-scopes-agent');
    const sender = agentNamed('remote-scopes-agent');
    const ids = { resourceId: 'remote-scopes-resource', threadId: 'remote-scopes-thread' };
    const senderSubscription = await senderRuntime.subscribeToThread(sender, ids, pubsub);
    const run = runningOutput('remote-run');
    await pubsub.acquireLease(`${ids.resourceId}\u0000${ids.threadId}`, 'remote-run', 15000);
    ownerRuntime.registerRun(
      owner,
      run.output,
      {
        runId: 'remote-run',
        memory: { resource: ids.resourceId, thread: ids.threadId },
        scopes: ['request:r1'],
      } as any,
      pubsub,
    );
    await waitForCondition(() => senderSubscription.activeRunId() === 'remote-run');

    // Even the owner's own scopes: the sender can't see them, so the signal waits.
    const scoped = senderRuntime.sendSignal(
      sender,
      { type: 'user-message', contents: 'scoped' },
      { ...ids, scopes: ['request:r1'] },
      pubsub,
    );
    await expect(scoped.accepted).resolves.toEqual({
      action: 'blocked',
      reason: 'scope-mismatch',
      runId: 'remote-run',
    });

    const plain = senderRuntime.sendSignal(sender, { type: 'user-message', contents: 'plain' }, ids, pubsub);
    await expect(plain.accepted).resolves.toMatchObject({ action: 'deliver', runId: 'remote-run' });
    let delivered: ReturnType<typeof ownerRuntime.drainPendingSignals> = [];
    await waitForCondition(() => {
      delivered = [...delivered, ...ownerRuntime.drainPendingSignals('remote-run', pubsub)];
      return delivered.length === 1;
    });
    expect(delivered.map(signal => signal.contents)).toEqual(['plain']);

    run.finish();
    senderSubscription.unsubscribe();
  });

  it("keeps another agent's run on the thread thread-blocked, whatever the scopes", async () => {
    const pubsub = new EventEmitterPubSub();
    const ownerRuntime = new AgentThreadStreamRuntime();
    const senderRuntime = new AgentThreadStreamRuntime();
    const ids = { resourceId: 'cross-scopes-resource', threadId: 'cross-scopes-thread' };
    const sender = agentNamed('cross-scopes-sender');
    const senderSubscription = await senderRuntime.subscribeToThread(sender, ids, pubsub);
    const run = runningOutput('cross-run');
    await pubsub.acquireLease(`${ids.resourceId}\u0000${ids.threadId}`, 'cross-run', 15000);
    ownerRuntime.registerRun(
      agentNamed('cross-scopes-owner'),
      run.output,
      { runId: 'cross-run', memory: { resource: ids.resourceId, thread: ids.threadId } } as any,
      pubsub,
    );
    await waitForCondition(() => senderSubscription.activeRunId() === 'cross-run');

    const result = senderRuntime.sendSignal(
      sender,
      { type: 'user-message', contents: 'x' },
      { ...ids, scopes: ['request:r1'] },
      pubsub,
    );
    await expect(result.accepted).resolves.toEqual({ action: 'blocked', reason: 'thread-blocked', runId: 'cross-run' });
    run.finish();
    senderSubscription.unsubscribe();
  });

  it('waits for the lease winner instead of forwarding a scoped idle wake to it', async () => {
    const pubsub = new ControlledLeasePubSub();
    const runtime = new AgentThreadStreamRuntime();
    const agent = agentNamed('lost-lease-agent');
    const ids = { resourceId: 'lost-lease-resource', threadId: 'lost-lease-thread' };
    pubsub.owners.set(`${ids.resourceId}\u0000${ids.threadId}`, 'winner-run');

    const scoped = runtime.sendSignal(
      agent,
      { type: 'user-message', contents: 'scoped' },
      { ...ids, scopes: ['request:r2'], ifIdle: { streamOptions: {} } },
      pubsub,
    );
    await expect(scoped.accepted).resolves.toEqual({
      action: 'blocked',
      reason: 'scope-mismatch',
      runId: 'winner-run',
    });
    expect(pubsub.publishedData.some(event => event?.type === 'signal-enqueued')).toBe(false);

    const plain = runtime.sendSignal(
      agent,
      { type: 'user-message', contents: 'plain' },
      { ...ids, ifIdle: { streamOptions: {} } },
      pubsub,
    );
    await expect(plain.accepted).resolves.toEqual({ action: 'deliver', runId: 'winner-run' });
    expect(pubsub.publishedData.filter(event => event?.type === 'signal-enqueued')).toHaveLength(1);
  });

  it('keeps a scoped signal out of a reserved run that loses its lease to another process', async () => {
    const pubsub = new ControlledLeasePubSub();
    const runtime = new AgentThreadStreamRuntime();
    const agent = agentNamed('reserved-agent');
    const ids = { resourceId: 'reserved-resource', threadId: 'reserved-thread' };
    let releaseAcquire!: () => void;
    pubsub.acquireLeaseWait = new Promise<void>(resolve => (releaseAcquire = resolve));

    // A scope-less wake reserves the thread and waits on the lease.
    const wake = runtime.sendSignal(
      agent,
      { type: 'user-message', contents: 'first' },
      { ...ids, ifIdle: { streamOptions: {} } },
      pubsub,
    );
    // A signal with the reservation's scopes (none) queues behind it; one naming scopes doesn't.
    const joined = runtime.sendSignal(agent, { type: 'user-message', contents: 'joined' }, ids, pubsub);
    const scoped = runtime.sendSignal(
      agent,
      { type: 'user-message', contents: 'scoped' },
      { ...ids, scopes: ['request:r2'] },
      pubsub,
    );
    await expect(scoped.accepted).resolves.toMatchObject({ action: 'blocked', reason: 'scope-mismatch' });

    // Another process wins the lease: the queued scope-less signal follows to it.
    pubsub.owners.set(`${ids.resourceId}\u0000${ids.threadId}`, 'winner-run');
    releaseAcquire();
    await expect(wake.accepted).resolves.toEqual({ action: 'deliver', runId: 'winner-run' });
    await expect(joined.accepted).resolves.toEqual({ action: 'deliver', runId: 'winner-run' });
  });

  it('refuses a signal queued on a scoped reservation once another process wins the lease', async () => {
    const pubsub = new ControlledLeasePubSub();
    const runtime = new AgentThreadStreamRuntime();
    const agent = agentNamed('reserved-scoped-agent');
    const ids = { resourceId: 'reserved-scoped-resource', threadId: 'reserved-scoped-thread' };
    let releaseAcquire!: () => void;
    pubsub.acquireLeaseWait = new Promise<void>(resolve => (releaseAcquire = resolve));

    const wake = runtime.sendSignal(
      agent,
      { type: 'user-message', contents: 'first' },
      { ...ids, scopes: ['request:r1'], ifIdle: { streamOptions: {} } },
      pubsub,
    );
    // Matches the reservation, so it queues behind it while the lease is pending.
    const queued = runtime.sendSignal(
      agent,
      { type: 'user-message', contents: 'same scopes' },
      { ...ids, scopes: ['request:r1'] },
      pubsub,
    );

    pubsub.owners.set(`${ids.resourceId}\u0000${ids.threadId}`, 'winner-run');
    releaseAcquire();
    // The winner's scopes are unknown here, so neither signal is forwarded to it.
    await expect(wake.accepted).resolves.toEqual({ action: 'blocked', reason: 'scope-mismatch', runId: 'winner-run' });
    await expect(queued.accepted).resolves.toEqual({
      action: 'blocked',
      reason: 'scope-mismatch',
      runId: 'winner-run',
    });
    expect(pubsub.publishedData.some(event => event?.type === 'signal-enqueued')).toBe(false);
  });

  it("never puts a scoped message from another process into a busy claimed owner's run", async () => {
    const pubsub = new ControlledLeasePubSub();
    const ownerRuntime = agentThreadStreamRuntime;
    const senderRuntime = new AgentThreadStreamRuntime();
    let releaseFirst!: () => void;
    const firstFinished = new Promise<void>(resolve => (releaseFirst = resolve));
    const prompts: string[] = [];
    const ownerAgent = new Agent({
      id: 'scoped-claimed-owner',
      name: 'Scoped Claimed Owner',
      instructions: 'Test',
      pubsub,
      model: new MockLanguageModelV2({
        doStream: async ({ prompt }) => {
          prompts.push(JSON.stringify(prompt));
          const call = prompts.length;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: new ReadableStream({
              async start(controller) {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                controller.enqueue({ type: 'text-start', id: `text-${call}` });
                controller.enqueue({ type: 'text-delta', id: `text-${call}`, delta: `answer ${call}. ` });
                controller.enqueue({ type: 'text-end', id: `text-${call}` });
                if (call === 1) await firstFinished;
                controller.enqueue({
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                });
                controller.close();
              },
            }),
          };
        },
      }),
    });
    const senderAgent = new Agent({
      id: 'scoped-claimed-sender',
      name: 'Scoped Claimed Sender',
      instructions: 'Test',
      model: createTextStreamModel('sender response'),
      pubsub,
    });
    const target = { resourceId: 'scoped-claimed-user', threadId: 'scoped-claimed-thread' };
    const subscription = await ownerRuntime.subscribeToThread(ownerAgent, target, pubsub);
    const firstRun = readNextRunWithParts(subscription.stream[Symbol.asyncIterator]());
    const claim = await ownerRuntime.claimThreadOwnership(ownerAgent, target, pubsub);
    const sendRemote = (contents: string, scopes?: string[]) =>
      senderRuntime.sendSignal(
        senderAgent,
        { type: 'user-message', contents },
        { ...target, ...(scopes ? { scopes } : {}), ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
        pubsub,
      );

    try {
      await expect(sendRemote('start the run').accepted).resolves.toMatchObject({ action: 'deliver' });
      await waitForCondition(() => prompts.length === 1);
      const activeRunId = subscription.activeRunId();

      // The request to the owner carries no scopes, so a scoped message is refused at the sender.
      await expect(sendRemote('scoped while busy', ['request:r2']).accepted).rejects.toThrow(
        "scopes don't cross processes",
      );
      // A scope-less message still joins the run in flight (#28298).
      await expect(sendRemote('plain while busy').accepted).resolves.toEqual({ action: 'deliver', runId: activeRunId });

      releaseFirst();
      await firstRun;
      await pubsub.flush();
      expect(prompts.join('')).toContain('plain while busy');
      expect(prompts.join('')).not.toContain('scoped while busy');
    } finally {
      releaseFirst();
      claim.unsubscribe();
      subscription.unsubscribe();
    }
  });
});
