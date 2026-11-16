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
  connectedAt?: string | null;
}

export interface FakeReply {
  status: number;
  body?: unknown;
  contentType?: string;
  headers?: Record<string, string>;
}

/** A row of a connection's platform event log, as `GET /v2/connections/:id/events` returns it. */
export interface FakeConnectionEvent {
  /** A Redis stream id, `<unix ms>-<sequence>`. */
  id: string;
  timestamp: number;
  integrationId: string;
  eventType: string;
  sourceEventId: string | null;
  payload: unknown;
  unverified?: boolean;
}

export interface FakePlatformRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  /** The JSON request body, when there was one. */
  body?: unknown;
  /** The end user the request was scoped to (`x-mastra-resource-id`), when it was. */
  resourceId?: string;
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
  /** Each connection's event log, oldest first. */
  readonly connectionEvents = new Map<string, FakeConnectionEvent[]>();
  /** Replies for the next event log reads of a connection, in place of the log. */
  readonly nextEventReplies = new Map<string, FakeReply[]>();
  proxy: (connectionId: string, path: string, query: URLSearchParams, body: unknown) => FakeReply = () => ({
    status: 200,
    body: {},
  });
  /** Routes a test adds, tried before the built-in ones; `undefined` falls through. */
  route: (method: string, path: string, body: unknown) => FakeReply | undefined = () => undefined;
  /** `GET /v2/connections/:id/context` bodies, by connection id. */
  readonly contexts = new Map<string, unknown>();
  /**
   * `GET /v2/connections/:id/credentials` bodies, by connection id. An
   * `accessToken` here is also what `POST .../github/installation-token` mints.
   */
  readonly credentials = new Map<string, unknown>();

  #url = '';

  get baseUrl(): string {
    return this.#url;
  }

  connect(): ConnectClient {
    return createPlatformConnectClient({
      baseUrl: this.#url,
      accessToken: 'platform-secret',
      projectId: this.projectId,
    });
  }

  count(method: string, path: string): number {
    return this.requests.filter(request => request.method === method && request.path === path).length;
  }

  async start(): Promise<this> {
    const server = createServer((req, res) => void this.#handle(req, res));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    this.#url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    onTestFinished(() => new Promise<void>(resolve => server.close(() => resolve())));
    return this;
  }

  async #handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const text = Buffer.concat(chunks).toString('utf8');
    const body: unknown = text ? parseBody(text) : undefined;
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', 'http://platform');
    const path = url.pathname;
    const resourceId = req.headers['x-mastra-resource-id'];
    this.requests.push({
      method,
      path,
      query: url.searchParams,
      ...(body === undefined ? {} : { body }),
      ...(typeof resourceId === 'string' ? { resourceId } : {}),
    });
    const reply = this.route(method, path, body) ?? this.#route(method, path, url.searchParams, body);
    res.statusCode = reply.status;
    for (const [name, value] of Object.entries(reply.headers ?? {})) res.setHeader(name, value);
    if (reply.body === undefined) {
      res.end();
      return;
    }
    res.setHeader('content-type', reply.contentType ?? 'application/json');
    res.end(JSON.stringify(reply.body));
  }

  #route(method: string, path: string, query: URLSearchParams, body: unknown): FakeReply {
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
    const events = /^\/v2\/connections\/([^/]+)\/events$/.exec(path);
    if (method === 'GET' && events) {
      const id = decodeURIComponent(events[1]!);
      const reply = this.nextEventReplies.get(id)?.shift();
      if (reply) return reply;
      const after = query.get('afterEventId') ?? '0-0';
      const limit = Number(query.get('limit') ?? 100);
      const page = (this.connectionEvents.get(id) ?? []).filter(e => compareStreamIds(e.id, after) > 0).slice(0, limit);
      return { status: 200, body: { events: page, nextCursor: page.at(-1)?.id ?? null } };
    }
    const context = /^\/v2\/connections\/([^/]+)\/context$/.exec(path);
    if (method === 'GET' && context) {
      const reply = this.contexts.get(decodeURIComponent(context[1]!));
      return reply === undefined ? problem(404, 'not_found', path) : { status: 200, body: reply };
    }
    const mint = /^\/v2\/connections\/([^/]+)\/github\/installation-token$/.exec(path);
    if (method === 'POST' && mint) {
      // A GitHub App connection's installation token is its credential's
      // token; a narrowed one names its repositories so tests can tell them apart.
      const credential = this.credentials.get(decodeURIComponent(mint[1]!)) as
        { accessToken?: string; expiresAt?: string } | undefined;
      if (!credential?.accessToken) return problem(404, 'not_found', path);
      const { repositories } = (body ?? {}) as { repositories?: string[] };
      return {
        status: 200,
        body: {
          token: repositories ? `${credential.accessToken}@${repositories.join(',')}` : credential.accessToken,
          expiresAt: credential.expiresAt ?? '2099-01-01T00:00:00.000Z',
          permissions: {},
          repositorySelection: repositories ? 'selected' : 'all',
        },
      };
    }
    const credentials = /^\/v2\/connections\/([^/]+)\/credentials$/.exec(path);
    if (method === 'GET' && credentials) {
      const reply = this.credentials.get(decodeURIComponent(credentials[1]!));
      return reply === undefined ? problem(404, 'not_found', path) : { status: 200, body: reply };
    }
    const proxy = /^\/v2\/connections\/([^/]+)\/proxy(\/.*)?$/.exec(path);
    if (proxy) return this.proxy(decodeURIComponent(proxy[1]!), proxy[2] ?? '/', query, body);
    return problem(404, 'not_found', `${method} ${path}`);
  }
}

function parseBody(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function compareStreamIds(a: string, b: string): number {
  const [aMs = 0, aSeq = 0] = a.split('-').map(Number);
  const [bMs = 0, bSeq = 0] = b.split('-').map(Number);
  return aMs - bMs || aSeq - bSeq;
}

export function startFakePlatform(): Promise<FakePlatform> {
  return new FakePlatform().start();
}
