import { Readable } from 'node:stream';
import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute } from '@mastra/core/server';
import { findMatchingCustomRoute } from '@mastra/server/auth';
import { Inject, Injectable } from '@nestjs/common';
import type { Request, Response as ExpressResponse } from 'express';
import { Hono } from 'hono';

import { MASTRA, MASTRA_OPTIONS } from '../constants';
import type { MastraModuleOptions } from '../mastra.module';

const NOT_FOUND_HEADER = 'x-mastra-custom-route-not-found';

type HonoApiRoute = Exclude<ApiRoute, { readonly _mastraSchemaRoute: true }>;

type CustomRouteFetch = (request: globalThis.Request, requestContext: RequestContext) => Promise<globalThis.Response>;

/**
 * Serves custom routes registered with `registerApiRoute()` via `server.apiRoutes`,
 * matching the behavior of the other Mastra server adapters.
 */
@Injectable()
export class CustomRouteService {
  private readonly routes: HonoApiRoute[];
  private readonly authConfig: Map<string, boolean>;
  private fetchPromise?: Promise<CustomRouteFetch>;

  constructor(
    @Inject(MASTRA) private readonly mastra: Mastra,
    @Inject(MASTRA_OPTIONS) options: MastraModuleOptions,
  ) {
    this.routes = (mastra.getServer()?.apiRoutes ?? []).filter(
      (route): route is HonoApiRoute => !('_mastraSchemaRoute' in route && route._mastraSchemaRoute === true),
    );
    this.authConfig = new Map(options.customRouteAuthConfig);
    for (const route of this.routes) {
      const key = `${route.method}:${route.path}`;
      if (!this.authConfig.has(key)) {
        this.authConfig.set(key, route.requiresAuth !== false);
      }
    }
  }

  /** Auth config for custom routes, keyed by `METHOD:path`. */
  get customRouteAuthConfig(): Map<string, boolean> {
    return this.authConfig;
  }

  match(method: string, path: string): ApiRoute | undefined {
    return findMatchingCustomRoute(path, method, this.routes)?.route;
  }

  /**
   * Runs a matched custom route and writes its response.
   * Returns false if no custom route handled the request.
   */
  async handle(req: Request, res: ExpressResponse, requestContext: RequestContext): Promise<boolean> {
    if (this.routes.length === 0) return false;

    const fetch = await (this.fetchPromise ??= this.build());
    const response = await fetch(this.toFetchRequest(req), requestContext);
    if (response.headers.get(NOT_FOUND_HEADER) === 'true') return false;

    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') return;
      res.setHeader(key, value);
    });
    for (const cookie of response.headers.getSetCookie()) {
      res.append('set-cookie', cookie);
    }

    if (!response.body) {
      res.end();
      return true;
    }

    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } finally {
      res.end();
    }
    return true;
  }

  private async build(): Promise<CustomRouteFetch> {
    const mastra = this.mastra;
    const app = new Hono<{
      Bindings: { requestContext?: RequestContext };
      Variables: { mastra: Mastra; requestContext: RequestContext };
    }>();

    app.use('*', async (c, next) => {
      c.set('mastra', mastra);
      c.set('requestContext', c.env?.requestContext ?? new RequestContext());
      await next();
    });

    const serverOnError = mastra.getServer()?.onError;
    app.onError((err, c) => {
      if (serverOnError) {
        return serverOnError(err, c as unknown as Parameters<typeof serverOnError>[1]);
      }
      mastra.getLogger()?.error(`Custom route handler failed: ${c.req.method} ${c.req.path}`, {
        error: err instanceof Error ? (err.stack ?? err.message) : String(err),
      });
      return c.json({ error: 'Internal Server Error' }, 500);
    });

    for (const route of this.routes) {
      const handler =
        'handler' in route && route.handler
          ? route.handler
          : 'createHandler' in route
            ? await route.createHandler({ mastra })
            : undefined;
      if (!handler) continue;

      const middlewares = route.middleware
        ? Array.isArray(route.middleware)
          ? route.middleware
          : [route.middleware]
        : [];
      const handlers: any[] = [...middlewares, handler];
      if (route.method === 'ALL') {
        app.all(route.path, handlers[0], ...handlers.slice(1));
      } else {
        app.on(route.method, route.path, handlers[0], ...handlers.slice(1));
      }
    }

    app.notFound(() => new Response(null, { status: 404, headers: { [NOT_FOUND_HEADER]: 'true' } }));

    return (request, requestContext) => Promise.resolve(app.fetch(request, { requestContext }));
  }

  private toFetchRequest(req: Request): globalThis.Request {
    const url = `${req.protocol || 'http'}://${req.get('host') || 'localhost'}${req.originalUrl || req.url}`;
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers.set(key, value);
      else if (Array.isArray(value)) value.forEach(v => headers.append(key, v));
    }

    const init: RequestInit & { duplex?: 'half' } = { method: req.method, headers };
    if (['GET', 'HEAD'].includes(req.method)) return new globalThis.Request(url, init);

    const body: unknown = req.body;
    const bodyParsed = (req as Request & { _body?: boolean })._body === true;
    if (!bodyParsed && body === undefined && req.readable) {
      // Body not consumed by a parser (multipart, text, binary, ...): stream the raw bytes through.
      init.body = Readable.toWeb(req) as ReadableStream<Uint8Array>;
      init.duplex = 'half';
    } else if (typeof body === 'string' || body instanceof Uint8Array) {
      init.body = body as RequestInit['body'];
    } else if (typeof body === 'object' && body !== null) {
      const contentType = headers.get('content-type') ?? '';
      if (contentType.includes('application/x-www-form-urlencoded')) {
        init.body = new URLSearchParams(body as Record<string, string>).toString();
      } else {
        init.body = JSON.stringify(body);
        if (!contentType) headers.set('content-type', 'application/json');
      }
      headers.delete('content-length');
    }
    return new globalThis.Request(url, init);
  }
}
