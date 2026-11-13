import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConnectClient } from '../connect-client.js';
import { MastraConnectError } from '../errors.js';
import { EventsClient, parseServerSentEvents, resolveEventsUrl } from '../events.js';
import type { EventCursor, EventStreamGap, EventsClientOptions, TopicEvent } from '../events.js';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

/**
 * A local events service. Each request is answered by the next handler in
 * order; the last handler answers any further requests.
 */
async function eventsServer(handlers: Handler[]) {
  const requests: IncomingMessage[] = [];
  const open = new Set<ServerResponse>();
  const server: Server = createServer((req, res) => {
    requests.push(req);
    open.add(res);
    res.on('close', () => open.delete(res));
    const handler = handlers[Math.min(requests.length - 1, handlers.length - 1)]!;
    handler(req, res);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    async close() {
      for (const res of open) res.destroy();
      await new Promise<void>(resolve => server.close(() => resolve()));
    },
  };
}

function startStream(res: ServerResponse) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store, private' });
}

function ready(cursor: string, retry = 1000) {
  return `event: ready\nid: ${cursor}\nretry: ${retry}\ndata: \n\n`;
}

function event(id: string, fields: Record<string, string>, timestamp = 1_700_000_000_000) {
  return `event: event\nid: ${id}\ndata: ${JSON.stringify({ id, timestamp, fields })}\n\n`;
}

const servers: Array<{ close(): Promise<void> }> = [];

async function server(handlers: Handler[]) {
  const s = await eventsServer(handlers);
  servers.push(s);
  return s;
}

function client(url: string, overrides: EventsClientOptions = {}) {
  return new EventsClient({
    accessToken: 'tok_secret',
    projectId: 'proj_1',
    eventsUrl: url,
    reconnectDelayMs: 5,
    ...overrides,
  });
}

async function take<T>(iterable: AsyncIterable<T>, count: number): Promise<T[]> {
  const out: T[] = [];
  if (count === 0) return out;
  for await (const item of iterable) {
    out.push(item);
    if (out.length === count) break;
  }
  return out;
}

async function failure(promise: Promise<unknown>): Promise<MastraConnectError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof MastraConnectError) return error;
    throw error;
  }
  throw new Error('expected a MastraConnectError');
}

beforeEach(() => {
  for (const name of [
    'MASTRA_EVENTS_API_URL',
    'MASTRA_PLATFORM_REGION',
    'MASTRA_PROJECT_ID',
    'MASTRA_PLATFORM_ACCESS_TOKEN',
    'MASTRA_PLATFORM_SECRET_KEY',
    'MASTRA_ORGANIZATION_ID',
    'MASTRA_INTEGRATIONS_API_URL',
  ]) {
    vi.stubEnv(name, '');
  }
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(servers.splice(0).map(s => s.close()));
});

