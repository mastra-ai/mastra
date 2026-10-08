import { describe, expect, it, vi } from 'vitest';

import type { Agent } from '../agent';
import { AgentThreadStreamRuntime } from '../thread-stream-runtime';
import { LeasePubSub, nextTicks } from './thread-stream-test-utils';

/** A run output whose parts and end the test drives, as an agent's stream would. */
function controlledOutput(runId: string) {
  let controller!: ReadableStreamDefaultController<any>;
  let finish!: () => void;
  const finished = new Promise<void>(resolve => (finish = resolve));
  const output = {
    runId,
    status: 'running',
    fullStream: new ReadableStream({
      start(c) {
        controller = c;
      },
    }),
    _waitUntilFinished: () => finished,
  } as any;
  return {
    output,
    push: (part: any) => controller.enqueue(part),
    end: (status: 'success' | 'suspended' | 'failed' = 'success') => {
      output.status = status;
      controller.close();
      finish();
    },
  };
}

const agent = { id: 'generation-agent', getMemory: async () => undefined } as unknown as Agent<any, any, any, any>;
const options = { memory: { thread: 'generation-thread', resource: 'generation-user' } } as any;
const text = (t: string) => ({ type: 'text-delta', payload: { id: 't', text: t } });
const start = { type: 'start', payload: {} };
const finish = { type: 'finish', payload: {} };
const summarize = (parts: any[]) =>
  parts.map(part => (part.type === 'text-delta' ? `text:${part.payload.text}` : part.type));

/** Processes on one bus: two that drive the run in turn, and observers whose subscribers read the thread. */
async function setup({ read: startReading = true } = {}) {
  const pubsub = new LeasePubSub();
  const original = new AgentThreadStreamRuntime();
  const recovering = new AgentThreadStreamRuntime();
  const join = async ({ read: startNow = true } = {}) => {
    const subscription = await new AgentThreadStreamRuntime().subscribeToThread(
      agent,
      { threadId: 'generation-thread', resourceId: 'generation-user' },
      pubsub,
    );
    const read: any[] = [];
    const startReader = () =>
      void (async () => {
        for await (const part of subscription.stream) read.push(part);
      })();
    if (startNow) startReader();
    return { subscription, read, startReader };
  };
  return { pubsub, original, recovering, join, ...(await join({ read: startReading })) };
}

