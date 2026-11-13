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
    const proxy = /^\/v2\/connections\/([^/]+)\/proxy(\/.*)?$/.exec(path);
    if (proxy) return this.proxy(decodeURIComponent(proxy[1]!), proxy[2] ?? '/', query);
    return problem(404, 'not_found', `${method} ${path}`);
  }
}

export function startFakePlatform(): Promise<FakePlatform> {
  return new FakePlatform().start();
}
