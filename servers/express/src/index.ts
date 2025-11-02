import http from 'node:http';
import https from 'node:https';
import { Buffer } from 'node:buffer';
import type { Server } from 'node:http';
import type { Mastra } from '@mastra/core/mastra';
import { createHonoServer, getToolExports } from '@mastra/deployer/server';
import type { ServerBundleOptions } from '@mastra/deployer/server/types';
import express from 'express';
import type { Express as ExpressApp, NextFunction, Request as ExpressRequest, Response as ExpressResponse } from 'express';

type HonoApp = Awaited<ReturnType<typeof createHonoServer>>;

export type { ServerBundleOptions };
export { getToolExports };

export interface CreateExpressAppOptions extends Partial<Omit<ServerBundleOptions, 'tools'>> {
  tools?: ServerBundleOptions['tools'];
  /**
   * Optional existing Express application to mount Mastra routes onto.
   */
  app?: ExpressApp;
  /**
   * Path where the Mastra router should be mounted. Defaults to `/`.
   */
  mountPath?: string;
}

export interface StartExpressServerOptions extends CreateExpressAppOptions {
  /**
   * Optional port override. When not provided the Mastra server configuration is used.
   */
  port?: number;
  /**
   * Optional host override. When not provided the Mastra server configuration is used.
   */
  host?: string;
}

function toRequest(req: ExpressRequest): Request {
  const protocol = req.protocol ?? 'http';
  const host = req.get('host') ?? 'localhost';
  const url = `${protocol}://${host}${req.originalUrl ?? req.url}`;
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) {
        headers.append(key, v ?? '');
      }
    } else {
      headers.set(key, value);
    }
  }

  const controller = new AbortController();
  req.on('close', () => controller.abort());
  req.on('aborted', () => controller.abort());

  const init: RequestInit = {
    method: req.method,
    headers,
    signal: controller.signal,
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = req as any;
    // @ts-expect-error Node.js streams need the duplex hint when using undici Request
    init.duplex = 'half';
  }

  return new Request(url, init);
}

async function sendExpressResponse(req: ExpressRequest, res: ExpressResponse, response: Response) {
  res.status(response.status);

  const setCookie = (response.headers as any).getSetCookie?.();
  if (Array.isArray(setCookie) && setCookie.length > 0) {
    res.setHeader('set-cookie', setCookie);
  }

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') return;
    res.setHeader(key, value);
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  const body = response.body;
  if (!body) {
    const text = await response.text();
    if (text.length > 0) {
      res.send(text);
    } else {
      res.end();
    }
    return;
  }

  const reader = body.getReader();
  const abort = () => {
    void reader.cancel();
  };

  res.on('close', abort);
  res.on('error', abort);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        if (!res.headersSent) {
          res.flushHeaders?.();
        }
        res.write(Buffer.from(value));
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Ignore release errors if the reader is already released
    }
    res.end();
    res.off('close', abort);
    res.off('error', abort);
  }
}

function createHonoMiddleware(app: HonoApp) {
  return async function honoExpressMiddleware(req: ExpressRequest, res: ExpressResponse, next: NextFunction) {
    try {
      const request = toRequest(req);
      const response = await app.fetch(request);
      await sendExpressResponse(req, res, response);
    } catch (error) {
      next(error);
    }
  };
}

export async function createExpressApp(mastra: Mastra, options: CreateExpressAppOptions = {}): Promise<ExpressApp> {
  const honoApp = await createHonoServer(mastra, {
    tools: options.tools ?? {},
    playground: options.playground,
    isDev: options.isDev,
  });

  const app = options.app ?? express();
  const mountPath = options.mountPath ?? '/';

  app.use(mountPath, createHonoMiddleware(honoApp));

  return app;
}

export async function startExpressServer(
  mastra: Mastra,
  options: StartExpressServerOptions = {},
): Promise<Server> {
  const app = await createExpressApp(mastra, options);

  const serverOptions = mastra.getServer();
  const desiredHost = options.host ?? serverOptions?.host ?? 'localhost';
  const desiredPort = options.port ?? serverOptions?.port ?? Number(process.env.PORT) || 4111;

  const key =
    serverOptions?.https?.key ??
    (process.env.MASTRA_HTTPS_KEY ? Buffer.from(process.env.MASTRA_HTTPS_KEY, 'base64') : undefined);
  const cert =
    serverOptions?.https?.cert ??
    (process.env.MASTRA_HTTPS_CERT ? Buffer.from(process.env.MASTRA_HTTPS_CERT, 'base64') : undefined);
  const isHttpsEnabled = Boolean(key && cert);

  const server = isHttpsEnabled
    ? https.createServer({ key, cert }, app)
    : http.createServer(app);

  await new Promise<void>(resolve => {
    server.listen(desiredPort, desiredHost, resolve);
  });

  const logger = mastra.getLogger();
  const protocol = isHttpsEnabled ? 'https' : 'http';
  logger.info(` Mastra API running on port ${protocol}://${desiredHost}:${desiredPort}/api`);

  if (options.playground) {
    logger.info(`????? Playground available at ${protocol}://${desiredHost}:${desiredPort}`);
  }

  if (process.send) {
    process.send({
      type: 'server-ready',
      port: desiredPort,
      host: desiredHost,
    });
  }

  await mastra.startEventEngine();

  return server;
}
