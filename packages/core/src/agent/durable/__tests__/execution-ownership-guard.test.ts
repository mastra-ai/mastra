import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DurableExecutionFenceError,
  EXECUTION_LEASE_RENEW_INTERVAL_MS,
  EXECUTION_LEASE_TTL_MS,
  EXECUTION_SUPERSEDED_ERROR_ID,
  EXECUTION_UNVERIFIED_ERROR_ID,
} from '../execution-fence';
import { ExecutionOwnershipGuard } from '../execution-ownership-guard';

const details = { agentId: 'agent', runId: 'run', executionId: 'original' };
const superseded = () => new DurableExecutionFenceError(EXECUTION_SUPERSEDED_ERROR_ID, details);

describe('invocation ownership observation', () => {
  const guards: ExecutionOwnershipGuard[] = [];
  const guard = (options: ConstructorParameters<typeof ExecutionOwnershipGuard>[0]) => {
    const result = new ExecutionOwnershipGuard(options);
    guards.push(result);
    return result;
  };
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    guards.forEach(value => value.dispose());
    guards.length = 0;
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it('polls during a step and latches takeover independently of the user signal', async () => {
    const observe = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const ownership = guard({ observe, details });
    await ownership.check();
    const user = new AbortController();
    const signal = ownership.composeSignal(user.signal);
    user.abort();
    observe.mockRejectedValue(superseded());
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
    expect(signal.aborted).toBe(true);
    expect(() => ownership.throwIfLost()).toThrow(DurableExecutionFenceError);
    expect(() => ownership.throwIfLost()).toThrow('lost its execution lease');
    expect(observe).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(observe).toHaveBeenCalledTimes(2);
  });

  it('does not time out a long local invocation whose coordinator still owns it', async () => {
    let lose!: (error: DurableExecutionFenceError) => void;
    const unsubscribe = vi.fn();
    const observe = vi.fn().mockResolvedValue(undefined);
    const ownership = guard({
      details,
      observe,
      subscribe: listener => {
        lose = listener;
        return unsubscribe;
      },
    });
    await ownership.check();
    await vi.advanceTimersByTimeAsync(90_000);
    expect(ownership.isLost()).toBe(false);
    lose(superseded());
    expect(ownership.composeSignal(undefined).aborted).toBe(true);
    ownership.dispose();
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(observe).toHaveBeenCalledOnce();
  });

  it.each(['initial', 'periodic', 'final'])('bounds a hung %s read and ignores its late completion', async boundary => {
    let complete!: () => void;
    const hung = new Promise<void>(resolve => {
      complete = resolve;
    });
    const observe = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const ownership = guard({ details, observe });
    if (boundary !== 'initial') await ownership.check();
    observe.mockReturnValue(hung);
    const checked = boundary === 'periodic' ? undefined : ownership.check();
    const rejected = checked && expect(checked).rejects.toMatchObject({ id: EXECUTION_UNVERIFIED_ERROR_ID });
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS);
    await rejected;
    expect(ownership.isLost()).toBe(true);
    complete();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retries transport failures but requires a positive initial and final boundary observation', async () => {
    const observe = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined)
      .mockRejectedValue(superseded());
    const ownership = guard({ details, observe });
    const entry = ownership.check();
    await vi.advanceTimersByTimeAsync(250);
    await entry;
    await expect(ownership.check()).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
    expect(observe).toHaveBeenCalledTimes(3);
  });

  it('waits for an in-flight periodic read then starts a fresh boundary read', async () => {
    let complete!: () => void;
    const observe = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const ownership = guard({ details, observe });
    await ownership.check();
    observe.mockReturnValueOnce(
      new Promise<void>(resolve => {
        complete = resolve;
      }),
    );
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
    observe.mockRejectedValue(superseded());
    const final = ownership.check();
    const rejected = expect(final).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
    complete();
    await rejected;
    expect(observe).toHaveBeenCalledTimes(3);
  });

  it('settles a hung read on disposal without marking ownership lost', async () => {
    const ownership = guard({ details, observe: () => new Promise(() => {}) });
    const checked = ownership.check();
    ownership.dispose();
    await checked;
    expect(ownership.isLost()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('serializes concurrent boundaries behind an in-flight read', async () => {
    const completions: (() => void)[] = [];
    const observe = vi.fn(
      () =>
        new Promise<void>(resolve => {
          completions.push(resolve);
        }),
    );
    const ownership = guard({ details, observe });
    const first = ownership.check();
    const second = ownership.check();
    const third = ownership.check();
    expect(observe).toHaveBeenCalledTimes(1);
    completions[0]!();
    await first;
    expect(observe).toHaveBeenCalledTimes(2);
    completions[1]!();
    await second;
    expect(observe).toHaveBeenCalledTimes(3);
    completions[2]!();
    await third;
  });

  it('does not revive a disposed invocation after a late read', async () => {
    let complete!: () => void;
    const ownership = guard({
      details,
      observe: () =>
        new Promise(resolve => {
          complete = resolve;
        }),
    });
    const entry = ownership.check();
    ownership.dispose();
    complete();
    await entry;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(ownership.isLost()).toBe(false);
  });
});
