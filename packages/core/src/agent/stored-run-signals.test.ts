import { describe, expect, it } from 'vitest';

import { createSignal } from './signals';
import { createStoredRunSignals } from './stored-run-signals';

const key = 'resource\u0000thread';
const message = (id: string) => createSignal({ id, type: 'user', contents: id });

/** Whether `promise` is already settled, decided before callbacks queued after this call run. */
const isSettled = (promise: Promise<unknown>) =>
  Promise.race([
    promise.then(
      () => true,
      () => true,
    ),
    Promise.resolve().then(() => false),
  ]);

function gate() {
  let open!: () => void;
  const opened = new Promise<void>(resolve => (open = resolve));
  return { open, opened };
}

/**
 * Bookkeeping rules of signals kept in storage that the thread runtime's
 * end-to-end tests reach only through races. A chain's cleanup is observed by
 * awaiting the chain's tail, whose cleanup callback was attached first.
 */
describe('stored run signals', () => {
  it("the cap evicts the oldest ended run, and remembering a thread's run again makes it the newest", () => {
    const signals = createStoredRunSignals<{ runId: string }>(2);

    signals.rememberEndedRun('a', { runId: 'a-1' }, 'owner-a');
    signals.rememberEndedRun('b', { runId: 'b-1' }, 'owner-b');
    signals.rememberEndedRun('a', { runId: 'a-2' }, 'owner-a');
    signals.rememberEndedRun('c', { runId: 'c-1' }, 'owner-c');

    expect(signals.endedRun('b')).toBeUndefined();
    expect(signals.endedRun('a')).toEqual({ run: { runId: 'a-2' }, leaseOwner: 'owner-a' });
    expect(signals.endedRun('c')?.run.runId).toBe('c-1');
  });

  it('an ended run is forgotten only while it is still the entry that was read', () => {
    const signals = createStoredRunSignals<{ runId: string }>();
    signals.rememberEndedRun(key, { runId: 'first' }, 'owner');
    const read = signals.endedRun(key);
    signals.rememberEndedRun(key, { runId: 'second' }, 'owner');

    signals.forgetEndedRunIfCurrent(key, read);
    expect(signals.endedRun(key)?.run.runId).toBe('second');

    signals.forgetEndedRunIfCurrent(key, signals.endedRun(key));
    expect(signals.endedRun(key)).toBeUndefined();
  });

  it("a thread's writes run in call order, and a rejected write does not stop the next", async () => {
    const signals = createStoredRunSignals<never>();
    const order: string[] = [];
    const started = gate();
    const release = gate();

    const first = signals.runWrite(key, async () => {
      order.push('first started');
      started.open();
      await release.opened;
      order.push('first');
      throw new Error('first failed');
    });
    const second = signals.runWrite(key, async () => {
      order.push('second');
      return 'second';
    });
    await started.opened;
    expect(order).toEqual(['first started']);

    release.open();
    await expect(first).rejects.toThrow('first failed');
    await expect(second).resolves.toBe('second');
    expect(order).toEqual(['first started', 'first', 'second']);
  });

  it("the thread's write chain is dropped once its last write settled, not while a later one is queued", async () => {
    const signals = createStoredRunSignals<never>();
    const release = gate();

    signals.runWrite(key, async () => {});
    const firstTail = signals.writesSettled(key);
    const second = signals.runWrite(key, () => release.opened);
    const secondTail = signals.writesSettled(key);
    await firstTail;
    expect(signals.writesSettled(key)).toBe(secondTail);

    release.open();
    await second;
    await secondTail;
    expect(signals.writesSettled(key)).toBeUndefined();
  });

  it('rows stamped inside one chain get strictly increasing `createdAt`', async () => {
    const signals = createStoredRunSignals<never>();
    const at = new Date('2026-01-01T00:00:00.000Z').getTime();
    const rows = [{ createdAt: new Date(at) }, { createdAt: new Date(at) }, { createdAt: new Date(at - 5) }];

    await signals.runWrite(key, async () => {
      for (const row of rows) signals.stampNewRow(key, row)();
    });

    expect(rows.map(row => row.createdAt.getTime() - at)).toEqual([0, 1, 2]);
  });

  it('a stamp in the future outlives its chain, and one in the past is dropped with it', async () => {
    const signals = createStoredRunSignals<never>();
    const future = Date.now() + 60_000;
    const past = Date.now() - 60_000;
    const pastKey = `${key}-past`;

    signals.runWrite(key, async () => signals.stampNewRow(key, { createdAt: new Date(future) })());
    signals.runWrite(pastKey, async () => signals.stampNewRow(pastKey, { createdAt: new Date(past) })());
    await signals.writesSettled(key);
    await signals.writesSettled(pastKey);

    const afterFuture = { createdAt: new Date(future) };
    signals.stampNewRow(key, afterFuture);
    expect(afterFuture.createdAt.getTime()).toBe(future + 1);
    const afterPast = { createdAt: new Date(past) };
    signals.stampNewRow(pastKey, afterPast);
    expect(afterPast.createdAt.getTime()).toBe(past);
  });

  it('a row the store did not accept leaves the next stamp unchanged', () => {
    const signals = createStoredRunSignals<never>();
    const at = new Date('2026-01-01T00:00:00.000Z').getTime();

    signals.stampNewRow(key, { createdAt: new Date(at) });
    const next = { createdAt: new Date(at) };
    signals.stampNewRow(key, next);

    expect(next.createdAt.getTime()).toBe(at);
  });

  it("a waiter settles when the run's waiters are settled", async () => {
    const signals = createStoredRunSignals<never>();
    const waiter = signals.preRunInsertWaiter('run', 'signal');

    expect(await isSettled(waiter)).toBe(false);
    signals.settlePreRunWaiters('run');

    expect(await isSettled(waiter)).toBe(true);
    await expect(waiter).resolves.toBeUndefined();
  });

  it('a taken waiter is settled only by its taker, and the rest are released together', async () => {
    const signals = createStoredRunSignals<never>();
    const settled: string[] = [];
    const taken = signals.preRunInsertWaiter('run', 'taken').then(() => settled.push('taken'));
    const rest = signals.preRunInsertWaiter('run', 'rest').then(() => settled.push('rest'));

    const waiters = signals.takePreRunWaiters('run');
    signals.settlePreRunWaiters('run');
    signals.clear();
    const waiter = waiters.take('taken');
    waiters.resolveRest();
    await rest;
    expect(settled).toEqual(['rest']);

    waiter?.reject(new Error('not stored'));
    await expect(taken).rejects.toThrow('not stored');
  });

  it('settling a run removes its waiters: a later waiter for the same run is a new one', async () => {
    const signals = createStoredRunSignals<never>();
    void signals.preRunInsertWaiter('run', 'first');
    signals.settlePreRunWaiters('run');

    const later = signals.preRunInsertWaiter('run', 'later');

    expect(await isSettled(later)).toBe(false);
    const waiters = signals.takePreRunWaiters('run');
    expect(waiters.take('first')).toBeUndefined();
    expect(waiters.take('later')).toBeDefined();
  });

  it("the run's remaining waiters are released in the order they were created", async () => {
    const signals = createStoredRunSignals<never>();
    const settled: string[] = [];
    const waiting = ['a', 'b', 'c'].map(id => signals.preRunInsertWaiter('run', id).then(() => settled.push(id)));

    signals.takePreRunWaiters('run').resolveRest();
    await Promise.all(waiting);

    expect(settled).toEqual(['a', 'b', 'c']);
  });

  it('clear releases waiting senders and forgets everything else', async () => {
    const signals = createStoredRunSignals<{ runId: string }>();
    const at = new Date('2026-01-01T00:00:00.000Z').getTime();
    const release = gate();
    const waiter = signals.preRunInsertWaiter('run', 'signal');
    signals.rememberEndedRun(key, { runId: 'ended' }, 'owner');
    signals.noteRemoteRun('remote', true);
    const write = signals.runWrite(key, () => release.opened);
    signals.stampNewRow(key, { createdAt: new Date(at) })();
    const used = message('used');
    expect(signals.takeFollowUpInput(key, [used], [used])?.id).toBe('used');

    signals.clear();

    expect(await isSettled(waiter)).toBe(true);
    await expect(waiter).resolves.toBeUndefined();
    expect(signals.endedRun(key)).toBeUndefined();
    expect(signals.writesSettled(key)).toBeUndefined();
    expect(signals.isRemoteRunStored('remote')).toBe(false);
    const row = { createdAt: new Date(at) };
    signals.stampNewRow(key, row);
    expect(row.createdAt.getTime()).toBe(at);
    expect(signals.takeFollowUpInput(key, [used], [used])?.id).toBe('used');
    release.open();
    await write;
  });

  it('a follow-up input skips one already used, forgets ids no longer pending, and returns one given back', () => {
    const signals = createStoredRunSignals<never>();
    const [a, b] = [message('a'), message('b')];

    expect(signals.takeFollowUpInput(key, [a, b], [a, b])?.id).toBe('a');
    expect(signals.takeFollowUpInput(key, [a, b], [a, b])?.id).toBe('b');
    expect(signals.takeFollowUpInput(key, [a, b], [a, b])).toBeUndefined();

    // `a` was claimed, then a row with its id is pending again: that row is a new input.
    expect(signals.takeFollowUpInput(key, [b], [b])).toBeUndefined();
    expect(signals.takeFollowUpInput(key, [a, b], [a, b])?.id).toBe('a');

    signals.returnFollowUpInput(key, 'a');
    expect(signals.takeFollowUpInput(key, [a, b], [a, b])?.id).toBe('a');
  });

  it("a thread's end-of-run checks run one after another, and a failed one goes to its handler", async () => {
    const signals = createStoredRunSignals<never>();
    const order: string[] = [];
    const errors: unknown[] = [];
    const started = gate();
    const release = gate();

    const first = signals.runEndOfRunCheck(
      key,
      async () => {
        order.push('first started');
        started.open();
        await release.opened;
        throw new Error('check failed');
      },
      error => errors.push(error),
    );
    const second = signals.runEndOfRunCheck(
      key,
      async () => {
        order.push('second');
      },
      error => errors.push(error),
    );
    await started.opened;
    expect(order).toEqual(['first started']);

    release.open();
    await first;
    await second;
    expect(order).toEqual(['first started', 'second']);
    expect(errors).toEqual([new Error('check failed')]);
  });

  it('a check queued after an earlier one finished still waits for the check running before it', async () => {
    const signals = createStoredRunSignals<never>();
    const order: string[] = [];
    const secondStarted = gate();
    const release = gate();
    const onError = () => {};

    const first = signals.runEndOfRunCheck(key, async () => {}, onError);
    const second = signals.runEndOfRunCheck(
      key,
      async () => {
        secondStarted.open();
        await release.opened;
        order.push('second ended');
      },
      onError,
    );
    await first;
    await secondStarted.opened;
    const third = signals.runEndOfRunCheck(
      key,
      async () => {
        order.push('third');
      },
      onError,
    );

    release.open();
    await second;
    await third;
    expect(order).toEqual(['second ended', 'third']);
  });

  it('a remote run is storage-backed as its latest registration said, until it is forgotten', () => {
    const signals = createStoredRunSignals<never>();

    signals.noteRemoteRun('run', true);
    expect(signals.isRemoteRunStored('run')).toBe(true);
    signals.noteRemoteRun('run', false);
    expect(signals.isRemoteRunStored('run')).toBe(false);
    signals.noteRemoteRun('run', true);
    signals.forgetRemoteRun('run');
    expect(signals.isRemoteRunStored('run')).toBe(false);
  });
});