describe('EventsClient.subscribe', () => {
  it('delivers ready and events, and tracks the cursor', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('10'));
        res.write(': ping\n\n');
        res.write(event('11', { kind: 'a' }));
        res.write(event('12', { kind: 'b' }));
      },
    ]);
    const subscription = client(s.url).subscribe('connect');
    expect(subscription.cursor).toBeUndefined();

    const events = await take(subscription, 2);
    await expect(subscription.ready).resolves.toBe('10');
    expect(events).toEqual<TopicEvent[]>([
      { id: '11', timestamp: 1_700_000_000_000, fields: { kind: 'a' } },
      { id: '12', timestamp: 1_700_000_000_000, fields: { kind: 'b' } },
    ]);
    expect(subscription.cursor).toBe('12');

    const [req] = s.requests;
    expect(req!.url).toBe('/v1/projects/proj_1/topics/connect');
    expect(req!.headers.authorization).toBe('Bearer tok_secret');
    expect(req!.headers.accept).toBe('text/event-stream');
    expect(req!.headers['last-event-id']).toBeUndefined();
  });

  it('starts from `after` and reports the ready cursor before any event', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('42'));
      },
    ]);
    const subscription = client(s.url).subscribe('connect', { after: '42' });
    const iterating = take(subscription, 1);
    await expect(subscription.ready).resolves.toBe('42');
    expect(subscription.cursor).toBe('42');
    expect(s.requests[0]!.headers['last-event-id']).toBe('42');
    subscription.close();
    await expect(iterating).resolves.toEqual([]);
  });

  it('resumes with Last-Event-ID after the server closes the stream', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('10'));
        res.end(event('11', { n: '1' }));
      },
      (_req, res) => {
        startStream(res);
        res.write(ready('11'));
        res.write(event('12', { n: '2' }));
      },
    ]);
    const events = await take(client(s.url).subscribe('connect'), 2);
    expect(events.map(e => e.id)).toEqual(['11', '12']);
    expect(s.requests).toHaveLength(2);
    expect(s.requests[1]!.headers['last-event-id']).toBe('11');
  });

  it('reconnects after an error frame', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('10'));
        res.write(event('11', { n: '1' }));
        // The connection stays open: the error frame alone must end it.
        res.write('event: error\ndata: Event stream interrupted\n\n');
      },
      (_req, res) => {
        startStream(res);
        res.write(ready('11'));
        res.write(event('12', { n: '2' }));
      },
    ]);
    const events = await take(client(s.url).subscribe('connect'), 2);
    expect(events.map(e => e.id)).toEqual(['11', '12']);
    expect(s.requests[1]!.headers['last-event-id']).toBe('11');
  });

  it('retries 503 with exponential backoff, then streams', async () => {
    const unavailable: Handler = (_req, res) => {
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Event stream unavailable' }));
    };
    const s = await server([
      unavailable,
      unavailable,
      unavailable,
      (_req, res) => {
        startStream(res);
        res.write(ready('10'));
        res.write(event('11', {}));
      },
    ]);
    const started = Date.now();
    const events = await take(client(s.url, { reconnectDelayMs: 20 }).subscribe('connect'), 1);
    const elapsed = Date.now() - started;

    expect(events.map(e => e.id)).toEqual(['11']);
    expect(s.requests).toHaveLength(4);
    // Jittered delays of at least 10, 20 and 40ms: no hot loop.
    expect(elapsed).toBeGreaterThanOrEqual(70);
  });

  it('reconnects after network failures', async () => {
    const s = await server([
      (_req, res) => res.socket?.destroy(),
      (_req, res) => {
        startStream(res);
        res.write(ready('10'));
        res.write(event('11', {}));
      },
    ]);
    const events = await take(client(s.url).subscribe('connect'), 1);
    expect(events.map(e => e.id)).toEqual(['11']);
    expect(s.requests).toHaveLength(2);
  });

  it('reconnects when the stream goes idle', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('10'));
      },
      (_req, res) => {
        startStream(res);
        res.write(ready('10'));
        res.write(event('11', {}));
      },
    ]);
    const events = await take(client(s.url, { idleTimeoutMs: 50 }).subscribe('connect'), 1);
    expect(events.map(e => e.id)).toEqual(['11']);
    expect(s.requests).toHaveLength(2);
    expect(s.requests[1]!.headers['last-event-id']).toBe('10');
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [404, 'platform_error'],
  ] as const)('ends with a fatal error on %i', async (status, code) => {
    const s = await server([
      (_req, res) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'nope' }));
      },
    ]);
    const subscription = client(s.url).subscribe('connect');
    const error = await failure(take(subscription, 1));
    expect(error.code).toBe(code);
    expect(error.status).toBe(status);
    expect(error.response?.status).toBe(status);
    expect(error.message).not.toContain('tok_secret');
    await expect(subscription.ready).rejects.toBe(error);
    expect(s.requests).toHaveLength(1);
  });

  it('maps a 400 on resume to invalid_cursor', async () => {
    const s = await server([
      (_req, res) => {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid event cursor' }));
      },
    ]);
    const error = await failure(take(client(s.url).subscribe('connect', { after: '-1' }), 1));
    expect(error.code).toBe('invalid_cursor');
    expect(error.status).toBe(400);
  });

  it('maps a 400 on a later reconnect to invalid_cursor', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('10'));
        res.end(event('11', {}));
      },
      (_req, res) => {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid event cursor' }));
      },
    ]);
    const subscription = client(s.url).subscribe('connect');
    const seen: string[] = [];
    const error = await failure(
      (async () => {
        for await (const e of subscription) seen.push(e.id);
      })(),
    );
    expect(seen).toEqual(['11']);
    expect(error.code).toBe('invalid_cursor');
    expect(subscription.cursor).toBe('11');
  });

  it('ends cleanly when the signal aborts mid-stream', async () => {
    let serverSawClose!: () => void;
    const closedByClient = new Promise<void>(resolve => (serverSawClose = resolve));
    const s = await server([
      (req, res) => {
        req.on('close', () => serverSawClose());
        startStream(res);
        res.write(ready('10'));
        res.write(event('11', {}));
      },
    ]);
    const controller = new AbortController();
    const subscription = client(s.url).subscribe('connect', { signal: controller.signal });
    const seen: string[] = [];
    const done = (async () => {
      for await (const e of subscription) {
        seen.push(e.id);
        // Abort while the iterator waits for an event that never comes.
        setTimeout(() => controller.abort(), 10);
      }
    })();
    await expect(done).resolves.toBeUndefined();
    expect(seen).toEqual(['11']);
    await closedByClient;
  });

  it('close() before iteration ends iteration immediately', async () => {
    const s = await server([(_req, res) => startStream(res)]);
    const subscription = client(s.url).subscribe('connect');
    subscription.close();
    await expect(take(subscription, 1)).resolves.toEqual([]);
    await expect(subscription.ready).rejects.toBeInstanceOf(MastraConnectError);
    expect(s.requests).toHaveLength(0);
  });

  it('joins multi-line data', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('10'));
        res.write('event: event\nid: 11\ndata: {"id":"11","timestamp":5,\ndata: "fields":{"a":"b"}}\n\n');
      },
    ]);
    const [e] = await take(client(s.url).subscribe('connect'), 1);
    expect(e).toEqual({ id: '11', timestamp: 5, fields: { a: 'b' } });
  });

  it('parses a frame written one byte at a time', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('10'));
        const frame = event('11', { text: 'héllo' }).replace(/\n/g, '\r\n');
        const bytes = Buffer.from(frame, 'utf8');
        let i = 0;
        const tick = setInterval(() => {
          if (i >= bytes.length) return clearInterval(tick);
          res.write(bytes.subarray(i, i + 1));
          i++;
        }, 0);
        res.on('close', () => clearInterval(tick));
      },
    ]);
    const [e] = await take(client(s.url).subscribe('connect'), 1);
    expect(e).toEqual({ id: '11', timestamp: 1_700_000_000_000, fields: { text: 'héllo' } });
  });

  it('ends with invalid_response on malformed event data', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('10'));
        res.write('event: event\nid: 11\ndata: {"id":"11"}\n\n');
      },
    ]);
    const error = await failure(take(client(s.url).subscribe('connect'), 1));
    expect(error.code).toBe('invalid_response');
  });

  it('validates the topic, the cursor and the project before connecting', () => {
    const events = client('http://127.0.0.1:1');
    expect(() => events.subscribe('Connect')).toThrow(MastraConnectError);
    expect(() => events.subscribe('9connect')).toThrow(MastraConnectError);
    expect(() => events.subscribe(`a${'b'.repeat(63)}`)).toThrow(MastraConnectError);
    expect(() => events.subscribe('connect', { after: 'abc' })).toThrow(MastraConnectError);
    expect(() => events.subscribe('connect', { after: '1'.repeat(21) })).toThrow(MastraConnectError);
    expect(() => events.subscribe('connect', { after: '-1' })).not.toThrow();

    const noProject = new EventsClient({ accessToken: 'tok', eventsUrl: 'http://127.0.0.1:1' });
    let error: unknown;
    try {
      noProject.subscribe('connect');
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(MastraConnectError);
    expect((error as MastraConnectError).code).toBe('missing_project_id');
    expect(() => noProject.subscribe('connect', { projectId: 'proj_2' })).not.toThrow();
  });

  it('uses a per-subscription projectId', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('10'));
        res.write(event('11', {}));
      },
    ]);
    await take(client(s.url).subscribe('github-app', { projectId: 'proj 2' }), 1);
    expect(s.requests[0]!.url).toBe('/v1/projects/proj%202/topics/github-app');
    expect(s.requests[0]!.headers['x-mastra-project-id']).toBe('proj 2');
  });

  it('starts from the server retry and floors a zero retry', async () => {
    const closeAfterReady: Handler = (_req, res) => {
      startStream(res);
      res.end(ready('10', 0));
    };
    const s = await server([
      closeAfterReady,
      (_req, res) => {
        startStream(res);
        res.write(ready('10'));
        res.write(event('11', {}));
      },
    ]);
    const started = Date.now();
    const events = await take(client(s.url, { reconnectDelayMs: undefined }).subscribe('connect'), 1);

    expect(events.map(e => e.id)).toEqual(['11']);
    expect(s.requests).toHaveLength(2);
    // retry: 0 is floored to 100ms, jittered to at least 50ms.
    expect(Date.now() - started).toBeGreaterThanOrEqual(50);
  });

  it('waits for Retry-After on a 503, up to maxReconnectDelayMs', async () => {
    const s = await server([
      (_req, res) => {
        res.writeHead(503, { 'content-type': 'application/json', 'retry-after': '5' });
        res.end('{}');
      },
      (_req, res) => {
        startStream(res);
        res.write(ready('10'));
        res.write(event('11', {}));
      },
    ]);
    const started = Date.now();
    await take(client(s.url, { maxReconnectDelayMs: 150 }).subscribe('connect'), 1);
    const elapsed = Date.now() - started;

    expect(s.requests).toHaveLength(2);
    expect(elapsed).toBeGreaterThanOrEqual(140);
    expect(elapsed).toBeLessThan(2_000);
  });

  it('keeps the connection while the consumer handles a slow event', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('10'));
        res.write(event('11', {}));
        const ping = setInterval(() => res.write(': ping\n\n'), 10);
        setTimeout(() => {
          clearInterval(ping);
          res.write(event('12', {}));
        }, 200);
        res.on('close', () => clearInterval(ping));
      },
    ]);
    const ids: string[] = [];
    for await (const e of client(s.url, { idleTimeoutMs: 50 }).subscribe('connect')) {
      ids.push(e.id);
      if (ids.length === 1) await new Promise(resolve => setTimeout(resolve, 150));
      if (ids.length === 2) break;
    }

    expect(ids).toEqual(['11', '12']);
    expect(s.requests).toHaveLength(1);
  });

  it('holds an abort listener on the caller signal only while iterating', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('10'));
        res.write(event('11', {}));
      },
    ]);
    const controller = new AbortController();
    const add = vi.spyOn(controller.signal, 'addEventListener');
    const remove = vi.spyOn(controller.signal, 'removeEventListener');

    const idle = client(s.url).subscribe('connect', { signal: controller.signal });
    idle.close();
    expect(add).not.toHaveBeenCalled();

    await take(client(s.url).subscribe('connect', { signal: controller.signal }), 1);
    expect(add).toHaveBeenCalledTimes(1);
    const listener = add.mock.calls[0]![1];
    expect(remove).toHaveBeenCalledWith('abort', listener);
  });

  it('rejects invalid timing options and events URLs at construction', () => {
    for (const options of [
      { reconnectDelayMs: 0 },
      { reconnectDelayMs: -1 },
      { maxReconnectDelayMs: Number.NaN },
      { idleTimeoutMs: 0 },
      { idleTimeoutMs: Number.MAX_SAFE_INTEGER },
    ]) {
      expect(() => client('http://127.0.0.1:1', options)).toThrow(MastraConnectError);
    }
    for (const eventsUrl of ['not a url', 'ftp://user:secret@events.test']) {
      expect(() => client(eventsUrl)).toThrow(/Invalid events service URL/);
      expect(() => client(eventsUrl)).not.toThrow(/secret/);
      expect(
        () => new ConnectClient({ accessToken: 'tok', projectId: 'proj_1', eventsUrl }),
        'ConnectClient validates the events URL at construction',
      ).toThrow(/Invalid events service URL/);
    }
  });
});