describe('thread stream: runs taken over by a later claim generation', () => {
  it('ends the superseded execution for thread readers and drops what it still forwards', async () => {
    const { pubsub, original, recovering, subscription, read } = await setup();

    const a = controlledOutput('run-1');
    await original.registerRun(agent, a.output, options, pubsub, { generation: 1 });
    a.push(start);
    a.push(text('A-before-takeover '));
    await nextTicks(10);

    const b = controlledOutput('run-1');
    await recovering.registerRun(agent, b.output, options, pubsub, { strict: true, generation: 2 });
    b.push(start);
    b.push(text('B1 '));
    // The original caller's stream follows the run across the takeover, so its process re-broadcasts B's output.
    a.push(text('B1 '));
    b.push(text('B2'));
    a.push(text('B2'));
    b.push(finish);
    a.push(finish);
    b.end();
    a.end();

    await vi.waitFor(() => expect(read.some(part => part.type === 'finish')).toBe(true));
    await nextTicks(20);
    expect(summarize(read)).toEqual(['start', 'text:A-before-takeover ', 'start', 'text:B1 ', 'text:B2', 'finish']);
    subscription.unsubscribe();
  });

  it('moves thread readers on to the recovered execution when the original process died mid-run', async () => {
    const { pubsub, original, recovering, subscription, read } = await setup();

    const a = controlledOutput('run-1');
    await original.registerRun(agent, a.output, options, pubsub, { generation: 1 });
    a.push(start);
    a.push(text('A-partial '));
    await nextTicks(10);
    // The original process dies here: its output never ends.

    const b = controlledOutput('run-1');
    await recovering.registerRun(agent, b.output, options, pubsub, { strict: true, generation: 2 });
    b.push(start);
    b.push(text('B-answer'));
    b.push(finish);
    b.end();

    await vi.waitFor(() => expect(read.some(part => part.type === 'finish')).toBe(true));
    expect(summarize(read)).toEqual(['start', 'text:A-partial ', 'start', 'text:B-answer', 'finish']);
    subscription.unsubscribe();
  });

  it("ignores a registration and parts from an older generation that arrive after a recovery's", async () => {
    const { pubsub, original, recovering, subscription, read } = await setup();

    const b = controlledOutput('run-1');
    await recovering.registerRun(agent, b.output, options, pubsub, { strict: true, generation: 2 });
    b.push(start);
    b.push(text('B-answer'));
    b.push(finish);
    b.end();
    await vi.waitFor(() => expect(read.some(part => part.type === 'finish')).toBe(true));

    const a = controlledOutput('run-1');
    await original.registerRun(agent, a.output, options, pubsub, { generation: 1 });
    a.push(start);
    a.push(text('stale'));
    a.push(finish);
    a.end();
    await nextTicks(30);

    expect(summarize(read)).toEqual(['start', 'text:B-answer', 'finish']);
    subscription.unsubscribe();
  });

  /** The thread topic and stream the superseded execution registered under generation 1. */
  const originalRegistration = (pubsub: LeasePubSub) => {
    const delivery = pubsub.deliveries.find(
      ({ event }) => event.data?.type === 'run-registered' && event.data.generation === 1,
    )!;
    return { topic: delivery.topic, streamId: delivery.event.data.streamId as string };
  };
  const publishTerminal = async (pubsub: LeasePubSub, data: (streamId: string) => Record<string, unknown>) => {
    const { topic, streamId } = originalRegistration(pubsub);
    await pubsub.publish(topic, { type: data(streamId).type, runId: 'run-1', data: data(streamId) });
  };

  it.each([
    [
      'run-aborted',
      (_a: ReturnType<typeof controlledOutput>, pubsub: LeasePubSub) =>
        publishTerminal(pubsub, streamId => ({ type: 'run-aborted', runId: 'run-1', streamId })),
    ],
    [
      'run-failed',
      (_a: ReturnType<typeof controlledOutput>, pubsub: LeasePubSub) =>
        publishTerminal(pubsub, streamId => ({
          type: 'run-failed',
          runId: 'run-1',
          streamId,
          error: 'ownership lost',
        })),
    ],
    ['run-completed', (a: ReturnType<typeof controlledOutput>) => a.end('failed')],
  ] as const)(
    'keeps the recovered stream going when the superseded execution ends with %s mid-recovery',
    async (terminal, endOriginal) => {
      const { pubsub, original, recovering, subscription, read } = await setup();

      const a = controlledOutput('run-1');
      await original.registerRun(agent, a.output, options, pubsub, { generation: 1 });
      a.push(start);
      a.push(text('A-partial '));
      await nextTicks(10);

      const b = controlledOutput('run-1');
      await recovering.registerRun(agent, b.output, options, pubsub, { strict: true, generation: 2 });
      b.push(start);
      b.push(text('B1 '));
      await vi.waitFor(() => expect(summarize(read)).toContain('text:B1 '));

      await endOriginal(a, pubsub);
      const { streamId } = originalRegistration(pubsub);
      await vi.waitFor(() =>
        expect(
          pubsub.deliveries.some(({ event }) => event.data?.type === terminal && event.data.streamId === streamId),
        ).toBe(true),
      );
      await nextTicks(30);

      b.push(text('B2'));
      b.push(finish);
      b.end();
      await vi.waitFor(() => expect(read.some(part => part.type === 'finish')).toBe(true));
      await nextTicks(20);
      expect(summarize(read)).toEqual(['start', 'text:A-partial ', 'start', 'text:B1 ', 'text:B2', 'finish']);
      subscription.unsubscribe();
    },
  );

  it('keeps a reader that joined after the recovery on the recovered stream when the superseded execution aborts', async () => {
    const { pubsub, original, recovering, join, subscription: earlyReader } = await setup();

    const a = controlledOutput('run-1');
    await original.registerRun(agent, a.output, options, pubsub, { generation: 1 });
    a.push(start);
    await nextTicks(10);
    const b = controlledOutput('run-1');
    await recovering.registerRun(agent, b.output, options, pubsub, { strict: true, generation: 2 });
    b.push(start);
    await nextTicks(10);

    // This reader never saw either registration, so it cannot know the original's stream was superseded.
    const { subscription, read } = await join();
    b.push(text('B1 '));
    await vi.waitFor(() => expect(summarize(read)).toContain('text:B1 '));

    await publishTerminal(pubsub, streamId => ({ type: 'run-aborted', runId: 'run-1', streamId }));
    await nextTicks(20);
    b.push(text('B2'));
    b.push(finish);
    b.end();
    await vi.waitFor(() => expect(read.some(part => part.type === 'finish')).toBe(true));
    await nextTicks(20);
    expect(summarize(read)).toEqual(['text:B1 ', 'text:B2', 'finish']);
    subscription.unsubscribe();
    earlyReader.unsubscribe();
  });

  it.each([
    ['nothing is queued', undefined],
    ['a follow-up was queued before the recovery', 'before'],
    ['a follow-up was queued after the recovery', 'after'],
  ] as const)('leaves the run to the recovery when the superseded execution ends and %s', async (_case, queued) => {
    const { pubsub, original, recovering, subscription } = await setup({ read: false });
    const threadKey = 'generation-user\u0000generation-thread';
    const queueFollowUp = () =>
      original.sendSignal(
        agent,
        { type: 'user-message', contents: 'follow-up' },
        { runId: 'run-1', resourceId: 'generation-user', threadId: 'generation-thread' },
        pubsub,
      ).accepted;

    let originalLost = false;
    const a = controlledOutput('run-1');
    await original.registerRun(agent, a.output, options, pubsub, {
      generation: 1,
      ownershipLost: () => originalLost,
    });
    a.push(start);
    await nextTicks(10);
    if (queued === 'before') await queueFollowUp();

    const b = controlledOutput('run-1');
    await recovering.registerRun(agent, b.output, options, pubsub, { strict: true, generation: 2 });
    b.push(start);
    if (queued === 'after') await queueFollowUp();
    await nextTicks(10);
    originalLost = true;
    a.end('failed');
    await nextTicks(40);

    // The recovery still holds the thread, and gets the follow-up exactly once.
    expect(await pubsub.getLeaseOwner(threadKey)).toBe('run-1');
    const other = controlledOutput('run-2');
    await expect(
      new AgentThreadStreamRuntime().registerRun(agent, other.output, options, pubsub, { strict: true }),
    ).rejects.toThrow(/run-1/);
    expect(recovering.drainPendingSignals('run-1', pubsub).map(signal => signal.contents)).toEqual(
      queued ? ['follow-up'] : [],
    );

    b.push(finish);
    b.end();
    await vi.waitFor(async () => expect(await pubsub.getLeaseOwner(threadKey)).toBeUndefined());
    subscription.unsubscribe();
  });

  describe.each<[string, (claim: number) => number | undefined]>([
    ['claim generations (storage-fenced run)', claim => claim],
    ['no claim generations (lease-fenced run)', () => undefined],
  ])('a follow-up queued before the execution lost the run, with %s', (_backend, generation) => {
    const threadKey = 'generation-user\u0000generation-thread';

    async function takeOver(successor: 'this process' | 'another process', registers: 'before' | 'after') {
      const { pubsub, original, recovering, subscription } = await setup({ read: false });
      const successorRuntime = successor === 'this process' ? original : recovering;

      let originalLost = false;
      const a = controlledOutput('run-1');
      await original.registerRun(agent, a.output, options, pubsub, {
        generation: generation(1),
        ownershipLost: () => originalLost,
      });
      a.push(start);
      await nextTicks(10);
      await original.sendSignal(
        agent,
        { type: 'user-message', contents: 'follow-up' },
        { runId: 'run-1', resourceId: 'generation-user', threadId: 'generation-thread' },
        pubsub,
      ).accepted;
      originalLost = true;

      const b = controlledOutput('run-1');
      const registerSuccessor = () =>
        successorRuntime.registerRun(agent, b.output, options, pubsub, { strict: true, generation: generation(2) });
      if (registers === 'before') await registerSuccessor();
      a.end('failed');
      await nextTicks(40);
      if (registers === 'after') await registerSuccessor();
      b.push(start);
      await nextTicks(20);
      return { pubsub, successorRuntime, b, subscription };
    }

    it.each([
      ['this process', 'before'],
      ['this process', 'after'],
      ['another process', 'before'],
      ['another process', 'after'],
    ] as const)(
      'hands it to the execution in %s that registers the run %s the lost one ends',
      async (successor, registers) => {
        const { pubsub, successorRuntime, b, subscription } = await takeOver(successor, registers);

        expect(await pubsub.getLeaseOwner(threadKey)).toBe('run-1');
        expect(successorRuntime.drainPendingSignals('run-1', pubsub).map(signal => signal.contents)).toEqual([
          'follow-up',
        ]);

        b.push(finish);
        b.end();
        await vi.waitFor(async () => expect(await pubsub.getLeaseOwner(threadKey)).toBeUndefined());
        subscription.unsubscribe();
      },
    );

    it.each(['before', 'after'] as const)(
      'keeps renewing the thread lease for an execution in this process that registers the run %s the lost one ends',
      async registers => {
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
        try {
          const { pubsub, b, subscription } = await takeOver('this process', registers);
          const renewLease = vi.spyOn(pubsub, 'renewLease');

          vi.advanceTimersByTime(15_000);
          expect(renewLease).toHaveBeenCalledWith(threadKey, 'run-1', expect.any(Number));

          b.push(finish);
          b.end();
          await vi.waitFor(async () => expect(await pubsub.getLeaseOwner(threadKey)).toBeUndefined());
          subscription.unsubscribe();
        } finally {
          vi.useRealTimers();
        }
      },
    );

    it('does not mistake the registration of a process that drove the run earlier, replayed from the topic, for the one that takes it over', async () => {
      const crashed = new LeasePubSub();
      crashed.retain = true;
      const c = controlledOutput('run-1');
      await new AgentThreadStreamRuntime().registerRun(agent, c.output, options, crashed, {
        generation: generation(1),
      });
      c.push(start);
      await nextTicks(10);

      // That process dies; this one recovers the run from the same stream backend and replays its registration.
      const pubsub = crashed.restart();
      const runtime = new AgentThreadStreamRuntime();
      let lost = false;
      const a = controlledOutput('run-1');
      await runtime.registerRun(agent, a.output, options, pubsub, {
        strict: true,
        generation: generation(2),
        ownershipLost: () => lost,
      });
      a.push(start);
      await nextTicks(10);
      await runtime.sendSignal(
        agent,
        { type: 'user-message', contents: 'follow-up' },
        { runId: 'run-1', resourceId: 'generation-user', threadId: 'generation-thread' },
        pubsub,
      ).accepted;
      lost = true;
      a.end('failed');
      await nextTicks(40);

      const b = controlledOutput('run-1');
      await runtime.registerRun(agent, b.output, options, pubsub, { strict: true, generation: generation(3) });
      b.push(start);
      await nextTicks(20);
      expect(runtime.drainPendingSignals('run-1', pubsub).map(signal => signal.contents)).toEqual(['follow-up']);

      b.push(finish);
      b.end();
      await vi.waitFor(async () => expect(await pubsub.getLeaseOwner(threadKey)).toBeUndefined());
    });

    it('leaves them to the next run on the thread when the run never registers again', async () => {
      const { pubsub, original, subscription } = await setup({ read: false });
      let lost = false;
      const a = controlledOutput('run-1');
      await original.registerRun(agent, a.output, options, pubsub, {
        generation: generation(1),
        ownershipLost: () => lost,
      });
      a.push(start);
      await nextTicks(10);
      await original.sendSignal(
        agent,
        { type: 'user-message', contents: 'follow-up' },
        { runId: 'run-1', resourceId: 'generation-user', threadId: 'generation-thread' },
        pubsub,
      ).accepted;
      lost = true;
      a.end('failed');
      await nextTicks(40);

      // The execution that took the run over died before registering it; its thread lease lapses.
      expect(await pubsub.getLeaseOwner(threadKey)).toBe('run-1');
      pubsub.owners.delete(threadKey);

      const next = controlledOutput('run-2');
      await original.registerRun(agent, next.output, options, pubsub, { strict: true });
      next.push(start);
      await nextTicks(20);
      expect(original.drainPendingSignals('run-2', pubsub).map(signal => signal.contents)).toEqual(['follow-up']);

      next.push(finish);
      next.end();
      await vi.waitFor(async () => expect(await pubsub.getLeaseOwner(threadKey)).toBeUndefined());
      subscription.unsubscribe();
    });
  });

  it('keeps renewing the thread lease for a later registration of the run when an earlier renewal reports it gone', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      const { pubsub, original, subscription } = await setup({ read: false });
      const threadKey = 'generation-user\u0000generation-thread';
      let reportGone!: (renewed: boolean) => void;
      const renewLease = vi
        .spyOn(pubsub, 'renewLease')
        .mockImplementationOnce(() => new Promise<boolean>(resolve => (reportGone = resolve)));

      const a = controlledOutput('run-1');
      await original.registerRun(agent, a.output, options, pubsub);
      a.push(start);
      vi.advanceTimersByTime(15_000);
      expect(renewLease).toHaveBeenCalled();
      a.push(finish);
      a.end();
      await vi.waitFor(async () => expect(await pubsub.getLeaseOwner(threadKey)).toBeUndefined());

      const b = controlledOutput('run-1');
      await original.registerRun(agent, b.output, options, pubsub);
      b.push(start);
      reportGone(false);
      await nextTicks(10);
      renewLease.mockClear();
      vi.advanceTimersByTime(15_000);
      expect(renewLease).toHaveBeenCalledWith(threadKey, 'run-1', expect.any(Number));

      b.push(finish);
      b.end();
      await vi.waitFor(async () => expect(await pubsub.getLeaseOwner(threadKey)).toBeUndefined());
      subscription.unsubscribe();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a suspended half readable when another process resumes the run under a later generation', async () => {
    // The reader starts only after the resume registers, so the suspended half is still unread.
    const { pubsub, original, recovering, subscription, read, startReader } = await setup({ read: false });

    const a = controlledOutput('run-1');
    await original.registerRun(agent, a.output, options, pubsub, { generation: 1 });
    a.push(start);
    a.push(text('A-before-suspend'));
    a.end('suspended');
    await nextTicks(10);

    const b = controlledOutput('run-1');
    await recovering.registerRun(agent, b.output, options, pubsub, { generation: 2 });
    b.push(start);
    b.push(text('B-resumed'));
    b.push(finish);
    b.end();
    await nextTicks(10);

    startReader();
    await vi.waitFor(() => expect(read.some(part => part.type === 'finish')).toBe(true));
    expect(summarize(read)).toEqual(['start', 'text:A-before-suspend', 'start', 'text:B-resumed', 'finish']);
    subscription.unsubscribe();
  });
});
