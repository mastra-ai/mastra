import { describe, expect, it } from 'vitest';

import { OpenCodeStreamManager } from './stream';
import {
  collect,
  createMockOpenCodeClient,
  sessionErrorEvent,
  sessionIdleEvent,
  textPartUpdatedEvent,
} from './test-fixtures.mock';

describe('OpenCodeStreamManager', () => {
  it('does not subscribe to the event stream until openStream is first called (lazy initiation)', () => {
    const { client, subscribe } = createMockOpenCodeClient();
    new OpenCodeStreamManager(client);

    expect(subscribe).not.toHaveBeenCalled();
  });

  it('opens exactly one subscription for concurrent openStream calls and reuses it', async () => {
    const { client, subscribe } = createMockOpenCodeClient();
    const manager = new OpenCodeStreamManager(client);

    await Promise.all([manager.openStream('call-1'), manager.openStream('call-2')]);

    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it('routes events to the listener for their own session and keeps sessions separated', async () => {
    const { client, events } = createMockOpenCodeClient();
    const manager = new OpenCodeStreamManager(client);
    await manager.openStream('call-1');

    const sessionA = manager.listenStream('session-a');
    const sessionB = manager.listenStream('session-b');

    events.push(textPartUpdatedEvent('session-a', 'msg-a', 'part-a', 'hello a'));
    events.push(textPartUpdatedEvent('session-b', 'msg-b', 'part-b', 'hello b'));
    events.push(sessionIdleEvent('session-a'));
    events.push(sessionIdleEvent('session-b'));

    const [receivedA, receivedB] = await Promise.all([collect(sessionA), collect(sessionB)]);

    expect(receivedA.map(event => event.type)).toEqual(['message.part.updated', 'session.idle']);
    expect(receivedB.map(event => event.type)).toEqual(['message.part.updated', 'session.idle']);
    expect((receivedA[0] as any).properties.part.text).toBe('hello a');
    expect((receivedB[0] as any).properties.part.text).toBe('hello b');
  });

  it('only disconnects (aborts the subscription) once every ref has been closed', async () => {
    const { client, subscribe } = createMockOpenCodeClient();
    const manager = new OpenCodeStreamManager(client);

    await manager.openStream('call-1');
    await manager.openStream('call-2');
    expect(subscribe).toHaveBeenCalledTimes(1);
    const signal = subscribe.mock.calls[0]?.[1]?.signal as AbortSignal;

    manager.closeStream('call-1');
    expect(signal.aborted).toBe(false);

    manager.closeStream('call-2');
    expect(signal.aborted).toBe(true);
  });

  it('reconnects (calls subscribe again) after a full close followed by a new openStream', async () => {
    const { client, subscribe } = createMockOpenCodeClient();
    const manager = new OpenCodeStreamManager(client);

    await manager.openStream('call-1');
    manager.closeStream('call-1');
    await manager.openStream('call-2');

    expect(subscribe).toHaveBeenCalledTimes(2);
  });

  it('ends every open listener once the manager disconnects', async () => {
    const { client } = createMockOpenCodeClient();
    const manager = new OpenCodeStreamManager(client);
    await manager.openStream('call-1');

    const listener = manager.listenStream('session-a');
    manager.closeStream('call-1');

    expect((await listener.next()).done).toBe(true);
  });

  it('a consumer-driven early exit unregisters only that listener, not its siblings on the same session', async () => {
    const { client, events } = createMockOpenCodeClient();
    const manager = new OpenCodeStreamManager(client);
    await manager.openStream('call-1');

    const first = manager.listenStream('session-a');
    const second = manager.listenStream('session-a');

    await first.return();

    events.push(sessionIdleEvent('session-a'));
    const result = await second.next();

    expect(result.done).toBe(false);
    expect(result.value?.type).toBe('session.idle');
  });

  it('clears a session after its terminal event so a later listenStream for the same id starts fresh', async () => {
    const { client, events } = createMockOpenCodeClient();
    const manager = new OpenCodeStreamManager(client);
    await manager.openStream('call-1');

    const first = manager.listenStream('session-a');
    events.push(sessionIdleEvent('session-a'));
    expect((await first.next()).value?.type).toBe('session.idle');
    expect((await first.next()).done).toBe(true);

    const second = manager.listenStream('session-a');
    events.push(textPartUpdatedEvent('session-a', 'msg-a2', 'part-a2', 'fresh start'));
    const result = await second.next();

    expect(result.done).toBe(false);
    expect((result.value as any)?.properties.part.text).toBe('fresh start');
  });

  it('delivers a session.error event to its listener without throwing (the caller inspects the payload)', async () => {
    const { client, events } = createMockOpenCodeClient();
    const manager = new OpenCodeStreamManager(client);
    await manager.openStream('call-1');

    const listener = manager.listenStream('session-a');
    events.push(sessionErrorEvent('session-a', { name: 'UnknownError', data: { message: 'boom' } }));

    const received = await collect(listener);
    expect(received).toHaveLength(1);
    expect(received[0]?.type).toBe('session.error');
  });

  it('propagates a subscription failure to every active listener across sessions', async () => {
    const { client, events } = createMockOpenCodeClient();
    const manager = new OpenCodeStreamManager(client);
    await manager.openStream('call-1');

    const sessionA = manager.listenStream('session-a');
    const sessionB = manager.listenStream('session-b');

    events.end(new Error('subscription dropped'));

    await expect(sessionA.next()).rejects.toThrow('subscription dropped');
    await expect(sessionB.next()).rejects.toThrow('subscription dropped');
  });
});