function memoryStore(initial: EventCursor | null = null) {
  const saved: EventCursor[] = [];
  const load = vi.fn(() => initial);
  return {
    saved,
    load,
    store: {
      load,
      save(cursor: EventCursor) {
        saved.push(cursor);
      },
    },
  };
}

function badCursor(_req: IncomingMessage, res: ServerResponse) {
  res.writeHead(400, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'Invalid event cursor' }));
}

describe('EventsClient.subscribe with a cursor store', () => {
  it('saves an event once the loop body finishes, never one whose handling threw', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('10'));
        res.write(event('11', {}, 1_000));
        res.write(event('12', {}, 2_000));
        res.write(event('13', {}, 3_000));
      },
    ]);
    const { saved, store } = memoryStore();
    const failed = (async () => {
      for await (const e of client(s.url).subscribe('connect', { cursorStore: store })) {
        if (e.id === '13') throw new Error('handler failed');
      }
    })();
    await expect(failed).rejects.toThrow('handler failed');
    expect(saved).toEqual([
      { eventId: '11', timestamp: 1_000 },
      { eventId: '12', timestamp: 2_000 },
    ]);
  });

  it('does not save the event the consumer broke out on, or a ready cursor', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('10'));
        res.write(event('11', {}, 1_000));
        res.write(event('12', {}, 2_000));
      },
    ]);
    const { saved, store } = memoryStore();
    const events = await take(client(s.url).subscribe('connect', { cursorStore: store }), 2);
    expect(events.map(e => e.id)).toEqual(['11', '12']);
    expect(saved).toEqual([{ eventId: '11', timestamp: 1_000 }]);

    const idle = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('10'));
      },
    ]);
    const quiet = memoryStore();
    const subscription = client(idle.url).subscribe('connect', { cursorStore: quiet.store });
    const iterating = take(subscription, 1);
    await expect(subscription.ready).resolves.toBe('10');
    subscription.close();
    await iterating;
    expect(quiet.saved).toEqual([]);
  });

  it('starts from after, then the stored id, the stored time, then afterTimestamp', async () => {
    const answer: Handler = (_req, res) => {
      startStream(res);
      res.write(ready('40'));
      res.write(event('41', {}));
    };
    const start = async (options: Parameters<EventsClient['subscribe']>[1]) => {
      const s = await server([answer]);
      await take(client(s.url).subscribe('connect', options), 1);
      return { url: s.requests[0]!.url, lastEventId: s.requests[0]!.headers['last-event-id'] };
    };
    const path = '/v1/projects/proj_1/topics/connect';

    const explicit = memoryStore({ eventId: '20', timestamp: 5 });
    await expect(start({ after: '30', cursorStore: explicit.store })).resolves.toEqual({
      url: path,
      lastEventId: '30',
    });
    expect(explicit.load).not.toHaveBeenCalled();

    await expect(start({ cursorStore: memoryStore({ eventId: '20', timestamp: 5 }).store })).resolves.toEqual({
      url: path,
      lastEventId: '20',
    });
    await expect(start({ cursorStore: memoryStore({ timestamp: 5 }).store, afterTimestamp: 7 })).resolves.toEqual({
      url: `${path}?afterTimestamp=5`,
      lastEventId: undefined,
    });
    await expect(start({ cursorStore: memoryStore(null).store, afterTimestamp: 7 })).resolves.toEqual({
      url: `${path}?afterTimestamp=7`,
      lastEventId: undefined,
    });
    await expect(start({ afterTimestamp: 0 })).resolves.toEqual({
      url: `${path}?afterTimestamp=0`,
      lastEventId: undefined,
    });
    await expect(start({ cursorStore: memoryStore(null).store })).resolves.toEqual({
      url: path,
      lastEventId: undefined,
    });
  });

  it('reconnects by id after a stream that started from a time', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('40'));
        res.end(event('41', {}));
      },
      (_req, res) => {
        startStream(res);
        res.write(ready('41'));
        res.write(event('42', {}));
      },
    ]);
    await take(client(s.url).subscribe('connect', { afterTimestamp: 5 }), 2);
    expect(s.requests[0]!.url).toContain('?afterTimestamp=5');
    expect(s.requests[1]!.url).toBe('/v1/projects/proj_1/topics/connect');
    expect(s.requests[1]!.headers['last-event-id']).toBe('41');
  });

  it('rejects invalid starting cursors', async () => {
    for (const afterTimestamp of [-1, 1.5, Number.NaN]) {
      expect(() => client('http://127.0.0.1:1').subscribe('connect', { afterTimestamp })).toThrow(/afterTimestamp/);
    }
    expect(() => client('http://127.0.0.1:1').subscribe('connect', { after: '1', afterTimestamp: 1 })).toThrow(
      /at most one/,
    );
    for (const stored of [{ eventId: 'abc' }, { timestamp: -5 }]) {
      const s = await server([answerReady]);
      const error = await failure(
        take(client(s.url).subscribe('connect', { cursorStore: memoryStore(stored).store }), 1),
      );
      expect(error.code).toBe('invalid_options');
      expect(s.requests).toHaveLength(0);
    }
  });

  it('saves the event being handled when the subscription closes during handling', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('10'));
        res.write(event('11', {}, 1_000));
        res.write(event('12', {}, 2_000));
      },
    ]);
    const { saved, store } = memoryStore();
    const shutdown = new AbortController();
    const seen: string[] = [];
    for await (const e of client(s.url).subscribe('connect', { cursorStore: store, signal: shutdown.signal })) {
      shutdown.abort();
      seen.push(e.id);
    }
    expect(seen).toEqual(['11']);
    expect(saved).toEqual([{ eventId: '11', timestamp: 1_000 }]);
  });

  it('ends with the store error when loading fails, and rejects ready', async () => {
    const s = await server([answerReady]);
    const subscription = client(s.url).subscribe('connect', {
      cursorStore: {
        load: async () => {
          throw new Error('store offline');
        },
        save: () => {},
      },
    });
    await expect(take(subscription, 1)).rejects.toThrow('store offline');
    await expect(subscription.ready).rejects.toThrow('store offline');
    expect(s.requests).toHaveLength(0);
  });

  it('ends with the store error when saving fails', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('10'));
        res.write(event('11', {}));
        res.write(event('12', {}));
      },
    ]);
    const store = {
      load: () => null,
      save: () => {
        throw new Error('disk full');
      },
    };
    const seen: string[] = [];
    const failed = (async () => {
      for await (const e of client(s.url).subscribe('connect', { cursorStore: store })) seen.push(e.id);
    })();
    await expect(failed).rejects.toThrow('disk full');
    expect(seen).toEqual(['11']);
  });
});

