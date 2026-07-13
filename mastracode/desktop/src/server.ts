import { randomBytes, timingSafeEqual } from 'node:crypto';
import { once } from 'node:events';
import { dirname } from 'node:path';

import { serve } from '@hono/node-server';
import {
  MASTRACODE_DESKTOP_PROJECT_ACCESS_ERROR_CODE,
  MASTRACODE_DESKTOP_PROJECT_ACCESS_ERROR_MESSAGE,
} from '@mastra/code-app/desktop-host';
import { mountAgentControllerOnMastra } from '@mastra/code-sdk';
import { MastraServer } from '@mastra/hono';
import { InMemoryTaskStore } from '@mastra/server/a2a/store';
import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import { parse as parseCookie } from 'hono/utils/cookie';
import { assembleCoreWebApiRoutes } from 'mastracode-web/server-surface';

import { ProjectAccessPolicy, projectPathMutation } from './project-access.js';
import { resolveRendererDistPath } from './renderer-path.js';
import type { DesktopServerHandle, DesktopServerOptions } from './server-types.js';
import { installSecurityHeaders, installStaticRenderer } from './static.js';

const DESKTOP_HOST = '127.0.0.1';
const DESKTOP_PORTS = [41731, 41732, 41733, 41734, 41735];
const DESKTOP_AUTH_COOKIE_NAME = 'mastracode-desktop-session';
const DESKTOP_BOOTSTRAP_PATH = '/__mastracode_desktop_bootstrap';

function hasMatchingSessionToken(actual: string | undefined, expected: string): boolean {
  if (!actual) return false;
  const actualToken = Buffer.from(actual);
  const expectedToken = Buffer.from(expected);
  return actualToken.length === expectedToken.length && timingSafeEqual(actualToken, expectedToken);
}

interface ConnectionClosableServer {
  closeAllConnections: () => void;
}

function canCloseAllConnections(server: object): server is ConnectionClosableServer {
  return 'closeAllConnections' in server && typeof server.closeAllConnections === 'function';
}

function closeAllConnections(server: object): void {
  if (canCloseAllConnections(server)) {
    server.closeAllConnections();
  }
}

function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}

async function listen(app: Hono): Promise<ReturnType<typeof serve>> {
  for (const port of DESKTOP_PORTS) {
    const server = serve({ fetch: app.fetch, hostname: DESKTOP_HOST, port });
    try {
      await once(server, 'listening');
      return server;
    } catch (error) {
      closeAllConnections(server);
      if (!hasErrorCode(error, 'EADDRINUSE')) throw error;
    }
  }
  throw new Error(`MastraCode could not bind a local port in the range ${DESKTOP_PORTS.join('-')}`);
}

export async function startDesktopServer(options: DesktopServerOptions): Promise<DesktopServerHandle> {
  const desktopDataRoot = dirname(options.projectAccessFile);
  const projectAccess = await ProjectAccessPolicy.load(options.projectAccessFile, desktopDataRoot);

  const mounted = await mountAgentControllerOnMastra({
    controllerId: 'code',
    buildApiRoutes: ({ controller, authStorage }) =>
      assembleCoreWebApiRoutes({
        controller,
        authStorage,
        fsRoot: desktopDataRoot,
        additionalProjectRoots: () => projectAccess.additionalRoots(),
      }),
  });

  const app = new Hono();
  app.onError((error, c) => {
    if (error instanceof HTTPException) return c.json({ error: error.message }, error.status);
    console.error(`[MastraCode Desktop] ${c.req.method} ${c.req.path} failed:`, error);
    return c.json({ error: 'internal_error', message: error.message }, 500);
  });
  installSecurityHeaders(app);
  const bootstrapToken = randomBytes(32).toString('base64url');
  const sessionToken = randomBytes(32).toString('base64url');
  let bootstrapAvailable = true;

  app.get(DESKTOP_BOOTSTRAP_PATH, c => {
    if (!bootstrapAvailable || !hasMatchingSessionToken(c.req.query('token'), bootstrapToken)) {
      return c.text('Unauthorized', 401);
    }
    bootstrapAvailable = false;
    setCookie(c, DESKTOP_AUTH_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      path: '/',
      sameSite: 'Strict',
    });
    return c.redirect('/', 302);
  });
  app.use('*', async (c, next) => {
    const cookie = parseCookie(c.req.header('cookie') ?? '', DESKTOP_AUTH_COOKIE_NAME);
    if (!hasMatchingSessionToken(cookie[DESKTOP_AUTH_COOKIE_NAME], sessionToken)) {
      return c.text('Unauthorized', 401);
    }
    await next();
  });
  app.use('*', async (c, next) => {
    if (c.req.method !== 'POST' && c.req.method !== 'PUT') return next();
    const body: unknown = await c.req.raw
      .clone()
      .json()
      .catch(() => undefined);
    const requestedPath = projectPathMutation(c.req.method, new URL(c.req.url).pathname, body);
    if (requestedPath === undefined) return next();
    if (typeof requestedPath !== 'string' || !(await projectAccess.isAllowed(requestedPath))) {
      return c.json(
        {
          code: MASTRACODE_DESKTOP_PROJECT_ACCESS_ERROR_CODE,
          error: MASTRACODE_DESKTOP_PROJECT_ACCESS_ERROR_MESSAGE,
        },
        403,
      );
    }
    await next();
  });

  const serverConfig = mounted.mastra.getServer();
  const apiRoutes = serverConfig?.apiRoutes ?? [];
  const customRouteAuthConfig = new Map<string, boolean>();
  for (const route of apiRoutes) {
    customRouteAuthConfig.set(`${route.method}:${route.path}`, route.requiresAuth !== false);
  }

  let nodeServer: ReturnType<typeof serve> | undefined;
  try {
    const adapter = new MastraServer({
      app,
      mastra: mounted.mastra,
      taskStore: new InMemoryTaskStore(),
      customRouteAuthConfig,
      customApiRoutes: apiRoutes,
      prefix: '/api',
      mcpOptions: serverConfig?.mcpOptions,
    });
    await adapter.init();

    installStaticRenderer(app, resolveRendererDistPath());

    nodeServer = await listen(app);
  } catch (error) {
    if (nodeServer) closeAllConnections(nodeServer);
    await mounted.mastra.shutdown();
    throw error;
  }

  const address = nodeServer.address();
  if (!address || typeof address === 'string') {
    closeAllConnections(nodeServer);
    await mounted.mastra.shutdown();
    throw new Error('MastraCode desktop server did not bind a TCP port');
  }

  const port = address.port;
  const origin = `http://${DESKTOP_HOST}:${port}`;
  const bootstrapUrl = new URL(DESKTOP_BOOTSTRAP_PATH, origin);
  bootstrapUrl.searchParams.set('token', bootstrapToken);
  let closePromise: Promise<void> | undefined;
  const close = () => {
    closePromise ??= (async () => {
      closeAllConnections(nodeServer);
      try {
        if (nodeServer.listening) {
          await new Promise<void>((resolve, reject) => {
            nodeServer.close(error => {
              if (error) reject(error);
              else resolve();
            });
          });
        }
      } finally {
        await mounted.mastra.shutdown();
      }
    })();
    return closePromise;
  };

  return {
    bootstrapUrl: bootstrapUrl.toString(),
    origin,
    port,
    approveProjectDirectory: path => projectAccess.approve(path),
    close,
  };
}
