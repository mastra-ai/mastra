import { EventEmitter } from 'node:events';

import { Context } from '@loopback/core';
import { RestBindings, RestApplication } from '@loopback/rest';
import type { RouteEntry } from '@loopback/rest';

export class FakeRequest extends EventEmitter {
  method = 'GET';
  path = '/v1/agents';
  originalUrl = '/v1/agents';
  url = '/v1/agents';
  secure = false;
  headers: Record<string, string | string[] | undefined> = {};
  query: Record<string, unknown> = {};
  params: Record<string, unknown> = {};
  body: unknown = undefined;
  readableEnded = true;

  constructor(overrides?: Partial<FakeRequest>) {
    super();
    Object.assign(this, overrides);
  }
}

export class FakeResponse extends EventEmitter {
  statusCode = 200;
  readonly headers = new Map<string, string | string[]>();
  readonly writes: Array<string | Buffer | Uint8Array> = [];
  jsonBody: unknown;
  sendBody: unknown;
  ended = false;
  flushed = false;
  writableEnded = false;
  writableFinished = false;

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  setHeader(key: string, value: string | string[]): this {
    this.headers.set(key.toLowerCase(), value);
    return this;
  }

  getHeader(key: string): string | string[] | undefined {
    return this.headers.get(key.toLowerCase());
  }

  json(value: unknown): this {
    this.jsonBody = value;
    this.setHeader('content-type', 'application/json');
    this.ended = true;
    this.writableEnded = true;
    this.writableFinished = true;
    this.emit('finish');
    return this;
  }

  send(value: unknown): this {
    this.sendBody = value;
    this.ended = true;
    this.writableEnded = true;
    this.writableFinished = true;
    this.emit('finish');
    return this;
  }

  write(value: string | Buffer | Uint8Array): boolean {
    this.writes.push(value);
    return true;
  }

  end(value?: string | Buffer | Uint8Array): this {
    if (value !== undefined) {
      this.writes.push(value);
    }
    this.ended = true;
    this.writableEnded = true;
    this.writableFinished = true;
    this.emit('finish');
    return this;
  }

  flushHeaders(): void {
    this.flushed = true;
  }
}

export function createFakeRequest(overrides?: Partial<FakeRequest>): FakeRequest {
  return new FakeRequest(overrides);
}

export function getWrittenText(response: FakeResponse): string {
  return response.writes
    .map(chunk => {
      if (typeof chunk === 'string') {
        return chunk;
      }
      if (Buffer.isBuffer(chunk)) {
        return chunk.toString('utf8');
      }
      return Buffer.from(chunk).toString('utf8');
    })
    .join('');
}

export function createAppWithCapture(): { app: RestApplication; routes: RouteEntry[] } {
  const app = new RestApplication();
  const routes: RouteEntry[] = [];
  const originalRoute = app.route.bind(app) as (...args: unknown[]) => unknown;
  app.route = ((...args: unknown[]) => {
    const route = args[0];
    if (args.length === 1 && isRouteEntry(route)) {
      routes.push(route);
      return originalRoute(route);
    }
    return originalRoute(...args);
  }) as typeof app.route;
  return { app, routes };
}

function isRouteEntry(value: unknown): value is RouteEntry {
  return typeof value === 'object' && value !== null && 'verb' in value && 'path' in value && 'invokeHandler' in value;
}

export async function invokeRoute(
  app: RestApplication,
  entry: RouteEntry,
  request: FakeRequest,
  response: FakeResponse,
): Promise<Context> {
  const requestContext = new Context(app);
  requestContext.bind(RestBindings.Http.REQUEST).to(request as never);
  requestContext.bind(RestBindings.Http.RESPONSE).to(response as never);
  await entry.invokeHandler(requestContext as never, []);
  return requestContext;
}