function answerReady(_req: IncomingMessage, res: ServerResponse) {
  startStream(res);
  res.write(ready('10'));
}

describe('EventsClient.subscribe gaps and planned closes', () => {
  it('reports a trimmed gap before the events after it', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('90'));
        res.write(`event: gap\ndata: ${JSON.stringify({ after: '5', resumedAfter: '90' })}\n\n`);
        res.write(event('91', {}));
      },
    ]);
    const order: string[] = [];
    const gaps: EventStreamGap[] = [];
    const subscription = client(s.url).subscribe('connect', {
      after: '5',
      onGap: async gap => {
        gaps.push(gap);
        order.push('gap');
      },
    });
    for (const e of await take(subscription, 1)) order.push(e.id);
    expect(gaps).toEqual([{ reason: 'trimmed', after: '5', resumedAfter: '90' }]);
    expect(order).toEqual(['gap', '91']);
  });

  it('keeps delivering past a gap when nobody listens for gaps', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('90'));
        res.write(`event: gap\ndata: ${JSON.stringify({ after: '5', resumedAfter: '90' })}\n\n`);
        res.write(event('91', {}));
      },
    ]);
    const events = await take(client(s.url).subscribe('connect', { after: '5' }), 1);
    expect(events.map(e => e.id)).toEqual(['91']);
  });

  it('resumes from just before the stored time when the stored id is rejected', async () => {
    const s = await server([
      badCursor,
      (_req, res) => {
        startStream(res);
        res.write(ready('50'));
        res.write(event('51', {}, 1_000));
      },
    ]);
    const { saved, store } = memoryStore({ eventId: '20', timestamp: 1_000 });
    const gaps: EventStreamGap[] = [];
    const events = await take(
      client(s.url).subscribe('connect', { cursorStore: store, onGap: gap => void gaps.push(gap) }),
      1,
    );
    expect(events.map(e => e.id)).toEqual(['51']);
    expect(s.requests[0]!.headers['last-event-id']).toBe('20');
    expect(s.requests[1]!.headers['last-event-id']).toBeUndefined();
    // One millisecond early, so events from the same millisecond are redelivered rather than skipped.
    expect(s.requests[1]!.url).toBe('/v1/projects/proj_1/topics/connect?afterTimestamp=999');
    expect(gaps).toEqual([{ reason: 'cursor_rejected', after: '20', resumedAfter: '50' }]);
    // The gap is resynced once onGap resolves, so a restart resumes from the new stream.
    expect(saved).toEqual([{ eventId: '50', timestamp: 1_000 }]);
  });

  it('falls back to the time of the last event processed this session', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('10'));
        res.end(event('11', {}, 4_000));
      },
      badCursor,
      (_req, res) => {
        startStream(res);
        res.write(ready('60'));
        res.write(event('61', {}));
      },
    ]);
    const gaps: EventStreamGap[] = [];
    const events = await take(client(s.url).subscribe('connect', { onGap: gap => void gaps.push(gap) }), 2);
    expect(events.map(e => e.id)).toEqual(['11', '61']);
    expect(s.requests[2]!.url).toContain('?afterTimestamp=3999');
    expect(gaps).toEqual([{ reason: 'cursor_rejected', after: '11', resumedAfter: '60' }]);
  });

  it('saves the resumed position once a trimmed gap is handled, and does not report it again', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('90'));
        res.end(`event: gap\ndata: ${JSON.stringify({ after: '5', resumedAfter: '90' })}\n\n`);
      },
      (_req, res) => {
        startStream(res);
        res.write(ready('90'));
        res.write(event('91', {}));
      },
    ]);
    const { saved, store } = memoryStore({ eventId: '5', timestamp: 100 });
    const gaps: EventStreamGap[] = [];
    const events = await take(
      client(s.url).subscribe('connect', { cursorStore: store, onGap: gap => void gaps.push(gap) }),
      1,
    );
    expect(events.map(e => e.id)).toEqual(['91']);
    expect(gaps).toHaveLength(1);
    expect(saved).toEqual([{ eventId: '90', timestamp: 100 }]);
    expect(s.requests[1]!.headers['last-event-id']).toBe('90');
  });

  it('saves a gap position without a time as just the id, and loads null fields as absent', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('90'));
        res.write(`event: gap\ndata: ${JSON.stringify({ after: '5', resumedAfter: '90' })}\n\n`);
        res.write(event('91', {}));
      },
    ]);
    const saves: unknown[] = [];
    await take(
      client(s.url).subscribe('connect', {
        cursorStore: {
          // As read back from a row with nullable columns.
          load: () => ({ eventId: '5', timestamp: null }) as unknown as EventCursor,
          save: cursor => void saves.push(cursor),
        },
        onGap: () => {},
      }),
      1,
    );
    expect(saves).toStrictEqual([{ eventId: '90' }]);
    expect(Object.keys(saves[0] as object)).toEqual(['eventId']);
    expect(s.requests[0]!.headers['last-event-id']).toBe('5');
  });

  it('falls back to a stored time when the stream it started is rejected before any event', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.end(ready('40'));
      },
      badCursor,
      (_req, res) => {
        startStream(res);
        res.write(ready('45'));
        res.write(event('46', {}));
      },
    ]);
    const gaps: EventStreamGap[] = [];
    const events = await take(
      client(s.url).subscribe('connect', {
        cursorStore: memoryStore({ timestamp: 2_000 }).store,
        onGap: gap => void gaps.push(gap),
      }),
      1,
    );
    expect(events.map(e => e.id)).toEqual(['46']);
    expect(s.requests[2]!.url).toContain('?afterTimestamp=1999');
    expect(gaps).toEqual([{ reason: 'cursor_rejected', after: '40', resumedAfter: '45' }]);
  });

  it('ends with invalid_cursor when the position it fell back to is rejected too', async () => {
    const s = await server([
      badCursor,
      (_req, res) => {
        startStream(res);
        res.end(ready('50'));
      },
      badCursor,
    ]);
    const error = await failure(
      take(
        client(s.url).subscribe('connect', {
          cursorStore: memoryStore({ eventId: '20', timestamp: 1_000 }).store,
          onGap: () => {},
        }),
        1,
      ),
    );
    expect(error.code).toBe('invalid_cursor');
    expect(s.requests).toHaveLength(3);
  });

  it('keeps resuming by time when a ready frame carries no id', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.end('event: ready\nretry: 1000\ndata: \n\n');
      },
      (_req, res) => {
        startStream(res);
        res.write(ready('40'));
        res.write(event('41', {}));
      },
    ]);
    await take(client(s.url).subscribe('connect', { afterTimestamp: 5 }), 1);
    expect(s.requests[1]!.url).toContain('?afterTimestamp=5');
  });

  it('ends with invalid_cursor when the rejected cursor has no time or no gap handler', async () => {
    const noTime = await server([badCursor]);
    const error = await failure(
      take(
        client(noTime.url).subscribe('connect', {
          cursorStore: memoryStore({ eventId: '20' }).store,
          onGap: () => {},
        }),
        1,
      ),
    );
    expect(error.code).toBe('invalid_cursor');

    const noHandler = await server([badCursor]);
    const unhandled = await failure(
      take(
        client(noHandler.url).subscribe('connect', { cursorStore: memoryStore({ eventId: '20', timestamp: 9 }).store }),
        1,
      ),
    );
    expect(unhandled.code).toBe('invalid_cursor');
    expect(noHandler.requests).toHaveLength(1);
  });

  it('ends with the gap handler error when it throws', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('90'));
        res.write(`event: gap\ndata: ${JSON.stringify({ after: '5', resumedAfter: '90' })}\n\n`);
        res.write(event('91', {}));
      },
    ]);
    const subscription = client(s.url).subscribe('connect', {
      after: '5',
      onGap: () => {
        throw new Error('resync failed');
      },
    });
    await expect(take(subscription, 1)).rejects.toThrow('resync failed');
  });

  it('ends with invalid_response on a malformed gap frame', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('90'));
        res.write('event: gap\ndata: {"after":5}\n\n');
      },
    ]);
    const error = await failure(take(client(s.url).subscribe('connect', { after: '5', onGap: () => {} }), 1));
    expect(error.code).toBe('invalid_response');
  });

  it('reconnects on a reconnect frame without waiting for the socket to close', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('10'));
        res.write(event('11', {}));
        // The socket stays open: the frame alone must end the stream.
        res.write('event: reconnect\ndata: \n\n');
      },
      (_req, res) => {
        startStream(res);
        res.write(ready('11'));
        res.write(event('12', {}));
      },
    ]);
    const events = await take(client(s.url, { idleTimeoutMs: 60_000 }).subscribe('connect'), 2);
    expect(events.map(e => e.id)).toEqual(['11', '12']);
    expect(s.requests[1]!.headers['last-event-id']).toBe('11');
  });
});

