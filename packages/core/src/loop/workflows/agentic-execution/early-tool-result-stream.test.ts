import { describe, expect, it, vi } from 'vitest';
import { TripWire } from '../../../agent/trip-wire';
import { EarlyToolResultStream } from './early-tool-result-stream';
import type { ToolResultEmission } from './early-tool-result-stream';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const ok = async (): Promise<ToolResultEmission> => ({ ok: true });

describe('EarlyToolResultStream', () => {
  it('does not queue before begin(), or for a sequential batch', async () => {
    const stream = new EarlyToolResultStream();
    const emitter = vi.fn(ok);
    stream.setEmitter(emitter);

    expect(stream.settle({ toolCallId: 'a', result: 1 }, {})).toBe(false);

    stream.begin(false);
    expect(stream.settle({ toolCallId: 'a', result: 1 }, {})).toBe(false);

    await stream.tripwire();
    expect(emitter).not.toHaveBeenCalled();
  });

  it('does not queue without an emitter', async () => {
    const stream = new EarlyToolResultStream();
    stream.begin(true);
    expect(stream.settle({ toolCallId: 'a', result: 1 }, {})).toBe(false);
  });

  it('skips results that did not succeed', async () => {
    const stream = new EarlyToolResultStream();
    const emitter = vi.fn(ok);
    stream.setEmitter(emitter);
    stream.begin(true);

    expect(stream.settle({ toolCallId: 'a' }, {})).toBe(false); // no result
    expect(stream.settle({ toolCallId: 'b', result: 1, error: new Error('boom') }, {})).toBe(false);
    expect(stream.settle({ toolCallId: 'c', result: 1, aborted: true }, {})).toBe(false);
    expect(stream.settle({ toolCallId: 'd', result: 1, providerExecuted: true }, {})).toBe(false);
    expect(stream.settle({ toolCallId: 'e', result: 1, approval: { approved: false } }, {})).toBe(false);
    expect(stream.settle(undefined, {})).toBe(false);
    expect(stream.settle({ toolCallId: 'f', result: 1 }, undefined)).toBe(false);

    expect(stream.settle({ toolCallId: 'g', result: 1, approval: { approved: true } }, {})).toBe(true);

    await stream.tripwire();
    expect(emitter).toHaveBeenCalledTimes(1);
  });

  it('runs emissions one at a time in settle order', async () => {
    const stream = new EarlyToolResultStream();
    const order: string[] = [];
    let running = 0;
    let peak = 0;
    stream.setEmitter(async toolCall => {
      running += 1;
      peak = Math.max(peak, running);
      await delay(toolCall.toolCallId === 'slow' ? 20 : 5);
      order.push(toolCall.toolCallId);
      running -= 1;
      return { ok: true };
    });
    stream.begin(true);

    expect(stream.settle({ toolCallId: 'slow', result: 1 }, {})).toBe(true);
    expect(stream.settle({ toolCallId: 'fast', result: 2 }, {})).toBe(true);

    expect(await stream.take('fast')).toBe(true);
    expect(await stream.take('slow')).toBe(true);
    // The first settle runs to completion before the second starts, even though the
    // second would have finished sooner.
    expect(order).toEqual(['slow', 'fast']);
    expect(peak).toBe(1);
  });

  it('reports whether a call was streamed', async () => {
    const stream = new EarlyToolResultStream();
    stream.setEmitter(ok);
    stream.begin(true);
    stream.settle({ toolCallId: 'a', result: 1 }, {});

    expect(await stream.take('missing')).toBe(false);
    expect(await stream.take('a')).toBe(true);
    // A result is only streamed once.
    expect(await stream.take('a')).toBe(false);
  });

  it('surfaces a tripwire and skips later results', async () => {
    const stream = new EarlyToolResultStream();
    const tripwire = new TripWire('blocked');
    const emitter = vi.fn(async (toolCall: any): Promise<ToolResultEmission> => {
      if (toolCall.toolCallId === 'a') return { ok: false, tripwire };
      return { ok: true };
    });
    stream.setEmitter(emitter);
    stream.begin(true);

    stream.settle({ toolCallId: 'a', result: 1 }, {});
    stream.settle({ toolCallId: 'b', result: 2 }, {});

    // A blocked emission is not treated as streamed.
    expect(await stream.take('a')).toBe(false);
    expect(await stream.tripwire()).toBe(tripwire);
    // The result after the tripwire is never emitted, so its take() is false.
    expect(emitter).toHaveBeenCalledTimes(1);
    expect(await stream.take('b')).toBe(false);
  });

  it('rethrows from take() when an emission throws', async () => {
    const stream = new EarlyToolResultStream();
    const failure = new Error('processor exploded');
    stream.setEmitter(async toolCall => {
      if (toolCall.toolCallId === 'a') throw failure;
      return { ok: true };
    });
    stream.begin(true);

    stream.settle({ toolCallId: 'a', result: 1 }, {});
    stream.settle({ toolCallId: 'b', result: 2 }, {});

    await expect(stream.take('a')).rejects.toBe(failure);
    // A thrown emission does not set a tripwire, but later emissions still run.
    expect(await stream.tripwire()).toBeUndefined();
    expect(await stream.take('b')).toBe(true);
  });

  it('clears per-batch state on begin()', async () => {
    const stream = new EarlyToolResultStream();
    stream.setEmitter(ok);
    stream.begin(true);
    stream.settle({ toolCallId: 'a', result: 1 }, {});
    await stream.tripwire();

    stream.begin(true);
    expect(await stream.take('a')).toBe(false);
    expect(await stream.tripwire()).toBeUndefined();
  });
});
