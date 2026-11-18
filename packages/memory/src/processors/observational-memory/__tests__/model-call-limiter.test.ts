import { afterEach, describe, expect, it } from 'vitest';

import { getOMModelCallStats, markOMModelCallsUrgent, runOMModelCall } from '../model-call-limiter';
import type { OMModelCallPriority } from '../model-call-limiter';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

/** Starts a run that holds its slot until `finish` is called, and records when it starts. */
function startRun(started: string[], name: string, key: string, priority: OMModelCallPriority, limit = 1) {
  const gate = deferred();
  const result = runOMModelCall({ key, priority, limit }, async () => {
    started.push(name);
    await gate.promise;
    return name;
  });
  return { result, finish: gate.resolve, fail: gate.reject };
}

afterEach(() => {
  expect(getOMModelCallStats()).toEqual({ active: 0, waiting: 0 });
});

describe('OM model-call limiter', () => {
  it('starts a waiting run an agent step blocks on before earlier background buffering', async () => {
    const started: string[] = [];
    const holder = startRun(started, 'holder', 'thread:a', 'background');
    const buffer = startRun(started, 'buffer', 'thread:b', 'background');
    const sync = startRun(started, 'sync', 'thread:c', 'blocking');
    await flush();
    expect(started).toEqual(['holder']);

    holder.finish();
    await flush();
    expect(started).toEqual(['holder', 'sync']);

    sync.finish();
    await flush();
    buffer.finish();
    await Promise.all([holder.result, buffer.result, sync.result]);
    expect(started).toEqual(['holder', 'sync', 'buffer']);
  });

  it('promotes background buffering for a thread whose step is waiting on it', async () => {
    const started: string[] = [];
    const holder = startRun(started, 'holder', 'thread:a', 'background');
    const other = startRun(started, 'other', 'thread:b', 'background');
    const awaited = startRun(started, 'awaited', 'thread:c', 'background');
    await flush();

    const clearUrgent = markOMModelCallsUrgent('thread:c');
    holder.finish();
    await flush();
    expect(started).toEqual(['holder', 'awaited']);
    clearUrgent();
    clearUrgent();

    awaited.finish();
    await flush();
    other.finish();
    await Promise.all([holder.result, other.result, awaited.result]);
    expect(started).toEqual(['holder', 'awaited', 'other']);
  });

  it('keeps background runs in arrival order once the waiting step clears its mark', async () => {
    const started: string[] = [];
    const holder = startRun(started, 'holder', 'thread:a', 'background');
    const first = startRun(started, 'first', 'thread:b', 'background');
    const second = startRun(started, 'second', 'thread:c', 'background');
    await flush();

    markOMModelCallsUrgent('thread:c')();
    holder.finish();
    await flush();
    first.finish();
    await flush();
    second.finish();
    await Promise.all([holder.result, first.result, second.result]);
    expect(started).toEqual(['holder', 'first', 'second']);
  });

  it('frees the slot when a run fails', async () => {
    const started: string[] = [];
    const failing = startRun(started, 'failing', 'thread:a', 'blocking');
    const next = startRun(started, 'next', 'thread:b', 'blocking');
    await flush();

    failing.fail(new Error('provider 500'));
    await expect(failing.result).rejects.toThrow('provider 500');
    await flush();
    expect(started).toEqual(['failing', 'next']);
    next.finish();
    await next.result;
  });

  it('skips a waiting run whose step is aborted and gives its turn to the next one', async () => {
    const started: string[] = [];
    const holder = startRun(started, 'holder', 'thread:a', 'blocking');
    const controller = new AbortController();
    const aborted = runOMModelCall(
      { key: 'thread:b', priority: 'blocking', limit: 1, abortSignal: controller.signal },
      async () => {
        started.push('aborted');
      },
    );
    const next = startRun(started, 'next', 'thread:c', 'blocking');
    await flush();

    controller.abort(new Error('user cancelled'));
    await expect(aborted).rejects.toThrow('user cancelled');
    holder.finish();
    await flush();
    next.finish();
    await Promise.all([holder.result, next.result]);
    expect(started).toEqual(['holder', 'next']);
  });

  it('lets a run with a higher limit start while a lower-limit run waits', async () => {
    const started: string[] = [];
    const holder = startRun(started, 'holder', 'thread:a', 'blocking', 1);
    const strict = startRun(started, 'strict', 'thread:b', 'blocking', 1);
    const loose = startRun(started, 'loose', 'thread:c', 'background', 2);
    await flush();
    expect(started).toEqual(['holder', 'loose']);

    holder.finish();
    loose.finish();
    await Promise.all([holder.result, loose.result]);
    await flush();
    strict.finish();
    await strict.result;
    expect(started).toEqual(['holder', 'loose', 'strict']);
  });
});
