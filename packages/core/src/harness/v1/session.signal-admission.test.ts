import { describe, expect, it, vi } from 'vitest';

import { createSignal } from '../../agent/signals';
import type { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { MockAgent } from './__test-utils__/mock-agent';
import { setupHarness } from './__test-utils__/setup';
import {
  HarnessAdmissionConflictError,
  HarnessConfigError,
  HarnessSessionNotFoundError,
  HarnessValidationError,
} from './errors';
import type { HarnessEvent } from './events';
import type { Session } from './session';
import type { SessionSignalOptions } from './types';

async function waitForStreamCalls(agent: MockAgent, expected: number): Promise<void> {
  for (let i = 0; i < 100 && agent.streamCalls.length < expected; i++) {
    await new Promise<void>(resolve => setImmediate(resolve));
  }
}

async function waitFor(predicate: () => boolean, label: string): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if (predicate()) return;
    await new Promise<void>(resolve => setTimeout(resolve, 5));
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function seedPendingSignalAdmission(
  session: Session,
  storage: InMemoryHarness,
  opts: { admissionId: string; content: string; runId?: string; modeId?: string; modelId?: string },
): Promise<{ signalId: string; idleRunId: string }> {
  const internals = session as unknown as {
    _computeSignalAdmissionHash: (opts: { content: string }, attachments: [], requestContext?: undefined) => string;
    _signalAdmissionIdentity: (admissionId: string) => { signalId: string; idleRunId: string };
  };
  const admissionHash = internals._computeSignalAdmissionHash({ content: opts.content }, [], undefined);
  const identity = internals._signalAdmissionIdentity(opts.admissionId);
  const now = Date.now();
  await storage.writeMessageResultEvidence({
    status: 'pending',
    harnessName: session.getRecord().harnessName,
    sessionId: session.id,
    resourceId: session.resourceId,
    threadId: session.threadId,
    signalId: identity.signalId,
    runId: opts.runId,
    modeId: opts.modeId ?? session.getRecord().modeId,
    modelId: opts.modelId ?? session.getRecord().modelId,
    admissionId: opts.admissionId,
    admissionHash,
    createdAt: now,
    updatedAt: now,
  });
  return identity;
}

async function expectRedactedResult(result: Promise<unknown>, secret: string): Promise<void> {
  const thrown = await result.then(
    () => undefined,
    (error: unknown) => error,
  );
  expect(thrown).toMatchObject({ name: 'HarnessExecutionError', message: 'An internal harness error occurred' });
  expect((thrown as Error).message).not.toContain(secret);
}

describe('Session.signal() admissionId', () => {
  it('replays an accepted idle wake with one stable signal/run/result and one terminal event', async () => {
    const agent = new MockAgent({ id: 'default' });
    let release!: () => void;
    agent.enqueueRun({
      holdUntil: new Promise<void>(resolve => {
        release = resolve;
      }),
      text: 'accepted once',
    });
    const { harness } = setupHarness({ agents: { default: agent } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const events: HarnessEvent[] = [];
    session.subscribe(event => events.push(event));

    const first = await session.signal({ content: 'hello', admissionId: 'idle-once' });
    const duplicate = await session.signal({ content: 'hello', admissionId: 'idle-once' });

    expect(duplicate).toMatchObject({
      id: first.id,
      runId: first.runId,
      accepted: true,
      willInterleave: false,
    });
    expect(agent.streamCalls).toHaveLength(1);

    release();
    const [firstResult, duplicateResult] = await Promise.all([first.result, duplicate.result]);
    expect(duplicateResult).toEqual(firstResult);
    expect(events.filter(event => event.type === 'signal_completed' && event.signalId === first.id)).toHaveLength(1);

    const evidence = await session.lookupMessageResult(first.id);
    expect(evidence).toMatchObject({
      status: 'completed',
      signalId: first.id,
      runId: first.runId,
      admissionId: 'idle-once',
    });
  });

  it('reconstructs a duplicate signal from the normalized identity snapshot', async () => {
    const agent = new MockAgent({ id: 'default' });
    let release!: () => void;
    agent.enqueueRun({
      holdUntil: new Promise<void>(resolve => {
        release = resolve;
      }),
      text: 'normalized signal',
    });
    const { harness, storage } = setupHarness({ agents: { default: agent } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const identity = {
      input: 'signal-input',
      response: 'signal-response',
      extra: 'ignored by the native identity contract',
    } as any;

    const first = await session.signal({
      content: 'signal snapshot',
      admissionId: 'signal-normalized-identity',
      logicalMessageIdentity: identity,
    });
    expect(first.signal.metadata).toEqual({ logicalMessageId: 'signal-input' });

    let releaseLookup!: () => void;
    let lookupStarted!: () => void;
    const lookupStartedPromise = new Promise<void>(resolve => {
      lookupStarted = resolve;
    });
    const lookupGate = new Promise<void>(resolve => {
      releaseLookup = resolve;
    });
    const realResolve = storage.resolveOperationAdmissionEvidence.bind(storage);
    let gated = false;
    storage.resolveOperationAdmissionEvidence = async options => {
      if (!gated && options.admissionId === 'signal-normalized-identity') {
        gated = true;
        lookupStarted();
        await lookupGate;
      }
      return realResolve(options);
    };

    const duplicatePromise = session.signal({
      content: 'signal snapshot',
      admissionId: 'signal-normalized-identity',
      logicalMessageIdentity: identity,
    });
    await lookupStartedPromise;
    identity.input = 'mutated-after-duplicate-admission';
    identity.response = 'mutated-response-after-duplicate-admission';
    releaseLookup();

    const duplicate = await duplicatePromise;
    expect(duplicate.signal.metadata).toEqual({ logicalMessageId: 'signal-input' });
    expect(duplicate.id).toBe(first.id);
    release();
    await Promise.all([first.result, duplicate.result]);
  });

  it('keeps an omitted logical identity out of duplicate signal reconstruction after caller mutation', async () => {
    const agent = new MockAgent({ id: 'default' });
    let release!: () => void;
    agent.enqueueRun({
      holdUntil: new Promise<void>(resolve => {
        release = resolve;
      }),
      text: 'ordinary signal',
    });
    const { harness, storage } = setupHarness({ agents: { default: agent } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const first = await session.signal({ content: 'ordinary signal', admissionId: 'signal-omitted-identity' });
    let releaseLookup!: () => void;
    let lookupStarted!: () => void;
    const lookupStartedPromise = new Promise<void>(resolve => {
      lookupStarted = resolve;
    });
    const lookupGate = new Promise<void>(resolve => {
      releaseLookup = resolve;
    });
    const realResolve = storage.resolveOperationAdmissionEvidence.bind(storage);
    let gated = false;
    storage.resolveOperationAdmissionEvidence = async options => {
      if (!gated && options.admissionId === 'signal-omitted-identity') {
        gated = true;
        lookupStarted();
        await lookupGate;
      }
      return realResolve(options);
    };

    const options: SessionSignalOptions = {
      content: 'ordinary signal',
      admissionId: 'signal-omitted-identity',
    };
    const duplicatePromise = session.signal(options);
    await lookupStartedPromise;
    options.logicalMessageIdentity = { input: 'late-input' };
    releaseLookup();

    const duplicate = await duplicatePromise;
    expect(duplicate.signal.metadata).toBeUndefined();
    expect(duplicate.id).toBe(first.id);
    release();
    await Promise.all([first.result, duplicate.result]);
  });

  it('deduplicates concurrent exact admissions before a second idle dispatch', async () => {
    const agent = new MockAgent({ id: 'default' });
    let release!: () => void;
    agent.enqueueRun({
      holdUntil: new Promise<void>(resolve => {
        release = resolve;
      }),
    });
    const { harness } = setupHarness({ agents: { default: agent } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const [first, duplicate] = await Promise.all([
      session.signal({ content: 'hello', admissionId: 'concurrent-once' }),
      session.signal({ content: 'hello', admissionId: 'concurrent-once' }),
    ]);

    expect(duplicate.id).toBe(first.id);
    expect(duplicate.runId).toBe(first.runId);
    expect(agent.streamCalls).toHaveLength(1);
    release();
    await Promise.all([first.result, duplicate.result]);
  });

  it('replays an active interleave without appending a second signal or provider run', async () => {
    const agent = new MockAgent({ id: 'default' });
    let release!: () => void;
    agent.enqueueRun({
      holdUntil: new Promise<void>(resolve => {
        release = resolve;
      }),
      text: 'shared terminal',
    });
    const { harness } = setupHarness({ agents: { default: agent } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const firstTurn = session.message({ content: 'first' });
    await waitForStreamCalls(agent, 1);

    const events: HarnessEvent[] = [];
    session.subscribe(event => events.push(event));
    const first = await session.signal({ content: 'steer once', admissionId: 'active-once' });
    const duplicate = await session.signal({ content: 'steer once', admissionId: 'active-once' });

    expect(first.willInterleave).toBe(true);
    expect(duplicate).toMatchObject({ id: first.id, runId: first.runId, willInterleave: true });
    expect(agent.streamCalls).toHaveLength(1);

    release();
    const original = await firstTurn;
    const [firstResult, duplicateResult] = await Promise.all([first.result, duplicate.result]);
    expect(first.runId).toBe(original.runId);
    expect(duplicateResult).toEqual(firstResult);
    expect(events.filter(event => event.type === 'signal_completed' && event.signalId === first.id)).toHaveLength(1);
  });

  it('keeps steer input identity separate from the active response owner', async () => {
    const agent = new MockAgent({ id: 'default' });
    let release!: () => void;
    agent.enqueueRun({
      holdUntil: new Promise<void>(resolve => {
        release = resolve;
      }),
      text: 'shared terminal',
    });
    const { harness } = setupHarness({ agents: { default: agent } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const sendSignal = vi.spyOn(agent, 'sendSignal');

    const firstTurn = session.message({
      content: 'first',
      logicalMessageIdentity: { input: 'input-1', response: 'response-1' },
    });
    await waitForStreamCalls(agent, 1);

    const steer = await session.signal({
      content: 'steer once',
      logicalMessageIdentity: { input: 'input-2' },
    });

    const firstCall = sendSignal.mock.calls[0]?.[0] as { metadata?: unknown } | undefined;
    const steerCall = sendSignal.mock.calls[1]?.[0] as { metadata?: unknown } | undefined;
    expect(firstCall?.metadata).toEqual({ logicalMessageId: 'input-1' });
    expect(steerCall?.metadata).toEqual({ logicalMessageId: 'input-2' });
    expect((agent.streamCalls[0]!.options as { logicalMessageIdentity?: unknown }).logicalMessageIdentity).toEqual({
      input: 'input-1',
      response: 'response-1',
    });

    release();
    await Promise.all([firstTurn, steer.result]);
  });

  it('rechecks routing after durable admission when the previously active run finishes', async () => {
    const agent = new MockAgent({ id: 'default' });
    let releaseActive!: () => void;
    agent.enqueueRun({
      holdUntil: new Promise<void>(resolve => {
        releaseActive = resolve;
      }),
      text: 'first terminal',
    });
    agent.enqueueRun({ text: 'idle recovery terminal' });
    const { harness, storage } = setupHarness({ agents: { default: agent } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const active = session.message({ content: 'active first' });
    await waitForStreamCalls(agent, 1);

    const realWrite = storage.writeMessageResultEvidence.bind(storage);
    let reservationStarted!: () => void;
    const reservationObserved = new Promise<void>(resolve => {
      reservationStarted = resolve;
    });
    let releaseReservation!: () => void;
    const reservationGate = new Promise<void>(resolve => {
      releaseReservation = resolve;
    });
    storage.writeMessageResultEvidence = async record => {
      if (record.admissionId === 'routing-race' && record.status === 'pending' && record.runId === undefined) {
        reservationStarted();
        await reservationGate;
      }
      return realWrite(record);
    };

    const signal = session.signal({ content: 'route after admission', admissionId: 'routing-race' });
    await reservationObserved;
    releaseActive();
    await active;
    releaseReservation();

    const handle = await signal;
    expect(handle.willInterleave).toBe(false);
    await expect(handle.result).resolves.toMatchObject({ text: 'idle recovery terminal' });
    expect(agent.streamCalls).toHaveLength(2);
  });

  it('rejects a full logical pair when a run becomes active during its reservation', async () => {
    const agent = new MockAgent({ id: 'default' });
    let releaseActive!: () => void;
    agent.enqueueRun({
      holdUntil: new Promise<void>(resolve => {
        releaseActive = resolve;
      }),
      text: 'active terminal',
    });
    const { harness, storage } = setupHarness({ agents: { default: agent } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const realWrite = storage.writeMessageResultEvidence.bind(storage);
    let reservationStarted!: () => void;
    const reservationObserved = new Promise<void>(resolve => {
      reservationStarted = resolve;
    });
    let releaseReservation!: () => void;
    const reservationGate = new Promise<void>(resolve => {
      releaseReservation = resolve;
    });
    storage.writeMessageResultEvidence = async record => {
      if (record.admissionId === 'lineage-active-race' && record.status === 'pending') {
        reservationStarted();
        await reservationGate;
      }
      return realWrite(record);
    };

    const pending = session.signal({
      content: 'wake with a response owner',
      admissionId: 'lineage-active-race',
      logicalMessageIdentity: { input: 'input-race', response: 'response-race' },
    });
    await reservationObserved;

    const active = session.message({ content: 'active work' });
    await waitForStreamCalls(agent, 1);
    const nativeSubscription = await agent.subscribeToThread({
      resourceId: session.resourceId,
      threadId: session.threadId,
    });
    await waitFor(() => nativeSubscription.activeRunId() !== null, 'native active run registration');
    releaseReservation();

    await expect(pending).rejects.toBeInstanceOf(HarnessConfigError);
    const identity = (session as any)._signalAdmissionIdentity('lineage-active-race') as { signalId: string };
    await expect(session.lookupMessageResult(identity.signalId)).resolves.toMatchObject({ status: 'failed' });

    releaseActive();
    await active;
    const duplicate = await session.signal({
      content: 'wake with a response owner',
      admissionId: 'lineage-active-race',
      logicalMessageIdentity: { input: 'input-race', response: 'response-race' },
    });
    expect(duplicate).toMatchObject({ accepted: true, willInterleave: true });
    await expect(duplicate.result).rejects.toMatchObject({ name: 'HarnessExecutionError' });
    expect(agent.streamCalls).toHaveLength(1);
  });

  it('uses the native accepted run id for an admitted active delivery', async () => {
    const agent = new MockAgent({ id: 'default' });
    let release!: () => void;
    agent.enqueueRun({
      holdUntil: new Promise<void>(resolve => {
        release = resolve;
      }),
      text: 'authoritative terminal',
    });
    const { harness } = setupHarness({ agents: { default: agent } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const active = session.message({ content: 'active first' });
    await waitForStreamCalls(agent, 1);

    const realSendSignal = agent.sendSignal.bind(agent);
    agent.sendSignal = ((signal: any, target: any) => {
      const dispatched = realSendSignal(signal, target);
      return { ...dispatched, runId: 'stale-provisional-run' };
    }) as typeof agent.sendSignal;

    const handle = await session.signal({ content: 'land once', admissionId: 'authoritative-active' });
    expect(handle.willInterleave).toBe(true);
    expect(handle.runId).not.toBe('stale-provisional-run');

    release();
    const activeResult = await active;
    expect(handle.runId).toBe(activeResult.runId);
    await expect(handle.result).resolves.toEqual(activeResult);
  });

  it('reroutes an admitted active candidate through an owned turn when native admission discards it', async () => {
    const agent = new MockAgent({ id: 'default' });
    let releaseActive!: () => void;
    agent.enqueueRun({
      holdUntil: new Promise<void>(resolve => {
        releaseActive = resolve;
      }),
      text: 'active terminal',
    });
    agent.enqueueRun({ text: 'rerouted owned terminal' });
    const { harness } = setupHarness({ agents: { default: agent } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const active = session.message({ content: 'active first' });
    await waitForStreamCalls(agent, 1);

    const realSendSignal = agent.sendSignal.bind(agent);
    let discarded = false;
    agent.sendSignal = ((signal: any, target: any) => {
      if (!discarded && target.ifIdle?.behavior === 'discard') {
        discarded = true;
        return {
          signal: createSignal({ ...signal, acceptedAt: new Date() }),
          runId: 'discarded-provisional-run',
          accepted: (async () => {
            releaseActive();
            await active;
            (target.ifIdle as { _onThreadStreamSignalDiscarded?: () => void })._onThreadStreamSignalDiscarded?.();
            return { action: 'discard' as const };
          })(),
        };
      }
      return realSendSignal(signal, target);
    }) as typeof agent.sendSignal;

    const handle = await session.signal({
      content: 'reroute once',
      admissionId: 'active-discard-race',
      logicalMessageIdentity: { input: 'reroute-input', response: 'reroute-response' },
    });
    expect(handle).toMatchObject({ willInterleave: false, accepted: true });
    expect(handle.runId).not.toBe('discarded-provisional-run');
    await expect(handle.result).resolves.toMatchObject({ text: 'rerouted owned terminal' });
    expect(agent.streamCalls).toHaveLength(2);
    expect(agent.streamCalls[1]!.options.logicalMessageIdentity).toEqual({
      input: 'reroute-input',
      response: 'reroute-response',
    });
    const identity = (session as any)._signalAdmissionIdentity('active-discard-race') as { signalId: string };
    await expect(session.lookupMessageResult(identity.signalId)).resolves.toMatchObject({
      status: 'completed',
      admissionId: 'active-discard-race',
    });
  });

  it.each([
    { action: 'blocked', accepted: { action: 'blocked', reason: 'thread-blocked', runId: 'blocked-run' } },
    { action: 'persist', accepted: { action: 'persist' } },
    { action: 'deliver', accepted: { action: 'deliver', runId: 'active-run' } },
  ] as const)(
    'rejects an unexpected native $action result for a non-admitted full logical pair',
    async ({ accepted }) => {
      const agent = new MockAgent({ id: 'default' });
      const { harness } = setupHarness({ agents: { default: agent } });
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

      agent.sendSignal = ((signal: any) => ({
        signal: createSignal({ ...signal, acceptedAt: new Date() }),
        runId: 'unexpected-native-run',
        accepted: Promise.resolve(accepted),
      })) as typeof agent.sendSignal;

      await expect(
        session.signal({
          content: 'unexpected native action',
          logicalMessageIdentity: { input: `input-${accepted.action}`, response: `response-${accepted.action}` },
        }),
      ).rejects.toBeInstanceOf(HarnessConfigError);
      expect(agent.streamCalls).toHaveLength(0);
    },
  );

  it('aborts an unresolved native acceptance for a non-admitted full logical signal', async () => {
    const agent = new MockAgent({ id: 'default' });
    let releaseRun!: () => void;
    let nativeAbortObserved!: () => void;
    const nativeAbort = new Promise<void>(resolve => {
      nativeAbortObserved = resolve;
    });
    agent.enqueueRun({
      holdUntil: new Promise<void>(resolve => {
        releaseRun = resolve;
      }),
      onAbort: () => nativeAbortObserved(),
    });
    const { harness } = setupHarness({ agents: { default: agent } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const realSendSignal = agent.sendSignal.bind(agent);
    let nativeAbortSignal: AbortSignal | undefined;
    agent.sendSignal = ((signal: any, target: any) => {
      nativeAbortSignal = target.ifIdle?.streamOptions?.abortSignal;
      const dispatched = realSendSignal(signal, target);
      return { ...dispatched, accepted: new Promise<never>(() => {}) };
    }) as typeof agent.sendSignal;

    vi.useFakeTimers();
    try {
      const pending = session.signal({
        content: 'wait for native signal acceptance',
        logicalMessageIdentity: { input: 'signal-timeout-input', response: 'signal-timeout-response' },
      });
      const rejection = expect(pending).rejects.toMatchObject({ name: 'HarnessValidationError' });
      await vi.advanceTimersByTimeAsync(30_001);
      await rejection;
    } finally {
      vi.useRealTimers();
    }

    expect(nativeAbortSignal?.aborted).toBe(true);
    await expect(nativeAbort).resolves.toBeUndefined();
    expect(session.isRunning()).toBe(false);
    releaseRun();
  });

  it('rejects payload conflicts and non-hash-safe options before another dispatch', async () => {
    const { harness, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const first = await session.signal({
      content: 'hello',
      admissionId: 'conflict',
      requestContext: { app: { tenant: 'one' } },
    });
    await first.result;

    await expect(
      session.signal({
        content: 'changed',
        admissionId: 'conflict',
        requestContext: { app: { tenant: 'one' } },
      }),
    ).rejects.toBeInstanceOf(HarnessAdmissionConflictError);
    await expect(
      session.signal({
        content: 'hello',
        admissionId: 'conflict',
        requestContext: { app: { tenant: 'two' } },
      }),
    ).rejects.toBeInstanceOf(HarnessAdmissionConflictError);
    await expect(
      session.signal({ content: 'hello', admissionId: 'unsafe-tools', additionalTools: { local: {} as never } }),
    ).rejects.toBeInstanceOf(HarnessValidationError);
    await expect(session.signal({ content: 'hello', admissionId: '' })).rejects.toBeInstanceOf(HarnessValidationError);
    expect(agent.streamCalls).toHaveLength(1);
  });

  it('resolves a completed retry from its original topology even while another run is active', async () => {
    const agent = new MockAgent({ id: 'default' });
    const { harness } = setupHarness({
      agents: { default: agent },
      modes: [
        { id: 'default', agentId: 'default' },
        { id: 'other', agentId: 'default' },
      ],
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const original = await session.signal({ content: 'original', admissionId: 'topology', mode: 'other' });
    await original.result;

    let release!: () => void;
    agent.enqueueRun({
      holdUntil: new Promise<void>(resolve => {
        release = resolve;
      }),
    });
    const active = session.message({ content: 'new active run' });
    await waitForStreamCalls(agent, 2);

    const duplicate = await session.signal({ content: 'original', admissionId: 'topology', mode: 'other' });
    expect(duplicate).toMatchObject({
      id: original.id,
      runId: original.runId,
      willInterleave: false,
    });
    expect(agent.streamCalls).toHaveLength(2);

    release();
    await active;
    await duplicate.result;
  });

  it('recovers a durable pre-dispatch reservation after restart under the same stable identity', async () => {
    const first = setupHarness();
    const session = await first.harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const admissionId = 'restart-before-dispatch';
    const admissionHash = (session as any)._computeSignalAdmissionHash(
      { content: 'recover me' },
      [],
      undefined,
    ) as string;
    const identity = (session as any)._signalAdmissionIdentity(admissionId) as {
      signalId: string;
      idleRunId: string;
    };
    const now = Date.now();
    await first.storage.writeMessageResultEvidence({
      status: 'pending',
      harnessName: session.getRecord().harnessName,
      sessionId: session.id,
      resourceId: session.resourceId,
      threadId: session.threadId,
      signalId: identity.signalId,
      modeId: 'default',
      modelId: session.getRecord().modelId,
      admissionId,
      admissionHash,
      createdAt: now,
      updatedAt: now,
    });
    const sessionId = session.id;
    await first.harness.shutdown();

    const second = setupHarness({ sessions: { storage: first.storage } });
    const recovered = await second.harness.session({ sessionId, resourceId: 'u1' });
    const handle = await recovered.signal({ content: 'recover me', admissionId });

    expect(handle).toMatchObject({
      id: identity.signalId,
      runId: identity.idleRunId,
      willInterleave: false,
    });
    await handle.result;
    expect(second.agent.streamCalls).toHaveLength(1);
    expect(handle.runId).not.toBe(handle.id);
  });

  it('replays one stable idle run identity after native acceptance wins but the durable accept CAS crashes', async () => {
    const firstAgent = new MockAgent({ id: 'default' });
    const first = setupHarness({ agents: { default: firstAgent } });
    const session = await first.harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const admissionId = 'accept-cas-crash';
    const identity = (session as any)._signalAdmissionIdentity(admissionId) as {
      signalId: string;
      idleRunId: string;
    };
    const realCas = first.storage.compareAndSwapSignalDispatch.bind(first.storage);
    let rejectAcceptedCas = true;
    first.storage.compareAndSwapSignalDispatch = async input => {
      if (rejectAcceptedCas && input.next.state === 'accepted') {
        rejectAcceptedCas = false;
        throw new Error('simulated crash after native acceptance');
      }
      return realCas(input);
    };

    await expect(session.signal({ content: 'recover accepted side effect', admissionId })).rejects.toMatchObject({
      name: 'HarnessExecutionError',
    });
    expect(firstAgent.streamCalls).toHaveLength(1);
    expect(firstAgent.streamCalls[0]?.options.runId).toBe(identity.idleRunId);
    await expect(session.lookupMessageResult(identity.signalId)).resolves.toMatchObject({
      status: 'pending',
      runId: identity.idleRunId,
      dispatch: { state: 'dispatching', delivery: 'idle', runId: identity.idleRunId },
    });

    first.storage.compareAndSwapSignalDispatch = realCas;
    await first.harness.shutdown();
    const future = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000);
    const recoveredAgent = new MockAgent({ id: 'default' });
    const second = setupHarness({
      agents: { default: recoveredAgent },
      sessions: { storage: first.storage },
    });
    const recovered = await second.harness.session({ sessionId: session.id, resourceId: 'u1' });
    const handle = await recovered.signal({ content: 'recover accepted side effect', admissionId });
    future.mockRestore();

    expect(handle).toMatchObject({
      id: identity.signalId,
      runId: identity.idleRunId,
      willInterleave: false,
      accepted: true,
    });
    expect(recoveredAgent.streamCalls).toHaveLength(1);
    expect(recoveredAgent.streamCalls[0]?.options.runId).toBe(identity.idleRunId);
    await expect(handle.result).resolves.toMatchObject({ finishReason: 'stop' });
    // The provider may execute again after the crash. The guarantee is one
    // durable at-least-once execution identity, not exactly-once provider work.
    expect([firstAgent.streamCalls[0]?.options.runId, recoveredAgent.streamCalls[0]?.options.runId]).toEqual([
      identity.idleRunId,
      identity.idleRunId,
    ]);
  });

  it('does not adopt another accepted attempt merely because it reused the same run id', async () => {
    const { harness, storage } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const admissionId = 'same-run-stale-attempt';
    const admissionHash = 'same-run-stale-hash';
    const identity = (session as any)._signalAdmissionIdentity(admissionId) as {
      signalId: string;
      idleRunId: string;
    };
    const dispatchingA = {
      state: 'dispatching' as const,
      attemptId: 'attempt-a',
      claimExpiresAt: 2000,
      delivery: 'idle' as const,
      runId: identity.idleRunId,
    };
    await storage.writeMessageResultEvidence({
      harnessName: session.getRecord().harnessName,
      sessionId: session.id,
      resourceId: session.resourceId,
      threadId: session.threadId,
      signalId: identity.signalId,
      runId: identity.idleRunId,
      admissionId,
      admissionHash,
      status: 'pending',
      dispatch: {
        state: 'accepted',
        attemptId: 'attempt-b',
        delivery: 'idle',
        runId: identity.idleRunId,
        acceptedAt: 3000,
      },
      createdAt: 1000,
      updatedAt: 3000,
    });

    await expect(
      (session as any)._acceptSignalDispatch(
        {
          admissionId,
          admissionHash,
          modeId: session.getRecord().modeId,
          modelId: session.getRecord().modelId,
          identity,
          createdAt: 1000,
          dispatch: dispatchingA,
        },
        dispatchingA,
      ),
    ).rejects.toThrow('durable signal acceptance lost its dispatch claim');
  });

  it('keeps the idle dispatch fence when the native acceptance acknowledgement is lost', async () => {
    const firstAgent = new MockAgent({ id: 'default' });
    const first = setupHarness({ agents: { default: firstAgent } });
    const session = await first.harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const admissionId = 'idle-lost-ack';
    const identity = (session as any)._signalAdmissionIdentity(admissionId) as {
      signalId: string;
      idleRunId: string;
    };
    const realSendSignal = firstAgent.sendSignal.bind(firstAgent);
    firstAgent.sendSignal = ((signal: any, target: any) => {
      const dispatched = realSendSignal(signal, target);
      return {
        ...dispatched,
        accepted: new Promise<never>(() => {}),
      };
    }) as typeof firstAgent.sendSignal;

    vi.useFakeTimers();
    try {
      const pending = session.signal({ content: 'idle lost acknowledgement', admissionId });
      const rejection = expect(pending).rejects.toMatchObject({ name: 'HarnessValidationError' });
      await vi.advanceTimersByTimeAsync(30_001);
      await rejection;
    } finally {
      vi.useRealTimers();
    }
    expect(firstAgent.streamCalls).toHaveLength(1);
    await expect(session.lookupMessageResult(identity.signalId)).resolves.toMatchObject({
      status: 'pending',
      runId: identity.idleRunId,
      dispatch: { state: 'dispatching', delivery: 'idle', runId: identity.idleRunId },
    });

    firstAgent.sendSignal = realSendSignal;
    await first.harness.shutdown();
    const now = Date.now();
    const future = vi.spyOn(Date, 'now').mockReturnValue(now + 120_000);
    const secondAgent = new MockAgent({ id: 'default' });
    const second = setupHarness({
      agents: { default: secondAgent },
      sessions: { storage: first.storage },
    });
    const recovered = await second.harness.session({ sessionId: session.id, resourceId: 'u1' });
    const handle = await recovered.signal({ content: 'idle lost acknowledgement', admissionId });
    future.mockRestore();

    expect(handle).toMatchObject({ runId: identity.idleRunId, willInterleave: false });
    expect(secondAgent.streamCalls[0]?.options.runId).toBe(identity.idleRunId);
    await handle.result;
  });

  it('recovers an idle native-acceptance timeout in the same process after the claim expires', async () => {
    const agent = new MockAgent({ id: 'default' });
    let releaseRun!: () => void;
    agent.enqueueRun({
      holdUntil: new Promise<void>(resolve => {
        releaseRun = resolve;
      }),
    });
    const { harness } = setupHarness({ agents: { default: agent } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const admissionId = 'same-process-timeout-retry';
    const realSendSignal = agent.sendSignal.bind(agent);
    let hideFirstAcknowledgement = true;
    agent.sendSignal = ((signal: any, target: any) => {
      const dispatched = realSendSignal(signal, target);
      if (!hideFirstAcknowledgement) return dispatched;
      hideFirstAcknowledgement = false;
      return { ...dispatched, accepted: new Promise<never>(() => {}) };
    }) as typeof agent.sendSignal;

    vi.useFakeTimers();
    try {
      const first = session.signal({ content: 'retry after timeout', admissionId });
      const rejection = expect(first).rejects.toMatchObject({ name: 'HarnessValidationError' });
      await vi.advanceTimersByTimeAsync(30_001);
      await rejection;
    } finally {
      vi.useRealTimers();
    }

    const future = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 120_000);
    const recovered = await session.signal({ content: 'retry after timeout', admissionId });
    future.mockRestore();

    expect(recovered).toMatchObject({ accepted: true, willInterleave: false });
    releaseRun();
    await expect(recovered.result).resolves.toMatchObject({ finishReason: 'stop' });
    expect(agent.streamCalls).toHaveLength(1);
  });

  it('recovers an aborted native-acceptance wait in the same process after the claim expires', async () => {
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({ holdUntil: new Promise<void>(() => {}) });
    agent.enqueueRun({ text: 'recovered after abort' });
    const { harness } = setupHarness({ agents: { default: agent } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const admissionId = 'same-process-abort-retry';
    const abortController = new AbortController();
    const realSendSignal = agent.sendSignal.bind(agent);
    let firstDispatch!: () => void;
    const dispatched = new Promise<void>(resolve => {
      firstDispatch = resolve;
    });
    let hideFirstAcknowledgement = true;
    agent.sendSignal = ((signal: any, target: any) => {
      const result = realSendSignal(signal, target);
      if (!hideFirstAcknowledgement) return result;
      hideFirstAcknowledgement = false;
      firstDispatch();
      return { ...result, accepted: new Promise<never>(() => {}) };
    }) as typeof agent.sendSignal;

    const first = session.signal({ content: 'retry after abort', admissionId, abortSignal: abortController.signal });
    await dispatched;
    abortController.abort(new Error('caller stopped waiting'));
    await expect(first).rejects.toMatchObject({ name: 'HarnessAbortedError', reason: 'agent_aborted' });

    const future = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 120_000);
    const recovered = await session.signal({ content: 'retry after abort', admissionId });
    future.mockRestore();

    expect(recovered).toMatchObject({ accepted: true, willInterleave: false });
    await expect(recovered.result).resolves.toMatchObject({ finishReason: 'stop', text: 'recovered after abort' });
    expect(agent.streamCalls).toHaveLength(2);
  });

  it('never reroutes an active lost-ack fence after its exact run vanishes', async () => {
    const firstAgent = new MockAgent({ id: 'default' });
    let releaseActive!: () => void;
    firstAgent.enqueueRun({
      holdUntil: new Promise<void>(resolve => {
        releaseActive = resolve;
      }),
    });
    const first = setupHarness({ agents: { default: firstAgent } });
    const session = await first.harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const active = session.message({ content: 'active first' });
    await waitForStreamCalls(firstAgent, 1);
    const activeRunId = firstAgent.streamCalls[0]?.options.runId as string;
    const admissionId = 'active-lost-ack';
    const identity = (session as any)._signalAdmissionIdentity(admissionId) as {
      signalId: string;
      idleRunId: string;
    };
    const realSendSignal = firstAgent.sendSignal.bind(firstAgent);
    firstAgent.sendSignal = ((signal: any, target: any) => {
      const dispatched = realSendSignal(signal, target);
      if (target.ifIdle?.behavior !== 'discard') return dispatched;
      return {
        ...dispatched,
        accepted: new Promise<never>(() => {}),
      };
    }) as typeof firstAgent.sendSignal;

    vi.useFakeTimers();
    try {
      const pending = session.signal({ content: 'active lost acknowledgement', admissionId });
      const rejection = expect(pending).rejects.toMatchObject({ name: 'HarnessValidationError' });
      await vi.advanceTimersByTimeAsync(30_001);
      await rejection;
    } finally {
      vi.useRealTimers();
    }
    await expect(session.lookupMessageResult(identity.signalId)).resolves.toMatchObject({
      status: 'pending',
      runId: activeRunId,
      dispatch: { state: 'dispatching', delivery: 'active', runId: activeRunId },
    });
    releaseActive();
    await active;
    firstAgent.sendSignal = realSendSignal;
    await first.harness.shutdown();

    const now = Date.now();
    const future = vi.spyOn(Date, 'now').mockReturnValue(now + 120_000);
    const second = setupHarness({ sessions: { storage: first.storage } });
    const recovered = await second.harness.session({ sessionId: session.id, resourceId: 'u1' });
    const handle = await recovered.signal({ content: 'active lost acknowledgement', admissionId });
    future.mockRestore();

    expect(handle).toMatchObject({ runId: activeRunId, willInterleave: true });
    await expect(handle.result).rejects.toMatchObject({ name: 'HarnessExecutionError' });
    expect(second.agent.streamCalls).toHaveLength(0);
  });

  it('deduplicates an idle admission across two Session instances without changing its routing receipt', async () => {
    const firstAgent = new MockAgent({ id: 'default' });
    const first = setupHarness({ agents: { default: firstAgent } });
    const firstSession = await first.harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const secondAgent = new MockAgent({ id: 'default' });
    const second = setupHarness({
      agents: { default: secondAgent },
      sessions: { storage: first.storage },
    });
    // Two Harness objects in one process share the same lease owner while still
    // retaining separate Session instances and process-local admission maps.
    Object.defineProperty(second.harness, 'ownerId', { value: first.harness.ownerId });
    const secondSession = await second.harness.session({ sessionId: firstSession.id, resourceId: 'u1' });
    expect(secondSession).not.toBe(firstSession);
    const admissionId = 'two-session-idle-race';
    const identity = (firstSession as any)._signalAdmissionIdentity(admissionId) as {
      signalId: string;
      idleRunId: string;
    };
    const firstDispatch = vi.spyOn(firstAgent, 'sendSignal');
    const secondDispatch = vi.spyOn(secondAgent, 'sendSignal');

    const [firstHandle, secondHandle] = await Promise.all([
      firstSession.signal({ content: 'one durable idle admission', admissionId }),
      secondSession.signal({ content: 'one durable idle admission', admissionId }),
    ]);

    expect(firstHandle).toMatchObject({ id: identity.signalId, runId: identity.idleRunId, willInterleave: false });
    expect(secondHandle).toMatchObject({ id: identity.signalId, runId: identity.idleRunId, willInterleave: false });
    expect(firstAgent.streamCalls.length + secondAgent.streamCalls.length).toBe(1);
    expect(firstDispatch.mock.calls.length + secondDispatch.mock.calls.length).toBe(1);
    expect([...firstAgent.streamCalls, ...secondAgent.streamCalls].map(call => call.options.runId)).toEqual([
      identity.idleRunId,
    ]);
    await Promise.all([firstHandle.result, secondHandle.result]);
  });

  it('fences a stale Session terminal writer after another Session reclaims the expired attempt', async () => {
    const first = setupHarness();
    const firstSession = await first.harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const second = setupHarness({ sessions: { storage: first.storage } });
    Object.defineProperty(second.harness, 'ownerId', { value: first.harness.ownerId });
    const secondSession = await second.harness.session({ sessionId: firstSession.id, resourceId: 'u1' });
    const admissionId = 'two-session-terminal-fence';
    const admissionHash = 'two-session-terminal-hash';
    const identity = (firstSession as any)._signalAdmissionIdentity(admissionId) as {
      signalId: string;
      idleRunId: string;
    };
    const acceptedA = {
      state: 'accepted' as const,
      attemptId: 'attempt-a',
      delivery: 'idle' as const,
      runId: identity.idleRunId,
      acceptedAt: 1000,
    };
    await first.storage.writeMessageResultEvidence({
      harnessName: firstSession.getRecord().harnessName,
      sessionId: firstSession.id,
      resourceId: firstSession.resourceId,
      threadId: firstSession.threadId,
      signalId: identity.signalId,
      runId: identity.idleRunId,
      admissionId,
      admissionHash,
      modeId: firstSession.getRecord().modeId,
      modelId: firstSession.getRecord().modelId,
      status: 'pending',
      dispatch: acceptedA,
      createdAt: 1000,
      updatedAt: 1000,
    });

    const realTerminalCas = first.storage.compareAndSwapSignalTerminal.bind(first.storage);
    let releaseStale!: () => void;
    let staleEntered!: () => void;
    const staleGate = new Promise<void>(resolve => {
      releaseStale = resolve;
    });
    const entered = new Promise<void>(resolve => {
      staleEntered = resolve;
    });
    first.storage.compareAndSwapSignalTerminal = async input => {
      if (input.expected.state === 'accepted' && input.expected.attemptId === 'attempt-a') {
        staleEntered();
        await staleGate;
      }
      return realTerminalCas(input);
    };

    const staleSettlement = (firstSession as any)._settleSignalResult(
      identity.signalId,
      { status: 'completed', runId: identity.idleRunId, result: { finishReason: 'stop', writer: 'stale' } },
      {
        admissionId,
        admissionHash,
        modeId: firstSession.getRecord().modeId,
        modelId: firstSession.getRecord().modelId,
        dispatch: acceptedA,
      },
    ) as Promise<void>;
    await entered;

    const dispatchingB = {
      state: 'dispatching' as const,
      attemptId: 'attempt-b',
      claimExpiresAt: 5000,
      delivery: 'idle' as const,
      runId: identity.idleRunId,
    };
    await expect(
      first.storage.compareAndSwapSignalDispatch({
        harnessName: firstSession.getRecord().harnessName,
        sessionId: firstSession.id,
        resourceId: firstSession.resourceId,
        threadId: firstSession.threadId,
        signalId: identity.signalId,
        admissionId,
        admissionHash,
        expected: acceptedA,
        next: dispatchingB,
        updatedAt: 2000,
      }),
    ).resolves.toMatchObject({ applied: true });
    const acceptedB = {
      state: 'accepted' as const,
      attemptId: 'attempt-b',
      delivery: 'idle' as const,
      runId: identity.idleRunId,
      acceptedAt: 3000,
    };
    await expect(
      first.storage.compareAndSwapSignalDispatch({
        harnessName: firstSession.getRecord().harnessName,
        sessionId: firstSession.id,
        resourceId: firstSession.resourceId,
        threadId: firstSession.threadId,
        signalId: identity.signalId,
        admissionId,
        admissionHash,
        expected: dispatchingB,
        next: acceptedB,
        updatedAt: 3000,
      }),
    ).resolves.toMatchObject({ applied: true });
    releaseStale();
    await staleSettlement;
    await expect(firstSession.lookupMessageResult(identity.signalId)).resolves.toMatchObject({
      status: 'pending',
      runId: identity.idleRunId,
      dispatch: acceptedB,
    });

    first.storage.compareAndSwapSignalTerminal = realTerminalCas;
    await (secondSession as any)._settleSignalResult(
      identity.signalId,
      { status: 'completed', runId: identity.idleRunId, result: { finishReason: 'stop', writer: 'winner' } },
      {
        admissionId,
        admissionHash,
        modeId: secondSession.getRecord().modeId,
        modelId: secondSession.getRecord().modelId,
        dispatch: acceptedB,
      },
    );
    await expect(secondSession.lookupMessageResult(identity.signalId)).resolves.toMatchObject({
      status: 'completed',
      runId: identity.idleRunId,
      result: { writer: 'winner' },
      dispatch: acceptedB,
    });
  });

  it('cold-migrates a legacy pending run row and replays its original idle identity', async () => {
    const first = setupHarness();
    const session = await first.harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const admissionId = 'legacy-run-recovery';
    const content = 'recover legacy accepted run';
    const admissionHash = (session as any)._computeSignalAdmissionHash({ content }, [], undefined) as string;
    const identity = (session as any)._signalAdmissionIdentity(admissionId) as {
      signalId: string;
      idleRunId: string;
    };
    await first.storage.writeMessageResultEvidence({
      status: 'pending',
      harnessName: session.getRecord().harnessName,
      sessionId: session.id,
      resourceId: session.resourceId,
      threadId: session.threadId,
      signalId: identity.signalId,
      runId: identity.idleRunId,
      modeId: session.getRecord().modeId,
      modelId: session.getRecord().modelId,
      admissionId,
      admissionHash,
      createdAt: 1000,
      updatedAt: 1000,
    });
    await first.harness.shutdown();

    const second = setupHarness({ sessions: { storage: first.storage } });
    const recovered = await second.harness.session({ sessionId: session.id, resourceId: 'u1' });
    const handle = await recovered.signal({ content, admissionId });

    expect(handle).toMatchObject({ id: identity.signalId, runId: identity.idleRunId, willInterleave: false });
    expect(second.agent.streamCalls).toHaveLength(1);
    expect(second.agent.streamCalls[0]?.options.runId).toBe(identity.idleRunId);
    await handle.result;
  });

  it('terminalizes a stale accepted active delivery instead of inventing a cold replacement run', async () => {
    const { harness, storage, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const admissionId = 'lost-active-run';
    const content = 'do not reroute me';
    const identity = (session as any)._signalAdmissionIdentity(admissionId) as {
      signalId: string;
      idleRunId: string;
    };
    const admissionHash = (session as any)._computeSignalAdmissionHash({ content }, [], undefined) as string;
    await storage.writeMessageResultEvidence({
      status: 'pending',
      harnessName: session.getRecord().harnessName,
      sessionId: session.id,
      resourceId: session.resourceId,
      threadId: session.threadId,
      signalId: identity.signalId,
      runId: 'vanished-active-run',
      modeId: session.getRecord().modeId,
      modelId: session.getRecord().modelId,
      admissionId,
      admissionHash,
      dispatch: {
        state: 'accepted',
        attemptId: 'original-attempt',
        delivery: 'active',
        runId: 'vanished-active-run',
        acceptedAt: 1000,
      },
      createdAt: 1000,
      updatedAt: 1000,
    });

    const handle = await session.signal({ content, admissionId });
    expect(handle).toMatchObject({ id: identity.signalId, runId: 'vanished-active-run', willInterleave: true });
    await expect(handle.result).rejects.toMatchObject({
      name: 'HarnessExecutionError',
      message: 'An internal harness error occurred',
    });
    expect(agent.streamCalls).toHaveLength(0);
    await expect(session.lookupMessageResult(identity.signalId)).resolves.toMatchObject({
      status: 'failed',
      runId: 'vanished-active-run',
    });
  });

  it('redispatches a pending admission with its persisted mode after the session default changes', async () => {
    const defaultAgent = new MockAgent({ id: 'default' });
    const recoveredAgent = new MockAgent({ id: 'recovered' });
    const { harness, storage } = setupHarness({
      agents: { default: defaultAgent, recovered: recoveredAgent },
      modes: [
        { id: 'default', agentId: 'default' },
        { id: 'recovered', agentId: 'recovered' },
      ],
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const admissionId = 'persisted-mode-recovery';
    const identity = await seedPendingSignalAdmission(session, storage, {
      admissionId,
      content: 'recover original mode',
      modeId: 'recovered',
    });
    const pending = await session.lookupMessageResult(identity.signalId);
    expect(pending).toMatchObject({ status: 'pending', runId: undefined, modeId: 'recovered' });

    const handle = await session.signal({ content: 'recover original mode', admissionId });
    expect(handle).toMatchObject({ id: identity.signalId, runId: identity.idleRunId, willInterleave: false });
    await handle.result;
    expect(recoveredAgent.streamCalls).toHaveLength(1);
    expect(defaultAgent.streamCalls).toHaveLength(0);
  });

  it('replays a terminal result after restart without dispatching a provider run', async () => {
    const first = setupHarness();
    const session = await first.harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const original = await session.signal({ content: 'persist result', admissionId: 'restart-terminal' });
    const result = await original.result;
    const sessionId = session.id;
    await first.harness.shutdown();

    const second = setupHarness({ sessions: { storage: first.storage } });
    const recovered = await second.harness.session({ sessionId, resourceId: 'u1' });
    const duplicate = await recovered.signal({ content: 'persist result', admissionId: 'restart-terminal' });

    expect(duplicate).toMatchObject({ id: original.id, runId: original.runId, willInterleave: false });
    await expect(duplicate.result).resolves.toEqual(result);
    expect(second.agent.streamCalls).toHaveLength(0);
    await expect(second.harness.session({ sessionId, resourceId: 'foreign' })).rejects.toBeInstanceOf(
      HarnessSessionNotFoundError,
    );
  });

  it('replays terminal evidence before resolving a mode that no longer exists', async () => {
    const { harness, storage, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const admissionId = 'removed-mode-terminal';
    const content = 'stored answer';
    const admissionHash = (session as any)._computeSignalAdmissionHash(
      { content, mode: 'removed-mode' },
      [],
      undefined,
    ) as string;
    const identity = (session as any)._signalAdmissionIdentity(admissionId) as {
      signalId: string;
      idleRunId: string;
    };
    const result = {
      runId: identity.idleRunId,
      text: 'terminal from removed mode',
      finishReason: 'stop',
      usage: {},
    } as any;
    const now = Date.now();
    await storage.writeMessageResultEvidence({
      status: 'completed',
      harnessName: session.getRecord().harnessName,
      sessionId: session.id,
      resourceId: session.resourceId,
      threadId: session.threadId,
      signalId: identity.signalId,
      runId: identity.idleRunId,
      modeId: 'removed-mode',
      modelId: session.getRecord().modelId,
      admissionId,
      admissionHash,
      result,
      createdAt: now,
      updatedAt: now,
    });

    const duplicate = await session.signal({ content, admissionId, mode: 'removed-mode' });
    expect(duplicate).toMatchObject({ id: identity.signalId, runId: identity.idleRunId });
    await expect(duplicate.result).resolves.toEqual(result);
    expect(agent.streamCalls).toHaveLength(0);
  });

  it('keeps an admitted suspended signal pending across restart and settles it on resume', async () => {
    const first = setupHarness();
    first.agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-restart', toolName: 'shell', args: { cmd: 'ls' } },
    });
    const session = await first.harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const original = await session.signal({ content: 'approve me', admissionId: 'restart-suspended' });
    let originalSettled = false;
    const originalResult = original.result.finally(() => {
      originalSettled = true;
    });
    void originalResult.catch(() => {});
    await waitFor(() => session.getRecord().pendingResume !== undefined, 'initial suspension');
    expect(originalSettled).toBe(false);
    const sameProcessDuplicate = await session.signal({ content: 'approve me', admissionId: 'restart-suspended' });
    let sameProcessDuplicateSettled = false;
    const sameProcessDuplicateResult = sameProcessDuplicate.result.finally(() => {
      sameProcessDuplicateSettled = true;
    });
    void sameProcessDuplicateResult.catch(() => {});
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(sameProcessDuplicateSettled).toBe(false);
    const now = Date.now();
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(now + 60_000);
    await new Promise<void>(resolve => setTimeout(resolve, 150));
    expect(originalSettled).toBe(false);
    expect(sameProcessDuplicateSettled).toBe(false);
    dateNow.mockRestore();
    const sessionId = session.id;
    await first.harness.shutdown();

    const secondAgent = new MockAgent({ id: 'default' });
    secondAgent.enqueueRun({ finishReason: 'stop', text: 'resumed once' });
    const second = setupHarness({
      agents: { default: secondAgent },
      sessions: { storage: first.storage },
    });
    const recovered = await second.harness.session({ sessionId, resourceId: 'u1' });
    const events: HarnessEvent[] = [];
    recovered.subscribe(event => events.push(event));
    const duplicate = await recovered.signal({ content: 'approve me', admissionId: 'restart-suspended' });

    expect(duplicate).toMatchObject({ id: original.id, runId: original.runId, willInterleave: false });
    expect(secondAgent.streamCalls).toHaveLength(0);
    await recovered.respondToToolApproval({ approved: true });
    await expect(duplicate.result).resolves.toMatchObject({ finishReason: 'stop', text: 'resumed once' });
    await expect(originalResult).resolves.toMatchObject({ finishReason: 'stop', text: 'resumed once' });
    await expect(sameProcessDuplicateResult).resolves.toMatchObject({ finishReason: 'stop', text: 'resumed once' });
    expect(secondAgent.resumeCalls).toHaveLength(1);
    expect(events.filter(event => event.type === 'signal_completed' && event.signalId === original.id)).toHaveLength(1);
    await expect(recovered.lookupMessageResult(original.id)).resolves.toMatchObject({
      status: 'completed',
      admissionId: 'restart-suspended',
    });
  });

  it('keeps admitted signal evidence pending when a retryable resume fails, then settles on retry', async () => {
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRuns([
      {
        finishReason: 'suspended',
        suspendPayload: { toolCallId: 'tc-retryable', toolName: 'shell', args: { cmd: 'pwd' } },
      },
      { finishReason: 'stop', text: 'resume retry succeeded' },
    ]);
    const realResume = agent.resumeStream.bind(agent);
    let rejectFirstResume = true;
    agent.resumeStream = (async (resumeData: any, options?: any) => {
      if (rejectFirstResume) {
        rejectFirstResume = false;
        agent.resumeCalls.push({ resumeData, options });
        throw new Error('transient resume provider failure');
      }
      return realResume(resumeData, options);
    }) as typeof agent.resumeStream;
    const { harness } = setupHarness({ agents: { default: agent } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const events: HarnessEvent[] = [];
    session.subscribe(event => events.push(event));
    const handle = await session.signal({ content: 'retry my approval', admissionId: 'retryable-resume' });
    let resultSettled = false;
    const result = handle.result.finally(() => {
      resultSettled = true;
    });
    void result.catch(() => {});
    await waitFor(() => session.getRecord().pendingResume !== undefined, 'retryable suspension');

    await expect(session.respondToToolApproval({ approved: true })).rejects.toMatchObject({
      name: 'HarnessExecutionError',
      message: 'An internal harness error occurred',
    });
    await waitFor(
      () => session.getRecord().pendingResume?.resumedAt === undefined,
      'failed resume marker to become retryable',
    );
    await expect(session.lookupMessageResult(handle.id)).resolves.toMatchObject({ status: 'pending' });
    await new Promise<void>(resolve => setTimeout(resolve, 150));
    expect(resultSettled).toBe(false);
    expect(events.filter(event => event.type === 'signal_failed' && event.signalId === handle.id)).toEqual([]);

    await session.respondToToolApproval({ approved: true });
    await expect(result).resolves.toMatchObject({ finishReason: 'stop', text: 'resume retry succeeded' });
    await expect(session.lookupMessageResult(handle.id)).resolves.toMatchObject({
      status: 'completed',
      result: expect.objectContaining({ text: 'resume retry succeeded' }),
    });
    expect(agent.resumeCalls).toHaveLength(2);
    expect(events.filter(event => event.type === 'signal_completed' && event.signalId === handle.id)).toHaveLength(1);
  });

  it('fails closed and redacts a reservation storage error before dispatch', async () => {
    const { harness, storage, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const realWrite = storage.writeMessageResultEvidence.bind(storage);
    let fail = true;
    storage.writeMessageResultEvidence = async record => {
      if (fail && record.admissionId === 'storage-failure') {
        fail = false;
        throw new Error('postgres://secret@db reservation failed');
      }
      return realWrite(record);
    };

    const thrown = await session.signal({ content: 'hello', admissionId: 'storage-failure' }).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(thrown).toMatchObject({ name: 'HarnessExecutionError', message: 'An internal harness error occurred' });
    expect((thrown as Error).message).not.toContain('secret');
    expect(agent.streamCalls).toHaveLength(0);

    const retried = await session.signal({ content: 'hello', admissionId: 'storage-failure' });
    await retried.result;
    expect(agent.streamCalls).toHaveLength(1);
  });

  it('redacts cached, live, and durable duplicate result failures', async () => {
    const scenarios = ['cached', 'live', 'durable'] as const;
    for (const scenario of scenarios) {
      const { harness, storage, agent } = setupHarness();
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
      const admissionId = `duplicate-${scenario}-failure`;
      const runId = `run-${scenario}-failure`;
      await seedPendingSignalAdmission(session, storage, {
        admissionId,
        content: 'replay failure',
        runId,
      });
      const secret = `${scenario}-dsn-secret`;

      let rejectLive: ((error: unknown) => void) | undefined;
      if (scenario === 'cached') {
        (session as any)._completedRuns.set(runId, { ok: false, err: new Error(secret) });
      } else if (scenario === 'live') {
        const promise = new Promise<never>((_, reject) => {
          rejectLive = reject;
        });
        void promise.catch(() => {});
        (session as any)._runCompletionPromises.set(runId, {
          promise,
          resolve: () => {},
          reject: rejectLive,
        });
      } else {
        storage.loadMessageResultEvidence = async () => {
          throw new Error(secret);
        };
      }

      const duplicate = session.signal({ content: 'replay failure', admissionId });
      if (scenario === 'durable') {
        await expectRedactedResult(duplicate, secret);
        expect(agent.streamCalls).toHaveLength(0);
        await harness.shutdown();
        continue;
      }
      const handle = await duplicate;
      rejectLive?.(new Error(secret));
      await expectRedactedResult(handle.result, secret);
      if (scenario === 'cached') {
        await expect(session.lookupMessageResult(handle.id)).resolves.toMatchObject({ status: 'failed' });
      }
      expect(agent.streamCalls).toHaveLength(0);
      await harness.shutdown();
    }
  });

  it('settles durable evidence from a cached completed run exactly once', async () => {
    const { harness, storage, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const runId = 'cached-completed-run';
    const identity = await seedPendingSignalAdmission(session, storage, {
      admissionId: 'cached-completed-admission',
      content: 'recover cached completion',
      runId,
    });
    const full = { runId, text: 'cached terminal', finishReason: 'stop', usage: {} } as any;
    (session as any)._completedRuns.set(runId, { ok: true, full });
    const events: HarnessEvent[] = [];
    session.subscribe(event => events.push(event));

    const [first, second] = await Promise.all([
      session.signal({ content: 'recover cached completion', admissionId: 'cached-completed-admission' }),
      session.signal({ content: 'recover cached completion', admissionId: 'cached-completed-admission' }),
    ]);
    await expect(first.result).resolves.toEqual(full);
    await expect(second.result).resolves.toEqual(full);
    await expect(session.lookupMessageResult(identity.signalId)).resolves.toMatchObject({
      status: 'completed',
      result: full,
    });
    expect(
      events.filter(event => event.type === 'signal_completed' && event.signalId === identity.signalId),
    ).toHaveLength(1);
    expect(agent.streamCalls).toHaveLength(0);
  });

  it('redacts an async duplicate subscription failure before returning a handle', async () => {
    const { harness, storage, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await seedPendingSignalAdmission(session, storage, {
      admissionId: 'subscription-failure',
      content: 'recover subscription',
      runId: 'subscription-failure-run',
    });
    const secret = 'redis://duplicate-subscription-secret';
    (session as any)._ensureThreadSubscription = async () => {
      throw new Error(secret);
    };

    const thrown = await session.signal({ content: 'recover subscription', admissionId: 'subscription-failure' }).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(thrown).toMatchObject({ name: 'HarnessExecutionError', message: 'An internal harness error occurred' });
    expect((thrown as Error).message).not.toContain(secret);
    expect(agent.streamCalls).toHaveLength(0);
  });

  it('redacts a fresh signal subscription failure for admitted and optimistic callers', async () => {
    for (const admitted of [false, true]) {
      const { harness, agent } = setupHarness();
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
      const secret = `redis://fresh-subscription-${admitted}-secret`;
      (session as any)._ensureThreadSubscription = async () => {
        throw new Error(secret);
      };

      const thrown = await session
        .signal({
          content: 'fresh subscription',
          ...(admitted ? { admissionId: 'fresh-subscription-admission' } : {}),
        })
        .then(
          () => undefined,
          (error: unknown) => error,
        );
      expect(thrown).toMatchObject({ name: 'HarnessExecutionError', message: 'An internal harness error occurred' });
      expect((thrown as Error).message).not.toContain(secret);
      expect(agent.streamCalls).toHaveLength(0);
      await harness.shutdown();
    }
  });

  it('emits no terminal event when durable evidence reports another actor won settlement', async () => {
    const { harness, storage } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const identity = await seedPendingSignalAdmission(session, storage, {
      admissionId: 'settlement-loser',
      content: 'settle once across actors',
      runId: 'settlement-loser-run',
    });
    const events: HarnessEvent[] = [];
    session.subscribe(event => events.push(event));
    const realTerminalCas = storage.compareAndSwapSignalTerminal.bind(storage);
    storage.compareAndSwapSignalTerminal = async input => {
      const result = await realTerminalCas(input);
      return input.signalId === identity.signalId && input.terminal.status === 'completed'
        ? { ...result, applied: false }
        : result;
    };
    const result = {
      runId: 'settlement-loser-run',
      text: 'won elsewhere',
      finishReason: 'stop',
      usage: {},
    } as any;

    await (session as any)._settleSignalResult(identity.signalId, {
      status: 'completed',
      runId: result.runId,
      result,
    });

    await expect(session.lookupMessageResult(identity.signalId)).resolves.toMatchObject({
      status: 'completed',
      result,
    });
    expect(events.filter(event => event.type === 'signal_completed' && event.signalId === identity.signalId)).toEqual(
      [],
    );
  });

  it('resolves owned and duplicate handles from the durable terminal winner after losing CAS', async () => {
    const agent = new MockAgent({ id: 'default', defaultOutput: { text: 'stale local result' } });
    const { harness, storage } = setupHarness({ agents: { default: agent } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const admissionId = 'owned-terminal-winner';
    const identity = (session as any)._signalAdmissionIdentity(admissionId) as { signalId: string; idleRunId: string };
    const realTerminalCas = storage.compareAndSwapSignalTerminal.bind(storage);
    let installedWinner = false;
    storage.compareAndSwapSignalTerminal = async input => {
      if (input.signalId !== identity.signalId || input.terminal.status !== 'completed' || installedWinner) {
        return realTerminalCas(input);
      }
      installedWinner = true;
      const winner = await realTerminalCas({
        ...input,
        terminal: {
          ...input.terminal,
          result: {
            runId: input.expected.state === 'reserved' ? undefined : input.expected.runId,
            finishReason: 'stop',
            text: 'durable terminal winner',
            usage: {},
          },
        },
      });
      return { applied: false, evidence: winner.evidence };
    };

    const original = await session.signal({ content: 'settle from durable winner', admissionId });
    await expect(original.result).resolves.toMatchObject({ text: 'durable terminal winner' });
    const duplicate = await session.signal({ content: 'settle from durable winner', admissionId });
    await expect(duplicate.result).resolves.toMatchObject({ text: 'durable terminal winner' });
    expect(agent.streamCalls).toHaveLength(1);
  });

  it('rejects an interleaved handle from the durable failed winner after local completion loses CAS', async () => {
    const agent = new MockAgent({ id: 'default' });
    let releaseActive!: () => void;
    agent.enqueueRun({
      holdUntil: new Promise<void>(resolve => {
        releaseActive = resolve;
      }),
      text: 'stale active result',
    });
    const { harness, storage } = setupHarness({ agents: { default: agent } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const active = session.message({ content: 'active first' });
    await waitForStreamCalls(agent, 1);
    const nativeSubscription = await agent.subscribeToThread({
      resourceId: session.resourceId,
      threadId: session.threadId,
    });
    await waitFor(() => nativeSubscription.activeRunId() !== null, 'native active run registration');
    const admissionId = 'interleaved-terminal-winner';
    const identity = (session as any)._signalAdmissionIdentity(admissionId) as { signalId: string; idleRunId: string };
    const realTerminalCas = storage.compareAndSwapSignalTerminal.bind(storage);
    let installedWinner = false;
    storage.compareAndSwapSignalTerminal = async input => {
      if (input.signalId !== identity.signalId || input.terminal.status !== 'completed' || installedWinner) {
        return realTerminalCas(input);
      }
      installedWinner = true;
      const winner = await realTerminalCas({
        ...input,
        terminal: {
          status: 'failed',
          signalId: input.signalId,
          runId: input.expected.state === 'reserved' ? undefined : input.expected.runId,
          error: { code: 'durable_winner_failed', message: 'durable winner failed' },
          modeId: input.terminal.modeId,
          modelId: input.terminal.modelId,
        },
      });
      return { applied: false, evidence: winner.evidence };
    };

    const signal = await session.signal({ content: 'interleave once', admissionId });
    expect(signal.willInterleave).toBe(true);
    releaseActive();
    await active;
    await expect(signal.result).rejects.toThrow('durable winner failed');
    const duplicate = await session.signal({ content: 'interleave once', admissionId });
    await expect(duplicate.result).rejects.toMatchObject({
      name: 'HarnessExecutionError',
      message: 'An internal harness error occurred',
    });
    await expect(session.lookupMessageResult(identity.signalId)).resolves.toMatchObject({
      status: 'failed',
      error: { code: 'durable_winner_failed', message: 'durable winner failed' },
    });
    nativeSubscription.unsubscribe();
  });

  it('scopes admission identity to the owning session/thread and keeps queue admission separate', async () => {
    const { harness, agent } = setupHarness();
    const a = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const b = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const signalA = await a.signal({ content: 'same', admissionId: 'shared-key' });
    const signalB = await b.signal({ content: 'same', admissionId: 'shared-key' });
    await Promise.all([signalA.result, signalB.result]);
    expect(signalB.id).not.toBe(signalA.id);

    const queued = a.queue({ content: 'same', admissionId: 'shared-key' });
    await expect(queued).resolves.toMatchObject({ finishReason: 'stop' });
    expect(agent.streamCalls).toHaveLength(3);
  });
});
