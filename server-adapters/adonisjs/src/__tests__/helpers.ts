import { createServer, request as nodeRequest } from 'node:http';
import type { Server as NodeServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import BodyParserMiddleware from '@adonisjs/core/bodyparser_middleware';
import { AppFactory } from '@adonisjs/core/factories/app';
import { BodyParserMiddlewareFactory } from '@adonisjs/core/factories/bodyparser';
import { ServerFactory } from '@adonisjs/core/factories/http';
import type { Router, Server } from '@adonisjs/core/http';
import type { HttpRequest, HttpResponse } from '@mastra/server-adapters-test-suite';

export type AdonisApplication = ReturnType<AppFactory<any>['create']>;

let applicationPromise: Promise<AdonisApplication> | undefined;

/** One AdonisJS application per test file; each test gets its own HTTP server and router. */
export function getApplication(): Promise<AdonisApplication> {
  if (!applicationPromise) {
    applicationPromise = (async () => {
      const app = new AppFactory().create(new URL('./', import.meta.url));
      await app.init();
      // Like the Koa/Express suites, accept scalar JSON bodies (`json.strict: false` in config/bodyparser.ts)
      app.container.bind(BodyParserMiddleware, () =>
        new BodyParserMiddlewareFactory().merge({ json: { strict: false } } as any).create(),
      );
      return app;
    })();
  }
  return applicationPromise;
}

const servers = new WeakMap<Router, Server>();

export interface CreateAdonisServerOptions {
  /** Register the AdonisJS bodyparser middleware like a default AdonisJS app (default: true) */
  bodyParser?: boolean;
}

/**
 * Create a real AdonisJS HTTP server (`@adonisjs/http-server` Server + Router with the
 * bodyparser router middleware from `start/kernel.ts`). Returns the router, which is the
 * `app` given to MastraServer.
 */
export async function createAdonisRouter(options: CreateAdonisServerOptions = {}): Promise<Router> {
  return createAdonisRouterFor(await getApplication(), options);
}

/** Synchronous variant for suites whose `createApp` hook is synchronous. */
export function createAdonisRouterFor(
  app: AdonisApplication,
  { bodyParser = true }: CreateAdonisServerOptions = {},
): Router {
  const server = new ServerFactory().merge({ app }).create();
  const router = server.getRouter();
  if (bodyParser) {
    router.use([async () => ({ default: BodyParserMiddleware })]);
  }
  servers.set(router, server);
  return router;
}

/**
 * Boot the AdonisJS server (commits the router, as AdonisJS does after preload files run)
 * and listen on a random port.
 */
export async function listen(
  router: Router,
): Promise<{ url: string; port: number; server: NodeServer; close: () => Promise<void> }> {
  const adonisServer = servers.get(router);
  if (!adonisServer) throw new Error('Router was not created with createAdonisRouter()');
  await adonisServer.boot();

  const server = createServer((req, res) => adonisServer.handle(req, res));
  await new Promise<void>(resolve => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://localhost:${port}`,
    port,
    server,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close(err => (err ? reject(err) : resolve()));
      }),
  };
}

export function buildUrl(baseUrl: string, path: string, query?: HttpRequest['query']): string {
  let url = `${baseUrl}${path}`;
  if (query) {
    const queryParams = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => queryParams.append(key, String(v)));
      } else {
        queryParams.append(key, String(value));
      }
    });
    const queryString = queryParams.toString();
    if (queryString) url += `?${queryString}`;
  }
  return url;
}

export async function executeHttpRequest(router: Router, httpRequest: HttpRequest): Promise<HttpResponse> {
  const { url: baseUrl, close } = await listen(router);

  try {
    const fetchOptions: RequestInit = {
      method: httpRequest.method,
      headers: {
        ...(httpRequest.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(httpRequest.headers || {}),
      },
    };

    if (httpRequest.body !== undefined && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(httpRequest.method)) {
      fetchOptions.body = JSON.stringify(httpRequest.body);
    }

    const response = await fetch(buildUrl(baseUrl, httpRequest.path, httpRequest.query), fetchOptions);

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const contentType = response.headers.get('content-type') || '';
    const transferEncoding = response.headers.get('transfer-encoding') || '';
    const isStream =
      contentType.includes('text/plain') ||
      contentType.includes('text/event-stream') ||
      contentType.includes('audio/') ||
      contentType.includes('application/octet-stream') ||
      transferEncoding === 'chunked';

    if (isStream && response.body) {
      // Buffer the stream so the server can be closed once the request completes
      const body = new Uint8Array(await response.arrayBuffer());
      return {
        status: response.status,
        type: 'stream',
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue(body);
            controller.close();
          },
        }),
        headers,
      };
    }

    let data: unknown;
    if (contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        data = {};
      }
    } else {
      data = await response.text();
    }

    return { status: response.status, type: 'json', data, headers };
  } finally {
    await close();
  }
}

/**
 * Send a request through node:http so the transport behaviour is explicit. With
 * `chunked: true` the body is sent with Transfer-Encoding: chunked and no Content-Length.
 */
export function rawRequest(
  url: string,
  method: string,
  { headers = {}, body, chunked = false }: { headers?: Record<string, string>; body?: string; chunked?: boolean } = {},
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = nodeRequest(url, { method, headers }, res => {
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString() }));
      res.on('error', reject);
    });
    req.on('error', reject);
    if (body !== undefined) {
      if (chunked) {
        req.setHeader('transfer-encoding', 'chunked');
        for (let i = 0; i < body.length; i += 16) req.write(body.slice(i, i + 16));
      } else {
        req.setHeader('content-length', Buffer.byteLength(body));
        req.write(body);
      }
    }
    req.end();
  });
}
