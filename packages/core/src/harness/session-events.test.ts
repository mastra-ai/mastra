import { describe, expect, it, vi } from 'vitest';

import {
  EventEmitter,
  HarnessEventSerializationError,
  HarnessValidationError,
  formatHarnessEventId,
  parseHarnessEventId,
} from './session-events';

const expectEventShell = (event: { id: string; timestamp: number }) => {
  expect(event.id).toMatch(/^harness-session:[0-9a-f-]{36}:\d+$/);
  expect(event.timestamp).toEqual(expect.any(Number));
};

describe('EventEmitter', () => {
  it('stamps events with monotonic ids and scope', () => {
    const emitter = new EventEmitter({ sessionId: 'session-1' }, { epoch: 'epoch-1' });
    const listener = vi.fn();
    emitter.subscribe(listener);

    const first = emitter.emit({ type: 'model_changed', modelId: 'model-2', previousModelId: 'model-1' });
    const second = emitter.emit({ type: 'mode_changed', modeId: 'plan', previousModeId: 'build' });

    expect(first).toMatchObject({ id: 'harness-session:epoch-1:0', sessionId: 'session-1' });
    expect(second).toMatchObject({ id: 'harness-session:epoch-1:1', sessionId: 'session-1' });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('does not skip listeners when one unsubscribes during dispatch', () => {
    const emitter = new EventEmitter();
    const second = vi.fn();
    let unsubscribeFirst = () => {};
    const first = vi.fn(() => unsubscribeFirst());
    unsubscribeFirst = emitter.subscribe(first);
    emitter.subscribe(second);

    emitter.emit({ type: 'model_changed', modelId: 'model-2', previousModelId: 'model-1' });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('forwards scoped events to the parent emitter without restamping', () => {
    const parent = new EventEmitter({}, { epoch: 'parent' });
    const child = parent.scoped({ sessionId: 'session-1' });
    const listener = vi.fn();
    parent.subscribe(listener);

    const event = child.emit({
      type: 'thread_cloned',
      threadId: 'thread-2',
      resourceId: 'resource-1',
      sourceThreadId: 'thread-1',
    });

    expectEventShell(event);
    expect(event.sessionId).toBe('session-1');
    expect(listener).toHaveBeenCalledWith(event);
  });

  it('requires custom event types to be namespaced and JSON-serializable', () => {
    const emitter = new EventEmitter();

    expect(() => emitter.emit({ type: 'thread_custom', payload: null })).toThrow(HarnessValidationError);
    expect(() => emitter.emit({ type: 'custom', payload: null })).toThrow(HarnessValidationError);
    expect(() => emitter.emit({ type: 'app.event', payload: { date: new Date() } as never })).toThrow(
      HarnessEventSerializationError,
    );

    expect(emitter.emit({ type: 'app.event', payload: { ok: true, nested: ['value'] } })).toMatchObject({
      type: 'app.event',
      payload: { ok: true, nested: ['value'] },
    });
  });
});

describe('harness event ids', () => {
  it('formats and parses event ids', () => {
    expect(formatHarnessEventId('epoch', 12)).toBe('harness-session:epoch:12');
    expect(parseHarnessEventId('harness-session:epoch:12')).toEqual({ epoch: 'epoch', sequence: 12 });
  });
});