describe('EventsClient.connectEvents', () => {
  it('maps connect topic fields and parses the payload', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('10'));
        res.write(
          event('11', {
            connectionId: 'conn_1',
            integrationId: 'gitlab',
            eventType: 'merge_request.open',
            sourceEventId: 'delivery-1',
            payload: JSON.stringify({ object_kind: 'merge_request' }),
          }),
        );
        res.write(
          event('12', {
            connectionId: 'conn_2',
            integrationId: 'jira',
            eventType: 'jira:issue_created',
            payload: '{not json',
            unverified: 'true',
          }),
        );
      },
    ]);
    const subscription = client(s.url).connectEvents();
    const events = await take(subscription, 2);
    expect(s.requests[0]!.url).toBe('/v1/projects/proj_1/topics/connect');
    expect(events).toEqual([
      {
        id: '11',
        timestamp: 1_700_000_000_000,
        connectionId: 'conn_1',
        integrationId: 'gitlab',
        eventType: 'merge_request.open',
        sourceEventId: 'delivery-1',
        payload: { object_kind: 'merge_request' },
        unverified: false,
      },
      {
        id: '12',
        timestamp: 1_700_000_000_000,
        connectionId: 'conn_2',
        integrationId: 'jira',
        eventType: 'jira:issue_created',
        sourceEventId: null,
        payload: '{not json',
        payloadParseError: true,
        unverified: true,
      },
    ]);
  });
});

