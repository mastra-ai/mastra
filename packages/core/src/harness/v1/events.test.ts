import { describe, expect, it, vi } from 'vitest';

import { HarnessValidationError } from './errors';
import { EventEmitter, formatHarnessEventId, parseHarnessEventId, snapshotHarnessEventForJson } from './events';

describe('Harness v1 event ids', () => {
  it('formats and parses stable harness-v1 event ids', () => {
    expect(formatHarnessEventId('epoch-1', 0)).toBe('harness-v1:epoch-1:0');
    expect(formatHarnessEventId('epoch-1', 42)).toBe('harness-v1:epoch-1:42');
    expect(parseHarnessEventId('harness-v1:epoch-1:42')).toEqual({ epoch: 'epoch-1', sequence: 42 });
  });

  it('rejects malformed event ids', () => {
    expect(() => formatHarnessEventId('', 0)).toThrow(HarnessValidationError);
    expect(() => formatHarnessEventId('bad:epoch', 0)).toThrow(HarnessValidationError);
    expect(() => formatHarnessEventId('epoch', -1)).toThrow(HarnessValidationError);
    expect(() => parseHarnessEventId('epoch-1-0')).toThrow(HarnessValidationError);
    expect(() => parseHarnessEventId('harness-v1:epoch-1:01')).toThrow(HarnessValidationError);
  });

  it('stamps events with deterministic epoch and sequence values', () => {
    const onEvent = vi.fn();
    const listener = vi.fn();
    const emitter = new EventEmitter({ sessionId: 'session-1' }, { epoch: 'epoch-1', nextSequence: 7, onEvent });
    emitter.subscribe(listener);

    const first = emitter.emit({ type: 'agent_start' });
    const second = emitter.emit({ type: 'message_start', messageId: 'message-1' });

    expect(first).toMatchObject({ id: 'harness-v1:epoch-1:7', sessionId: 'session-1' });
    expect(second).toMatchObject({ id: 'harness-v1:epoch-1:8', sessionId: 'session-1' });
    expect(onEvent).toHaveBeenCalledWith(first);
    expect(listener).toHaveBeenCalledWith(first);
  });

  it('dispatches against a listener snapshot when subscribers unsubscribe during emit', () => {
    const emitter = new EventEmitter(undefined, { epoch: 'epoch-1' });
    const second = vi.fn();
    let unsubscribeFirst = () => {};
    const first = vi.fn(() => unsubscribeFirst());
    unsubscribeFirst = emitter.subscribe(first);
    emitter.subscribe(second);

    emitter.emit({ type: 'agent_start' });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('snapshotHarnessEventForJson', () => {
  it('projects errors into public JSON objects', () => {
    const err = new Error('boom') as Error & { code?: string };
    err.code = 'custom.failure';

    expect(snapshotHarnessEventForJson({ error: err })).toEqual({
      error: {
        name: 'Error',
        code: 'custom.failure',
        message: 'boom',
      },
    });
  });

  it('rejects values that cannot be serialized as JSON', () => {
    expect(() => snapshotHarnessEventForJson({ value: 1n })).toThrow(HarnessValidationError);
    expect(() => snapshotHarnessEventForJson({ value: undefined })).toThrow(HarnessValidationError);
    expect(() => snapshotHarnessEventForJson({ value: Number.NaN })).toThrow(HarnessValidationError);
  });
});
