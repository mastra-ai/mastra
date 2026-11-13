import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { ConnectClient } from '@mastra/connect';
import { onTestFinished } from 'vitest';

import { createPlatformConnectClient } from '../platform-connect.js';

export interface FakeConnection {
  id: string;
  integrationId: string;
  status: string;
  accountLabel?: string | null;
  resourceId?: string | null;
}

export interface FakeReply {
  status: number;
  body?: unknown;
  contentType?: string;
}

export interface FakePlatformRequest {
  method: string;
  path: string;
}

/** A subscription the fake events service received. */
export interface FakeStreamRequest {
  topic: string;
  lastEventId: string | undefined;
  afterTimestamp?: number;
}

interface FakeTopicEvent {
  id: string;
  timestamp: number;
  fields: Record<string, string>;
}

/** A platform problem response (`application/problem+json`), as the platform itself answers. */
export function problem(status: number, type: string, detail = type): FakeReply {
  return { status, body: { type, title: type, status, detail }, contentType: 'application/problem+json' };
}

/**
 * A Mastra Platform integrations API on a real local port: org connections,
 * project links, connect sessions and the connection proxy. State is plain
 * fields so tests can arrange and inspect it.
 */
export class FakePlatform {
  readonly projectId = 'proj_factory';
  orgConnections: FakeConnection[] = [];
  readonly linked = new Set<string>();
  /** Replies for linking a connection, in place of 204. */
  readonly linkReplies = new Map<string, FakeReply>();
  /** Replies for the next link attempts of a connection, used before `linkReplies`. */
  readonly nextLinkReplies = new Map<string, FakeReply[]>();
  /** Replies for the next project listings, in place of the listing. */
  readonly nextListingReplies: FakeReply[] = [];
  readonly requests: FakePlatformRequest[] = [];
  proxy: (connectionId: string, path: string, query: URLSearchParams) => FakeReply = () => ({ status: 200, body: {} });
  /** `GET /v2/connections/:id/context` bodies, by connection id. */
  readonly contexts = new Map<string, unknown>();
  /** Events published per topic, oldest first. */
  readonly topics = new Map<string, FakeTopicEvent[]>();
  /** Cursors the events service answers with 400, as it does for a cursor outside the stream. */
  readonly rejectedCursors = new Set<string>();
  /** Cursors whose following events are trimmed: the stream resumes at the tail after a `gap` frame. */
  readonly trimmedCursors = new Set<string>();
  readonly streamRequests: FakeStreamRequest[] = [];

  #url = '';
  #lastEventId = 1_000;
  readonly #streams = new Set<{ topic: string; res: ServerResponse }>();

  get baseUrl(): string {
    return this.#url;
  }

  connect(): ConnectClient {
    return createPlatformConnectClient({
      baseUrl: this.#url,
      eventsUrl: this.#url,
      accessToken: 'platform-secret',
      projectId: this.projectId,
    });
  }

