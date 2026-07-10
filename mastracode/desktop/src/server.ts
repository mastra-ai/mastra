import { randomBytes, timingSafeEqual } from 'node:crypto';
import { dirname } from 'node:path';

import { serve } from '@hono/node-server';
import { mountAgentControllerOnMastra } from '@mastra/code-sdk';
import { MastraServer } from '@mastra/hono';
import { InMemoryTaskStore } from '@mastra/server/a2a/store';
import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { parse as parseCookie } from 'hono/utils/cookie';
import {
  MASTRACODE_DESKTOP_PROJECT_ACCESS_ERROR_CODE,
  MASTRACODE_DESKTOP_PROJECT_ACCESS_ERROR_MESSAGE,
} from 'mastracode-web/desktop-host';
import { assembleWebApiRoutes, resolveGithubReady } from 'mastracode-web/server-surface';

import { DESKTOP_HOST, findAvailablePort } from './ports.js';
import { ProjectAccessPolicy, projectPathMutation } from './project-access.js';
import { installStaticWebUi } from './static.js';
import { resolveWebUiDistPath } from './web-ui-path.js';

export interface DesktopServerHandle {
  bootstrapUrl: string;
  origin: string;
  port: number;
  approveProjectDirectory: (path: string) => Promise<string>;
  close: () => Promise<void>;
}

export interface DesktopServerOptions {
  projectAccessFile: string;
  onProgress?: (stage: string, details?: unknown) => Promise<void> | void;
}

const DESKTOP_AUTH_COOKIE_NAME = 'mastracode-desktop-session';
const DESKTOP_BOOTSTRAP_PATH = '/__mastracode_desktop_bootstrap';

function hasMatchingSessionToken(actual: string | undefined, expected: string): boolean {
  if (!actual) return false;
  const actualToken = Buffer.from(actual);
  const expectedToken = Buffer.from(expected);
  return actualToken.length === expectedToken.length && timingSafeEqual(actualToken, expectedToken);
}

export async function startDesktopServer(options: DesktopServerOptions): Promise<DesktopServerHandle> {
  const writeProgress = async (stage: string, details?: unknown) => {
    await options.onProgress?.(stage, details);
  };

  await writeProgress('desktop-server-finding-port');
  const port = await findAvailablePort(4111);
  const origin = `http://${DESKTOP_HOST}:${port}`;
  await writeProgress('desktop-server-port-selected', { origin });

  await writeProgress('desktop-server-resolving-github');
  const githubReady = await resolveGithubReady();
  await writeProgress('desktop-server-github-resolved', { githubReady });
  const desktopDataRoot = dirname(options.projectAccessFile);
  const projectAccess = await ProjectAccessPolicy.load(options.projectAccessFile, desktopDataRoot);

  await writeProgress('desktop-server-mounting-controller');
  const mounted = await mountAgentControllerOnMastra({
    controllerId: 'code',
    buildApiRoutes: ({ controller, authStorage }) =>
      assembleWebApiRoutes({
        controller,
        authStorage,
        fsRoot: desktopDataRoot,
        additionalProjectRoots: () => projectAccess.additionalRoots(),
        publicOrigin: origin,
        githubReady,
      }),
  });
  await writeProgress('desktop-server-controller-mounted');

  await writeProgress('desktop-server-building-hono');
  const app = new Hono();
  const bootstrapToken = randomBytes(32).toString('base64url');
  const sessionToken = randomBytes(32).toString('base64url');
  let bootstrapAvailable = true;
  const bootstrapUrl = new URL(DESKTOP_BOOTSTRAP_PATH, origin);
  bootstrapUrl.searchParams.set('token', bootstrapToken);

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

  const adapter = new MastraServer({
    app,
    mastra: mounted.mastra,
    taskStore: new InMemoryTaskStore(),
    customRouteAuthConfig,
    customApiRoutes: apiRoutes,
    prefix: '/api',
    mcpOptions: serverConfig?.mcpOptions,
  });
  await writeProgress('desktop-server-adapter-init-started');
  await adapter.init();
  await writeProgress('desktop-server-adapter-init-finished');

  installStaticWebUi(app, resolveWebUiDistPath());
  await writeProgress('desktop-server-static-ui-mounted');

  const nodeServer = serve({
    fetch: app.fetch,
    hostname: DESKTOP_HOST,
    port,
  });
  await writeProgress('desktop-server-listening', { origin });

  return {
    bootstrapUrl: bootstrapUrl.toString(),
    origin,
    port,
    approveProjectDirectory: path => projectAccess.approve(path),
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        nodeServer.close(error => {
          if (!error || (error as NodeJS.ErrnoException).code === 'ERR_SERVER_NOT_RUNNING') {
            resolve();
            return;
          }
          reject(error);
        });
      });
      await mounted.mastra.shutdown();
    },
  };
}
