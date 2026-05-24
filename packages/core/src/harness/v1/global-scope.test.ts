import type * as NodeCrypto from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Harness v1 global scope', () => {
  afterEach(() => {
    vi.doUnmock('node:crypto');
    vi.resetModules();
  });

  it('does not allocate event or owner ids until they are needed', async () => {
    vi.resetModules();
    const randomUUID = vi.fn(() => 'lazy-id');

    vi.doMock('node:crypto', async importOriginal => {
      const actual = await importOriginal<typeof NodeCrypto>();
      return { ...actual, randomUUID };
    });

    const { EventEmitter } = await import('./events');
    const { Harness } = await import('./harness');

    const emitter = new EventEmitter();
    const harness = new Harness({ modes: [] });

    expect(randomUUID).not.toHaveBeenCalled();
    expect(() => new EventEmitter({}, { nextSequence: -1 })).toThrow();
    expect(randomUUID).not.toHaveBeenCalled();

    expect(emitter.epochId).toBe('lazy-id');
    expect(emitter.epochId).toBe('lazy-id');
    expect(randomUUID).toHaveBeenCalledTimes(1);

    expect(harness.ownerId).toBe('harness-lazy-id');
    expect(harness.ownerId).toBe('harness-lazy-id');
    expect(randomUUID).toHaveBeenCalledTimes(2);
  });

  it('validates custom events before dispatching them', async () => {
    const { EventEmitter } = await import('./events');
    const { HarnessEventSerializationError, HarnessValidationError } = await import('./errors');

    const emitter = new EventEmitter({ sessionId: 'session-1' });
    const events: unknown[] = [];
    emitter.subscribe(event => {
      events.push(event);
    });

    expect(() => emitter.emit({ type: 'app.progress', payload: { ok: true } } as any)).not.toThrow();
    expect(events).toHaveLength(1);

    expect(() => emitter.emit({ type: 'app.progress', payload: { bad: () => undefined } } as any)).toThrow(
      HarnessEventSerializationError,
    );
    expect(() => emitter.emit({ type: 'workspace_custom', payload: { ok: true } } as any)).toThrow(
      HarnessValidationError,
    );
    expect(events).toHaveLength(1);
  });

  it('keeps OM and subagent events reserved instead of treating them as custom events', async () => {
    const { EventEmitter } = await import('./events');

    const emitter = new EventEmitter({ sessionId: 'session-1' });
    const events: unknown[] = [];
    emitter.subscribe(event => {
      events.push(event);
    });

    expect(() =>
      emitter.emit({
        type: 'om_status',
        threadId: 'thread-1',
        recordId: 'record-1',
        stepNumber: 1,
        generationCount: 1,
        windows: [],
      } as any),
    ).not.toThrow();
    expect(() =>
      emitter.emit({
        type: 'subagent_start',
        toolCallId: 'tool-1',
        agentType: 'default',
        task: 'inspect',
        depth: 1,
      } as any),
    ).not.toThrow();
    expect(events).toHaveLength(2);
  });

  it('does not skip sibling listeners when one unsubscribes during dispatch', async () => {
    const { EventEmitter } = await import('./events');

    const emitter = new EventEmitter({ sessionId: 'session-1' });
    const calls: string[] = [];

    // Three listeners; the FIRST removes itself synchronously on its first
    // event. Naïve `for (const l of this.listeners)` iteration would shift
    // the array and skip listener "b" because it now occupies index 0
    // while the for-of cursor advances to index 1.
    const unsubA = emitter.subscribe(() => {
      calls.push('a');
      unsubA();
    });
    emitter.subscribe(() => {
      calls.push('b');
    });
    emitter.subscribe(() => {
      calls.push('c');
    });

    emitter.emit({ type: 'app.progress', payload: { tick: 1 } } as any);
    expect(calls).toEqual(['a', 'b', 'c']);

    calls.length = 0;
    emitter.emit({ type: 'app.progress', payload: { tick: 2 } } as any);
    expect(calls).toEqual(['b', 'c']);
  });

  it('uses snapshot semantics: listeners unsubscribed mid-dispatch still receive the current emit', async () => {
    const { EventEmitter } = await import('./events');

    // Contract: dispatch iterates a snapshot taken at emit-start, so a
    // cross-listener unsubscribe during dispatch does NOT prevent the
    // removed listener from receiving the in-flight event. The removal
    // takes effect on subsequent emits. Pinning this here so future
    // refactors do not silently shift to "live array" semantics.
    const emitter = new EventEmitter({ sessionId: 'session-1' });
    const calls: string[] = [];

    let unsubB = () => {};
    emitter.subscribe(() => {
      calls.push('a');
      unsubB();
    });
    unsubB = emitter.subscribe(() => {
      calls.push('b');
    });
    emitter.subscribe(() => {
      calls.push('c');
    });

    emitter.emit({ type: 'app.progress', payload: { tick: 1 } } as any);
    expect(calls).toEqual(['a', 'b', 'c']);

    calls.length = 0;
    emitter.emit({ type: 'app.progress', payload: { tick: 2 } } as any);
    expect(calls).toEqual(['a', 'c']);
  });
});