  /** Appends an event to a topic and sends it to every open stream on that topic. Returns its id. */
  publish(topic: string, fields: Record<string, string>, timestamp = Date.now()): string {
    const event = { id: String(++this.#lastEventId), timestamp, fields };
    const log = this.topics.get(topic) ?? [];
    log.push(event);
    this.topics.set(topic, log);
    for (const stream of this.#streams) {
      if (stream.topic === topic) stream.res.write(sseEvent(event));
    }
    return event.id;
  }

  /** Publishes a `connect`-topic event the way the platform's fan-out does. */
  publishConnect(event: {
    connectionId: string;
    integrationId: string;
    eventType: string;
    payload: unknown;
    sourceEventId?: string;
    unverified?: boolean;
  }): string {
    return this.publish('connect', {
      connectionId: event.connectionId,
      integrationId: event.integrationId,
      eventType: event.eventType,
      payload: JSON.stringify(event.payload),
      ...(event.sourceEventId ? { sourceEventId: event.sourceEventId } : {}),
      ...(event.unverified ? { unverified: 'true' } : {}),
    });
  }

  /** Drops every open event stream, as a server restart would. */
  dropStreams(): void {
    for (const stream of this.#streams) stream.res.destroy();
    this.#streams.clear();
  }

  get openStreams(): number {
    return this.#streams.size;
  }

  count(method: string, path: string): number {
    return this.requests.filter(request => request.method === method && request.path === path).length;
  }

  async start(): Promise<this> {
    const server = createServer((req, res) => void this.#handle(req, res));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    this.#url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    onTestFinished(() => {
      this.dropStreams();
      return new Promise<void>(resolve => server.close(() => resolve()));
    });
    return this;
  }

  async #handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const topic = new RegExp(`^/v1/projects/${this.projectId}/topics/([^/?]+)`).exec(req.url ?? '');
    if (req.method === 'GET' && topic) {
      this.#stream(decodeURIComponent(topic[1]!), req, res);
      return;
    }
    for await (const _chunk of req) {
      // Drain the body; the fake answers from its state alone.
    }
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', 'http://platform');
    const path = url.pathname;
    this.requests.push({ method, path });
    const reply = this.#route(method, path, url.searchParams);
    res.statusCode = reply.status;
    if (reply.body === undefined) {
      res.end();
      return;
    }
    res.setHeader('content-type', reply.contentType ?? 'application/json');
    res.end(JSON.stringify(reply.body));
  }

  #stream(topic: string, req: IncomingMessage, res: ServerResponse): void {
    const header = req.headers['last-event-id'];
    const lastEventId = typeof header === 'string' ? header : undefined;
    const timeParam = new URL(req.url ?? '/', 'http://fake').searchParams.get('afterTimestamp');
    const afterTimestamp = lastEventId === undefined && timeParam !== null ? Number(timeParam) : undefined;
    this.streamRequests.push({ topic, lastEventId, ...(afterTimestamp !== undefined ? { afterTimestamp } : {}) });
    if (lastEventId !== undefined && this.rejectedCursors.has(lastEventId)) {
      res.writeHead(400, { 'content-type': 'application/problem+json' });
      res.end(JSON.stringify({ type: 'invalid_cursor', title: 'invalid_cursor', status: 400 }));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' });
    const log = this.topics.get(topic) ?? [];
    const trimmed = lastEventId !== undefined && this.trimmedCursors.has(lastEventId);
    // Like the events service: a time start begins after the last event at or before that time.
    const start =
      afterTimestamp !== undefined
        ? (log.filter(event => event.timestamp <= afterTimestamp).at(-1)?.id ?? '0')
        : trimmed || lastEventId === undefined
          ? String(this.#lastEventId)
          : lastEventId;
    res.write(`event: ready\nid: ${start}\nretry: 1000\ndata: \n\n`);
    if (trimmed) res.write(`event: gap\ndata: ${JSON.stringify({ after: lastEventId, resumedAfter: start })}\n\n`);
    for (const event of log) {
      if (BigInt(event.id) > BigInt(start)) res.write(sseEvent(event));
    }
    const stream = { topic, res };
    this.#streams.add(stream);
    res.on('close', () => this.#streams.delete(stream));
  }

  #route(method: string, path: string, query: URLSearchParams): FakeReply {
    const project = `/v2/projects/${this.projectId}`;
    if (method === 'GET' && path === '/v2/connections') {
      return { status: 200, body: { connections: this.orgConnections } };
    }
    if (method === 'GET' && path === `${project}/connections`) {
      const reply = this.nextListingReplies.shift();
      if (reply) return reply;
      return { status: 200, body: { connections: this.orgConnections.filter(c => this.linked.has(c.id)) } };
    }
    const link = new RegExp(`^${project}/connections/([^/]+)$`).exec(path);
    if (method === 'POST' && link) {
      const id = decodeURIComponent(link[1]!);
      const reply = this.nextLinkReplies.get(id)?.shift() ?? this.linkReplies.get(id);
      if (reply) return reply;
      if (!this.orgConnections.some(c => c.id === id)) return problem(404, 'not_found');
      this.linked.add(id);
      return { status: 204 };
    }
    const session = new RegExp(`^${project}/integrations/([^/]+)/connect-sessions$`).exec(path);
    if (method === 'POST' && session) {
      return {
        status: 201,
        body: {
          connectionId: 'conn-new',
          integrationId: decodeURIComponent(session[1]!),
          connectUrl: 'https://connect.example/session',
          sessionToken: 'session-token',
          expiresAt: '2026-11-13T13:00:00.000Z',
        },
      };
    }
    const context = /^\/v2\/connections\/([^/]+)\/context$/.exec(path);
    if (method === 'GET' && context) {
      const body = this.contexts.get(decodeURIComponent(context[1]!));
      return body === undefined ? problem(404, 'not_found', path) : { status: 200, body };
    }
    const proxy = /^\/v2\/connections\/([^/]+)\/proxy(\/.*)?$/.exec(path);
    if (proxy) return this.proxy(decodeURIComponent(proxy[1]!), proxy[2] ?? '/', query);
    return problem(404, 'not_found', `${method} ${path}`);
  }
}

function sseEvent(event: FakeTopicEvent): string {
  return `event: event\nid: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`;
}

export function startFakePlatform(): Promise<FakePlatform> {
  return new FakePlatform().start();
}