describe('ConnectClient.events', () => {
  it('shares the client credentials, project and events URL', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('10'));
        res.write(event('11', {}));
      },
    ]);
    const connect = new ConnectClient({ accessToken: 'tok_shared', projectId: 'proj_9', eventsUrl: s.url });
    expect(connect.events).toBe(connect.events);
    expect(connect.events.eventsUrl).toBe(s.url);
    await take(connect.events.subscribe('connect'), 1);
    expect(s.requests[0]!.url).toBe('/v1/projects/proj_9/topics/connect');
    expect(s.requests[0]!.headers.authorization).toBe('Bearer tok_shared');
  });

  it('does not apply the client timeout to the event stream', async () => {
    const s = await server([
      (_req, res) => {
        startStream(res);
        res.write(ready('10'));
        setTimeout(() => res.write(event('11', {})), 100);
      },
    ]);
    const connect = new ConnectClient({ accessToken: 'tok', projectId: 'proj_9', eventsUrl: s.url, timeoutMs: 20 });
    const events = await take(connect.events.subscribe('connect'), 1);
    expect(events.map(e => e.id)).toEqual(['11']);
    expect(s.requests).toHaveLength(1);
  });
});

describe('resolveEventsUrl', () => {
  it('prefers the option, then MASTRA_EVENTS_API_URL, then the region, then the default', () => {
    expect(resolveEventsUrl()).toBe('https://events.mastra.ai');

    vi.stubEnv('MASTRA_PLATFORM_REGION', 'eu');
    expect(resolveEventsUrl()).toBe('https://events.eu.mastra.ai');
    vi.stubEnv('MASTRA_PLATFORM_REGION', 'US');
    expect(resolveEventsUrl()).toBe('https://events.us.mastra.ai');
    vi.stubEnv('MASTRA_PLATFORM_REGION', 'mars');
    expect(resolveEventsUrl()).toBe('https://events.mastra.ai');

    vi.stubEnv('MASTRA_EVENTS_API_URL', 'https://events.staging.mastra.ai//');
    expect(resolveEventsUrl()).toBe('https://events.staging.mastra.ai');

    expect(resolveEventsUrl({ eventsUrl: 'http://localhost:4111/' })).toBe('http://localhost:4111');
  });
});

