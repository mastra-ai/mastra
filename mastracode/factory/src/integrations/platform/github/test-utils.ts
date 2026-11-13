import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { onTestFinished } from 'vitest';

export interface FakeGithubRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
  /** The bearer token the request carried. */
  token: string | undefined;
}

export interface FakeGithubReply {
  status: number;
  body?: unknown;
}

/**
 * A GitHub REST API on a real local port. `route` answers each request;
 * unanswered requests get 404. Every request is recorded with its token.
 */
export class FakeGithub {
  readonly requests: FakeGithubRequest[] = [];
  route: (request: FakeGithubRequest) => FakeGithubReply | undefined = () => undefined;
  #url = '';

  get baseUrl(): string {
    return this.#url;
  }

  /** Requests to `path` (and `method`, when given), oldest first. */
  calls(path: string, method?: string): FakeGithubRequest[] {
    return this.requests.filter(request => request.path === path && (!method || request.method === method));
  }

  async start(): Promise<void> {
    const server = createServer((req, res) => void this.#handle(req, res));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    this.#url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    onTestFinished(() => new Promise<void>(resolve => server.close(() => resolve())));
  }

  async #handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const raw = Buffer.concat(chunks).toString('utf8');
    const url = new URL(req.url ?? '/', this.#url);
    const authorization = req.headers.authorization;
    const request: FakeGithubRequest = {
      method: req.method ?? 'GET',
      path: url.pathname,
      query: url.searchParams,
      body: raw ? (JSON.parse(raw) as unknown) : undefined,
      token: authorization?.replace(/^(token|bearer) /i, ''),
    };
    this.requests.push(request);
    const reply = this.route(request) ?? { status: 404, body: { message: 'Not Found' } };
    res.writeHead(reply.status, { 'content-type': 'application/json' });
    res.end(reply.body === undefined ? undefined : JSON.stringify(reply.body));
  }
}

export async function startFakeGithub(): Promise<FakeGithub> {
  const github = new FakeGithub();
  await github.start();
  return github;
}
