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
});