describe('parseServerSentEvents', () => {
  function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    });
  }

  async function parse(chunks: string[]) {
    const frames = [];
    for await (const frame of parseServerSentEvents(streamOf(chunks))) frames.push(frame);
    return frames;
  }

  it('handles comments, CR/LF/CRLF endings, multi-line data and an unterminated tail', async () => {
    const frames = await parse([
      ': ping\n\n',
      'event: ready\r\nid: 1\r\nretry: 250\r\ndata:\r\n\r\n',
      'data: line one\rdata: line two\r\r',
      'event: event\nid: 2\ndata:no-space\n\n',
      'event: event\ndata: never dispatched',
    ]);
    expect(frames).toEqual([
      { event: 'ready', id: '1', retry: 250, data: '' },
      { event: 'message', data: 'line one\nline two' },
      { event: 'event', id: '2', data: 'no-space' },
    ]);
  });

  it('parses input split into single characters, including a split CRLF', async () => {
    const text = 'event: event\r\nid: 7\r\ndata: {"a":1}\r\n\r\n';
    const frames = await parse(text.split(''));
    expect(frames).toEqual([{ event: 'event', id: '7', data: '{"a":1}' }]);
  });

  it('dispatches a retry-only block and keeps lines split across many chunks intact', async () => {
    const payload = 'x'.repeat(5_000);
    const frames = await parse(['retry: 2000\n\n', 'data: ', ...payload.match(/.{1,7}/g)!, '\n\n']);
    expect(frames).toEqual([
      { event: 'message', data: '', retry: 2000 },
      { event: 'message', data: payload },
    ]);
  });

  it('rejects a line longer than 32 MiB', async () => {
    const mebibyte = 'x'.repeat(1024 * 1024);
    const error = await failure(parse(['data: ', ...Array.from({ length: 33 }, () => mebibyte)]));
    expect(error.code).toBe('invalid_response');
  });
});
