import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConnectClient } from '../connect-client.js';
import { MastraConnectError } from '../errors.js';
import { EventsClient, parseServerSentEvents, resolveEventsUrl } from '../events.js';
import type { EventsClientOptions, TopicEvent } from '../events.js';

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
});
