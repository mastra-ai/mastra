import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { WorkspaceSandbox } from '@mastra/core/workspace';
import type { Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { peekSessionSandbox } from '../sandbox/session-sandbox.js';
import type { RouteAuth } from './route.js';

interface Session {
  id: string;
  orgId: string;
  userId: string;
  sandboxId: string | null;
}

interface PreviewSandbox extends WorkspaceSandbox {
  readonly sandboxId?: string;
  startPersistentProcess(command: string, cwd?: string): Promise<{ id: string; pid: number }>;
  getPersistentProcess(id: string): Promise<unknown>;
  stopPersistentProcess(id: string): Promise<void>;
  previewRequest(port: number, path: string): Promise<Response>;
}

interface Grant {
  sessionId: string;
  userId: string;
  orgId: string;
  sandboxId: string;
  port: number;
  expires: number;
}

const cookieName = 'mastra_preview_grant';
const cookiePath = '/';
const contentPath = '/web/preview/content';
const validPort = (port: number) => Number.isInteger(port) && port >= 1024 && port <= 65535 && port !== 47000;
const isPreviewSandbox = (sandbox: WorkspaceSandbox): sandbox is PreviewSandbox =>
  'startPersistentProcess' in sandbox && 'previewRequest' in sandbox && 'sandboxId' in sandbox;

function sign(secret: string, grant: Grant): string {
  const payload = Buffer.from(JSON.stringify(grant)).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update('mastra-sandbox-preview:').update(payload).digest('base64url')}`;
}

export function createSandboxPreviewUrl(origin: string, secret: string, grant: Grant): string {
  return `${origin}/web/preview/open?ticket=${sign(secret, grant)}`;
}

export function buildSandboxPreviewRoutes(options: {
  auth: RouteAuth;
  sessions: { getBySessionId(id: string): Promise<Session | null> };
  origin?: string;
  secret?: string;
}): ApiRoute[] {
  const { auth, sessions, secret } = options;
  const origin = options.origin ? new URL(options.origin).origin : undefined;
  // No shared signing key or separate host: never turn the app origin into a preview origin.
  const enabled = !!origin && !!secret && new URL(origin).protocol === 'https:';

  function verify(token: string | undefined): Grant | null {
    if (!enabled || !token) return null;
    const [payload, mac, extra] = token.split('.');
    if (!payload || !mac || extra) return null;
    const expected = createHmac('sha256', secret!).update('mastra-sandbox-preview:').update(payload).digest();
    let actual: Buffer;
    try {
      actual = Buffer.from(mac, 'base64url');
    } catch {
      return null;
    }
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    try {
      const grant = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Grant;
      return typeof grant.sessionId === 'string' &&
        typeof grant.userId === 'string' &&
        typeof grant.orgId === 'string' &&
        typeof grant.sandboxId === 'string' &&
        validPort(grant.port) &&
        Number.isFinite(grant.expires) &&
        grant.expires > Date.now()
        ? grant
        : null;
    } catch {
      return null;
    }
  }

  async function resolve(sessionId: string, sandboxId?: string) {
    const session = await sessions.getBySessionId(sessionId);
    if (!session?.sandboxId || (sandboxId && session.sandboxId !== sandboxId)) return null;
    const entry = peekSessionSandbox(sessionId);
    if (!entry || !isPreviewSandbox(entry.sandbox) || entry.sandbox.sandboxId !== session.sandboxId) return null;
    return { session, sandbox: entry.sandbox };
  }

  async function owner(c: Context, sessionId: string) {
    await auth.ensureUser(c);
    const tenant = auth.tenant(c);
    const resolved = await resolve(sessionId);
    if (!tenant?.userId || tenant.userId !== resolved?.session.userId || tenant.orgId !== resolved.session.orgId)
      return null;
    return resolved;
  }

  function previewHost(c: Context): boolean {
    return (
      enabled && (new URL(c.req.url).origin === origin || c.req.header('x-mastra-public-host') === new URL(origin).host)
    );
  }

  async function previewContent(c: Context, path: string): Promise<Response> {
    if (!previewHost(c)) return c.text('Not found', 404);
    const grant = verify(getCookie(c, cookieName));
    if (!grant) return c.text('Not found', 404);
    const resolved = await resolve(grant.sessionId, grant.sandboxId);
    if (!resolved || resolved.session.userId !== grant.userId || resolved.session.orgId !== grant.orgId)
      return c.text('Not found', 404);
    const upstream = await resolved.sandbox.previewRequest(grant.port, `${path}${new URL(c.req.url).search}`);
    const headers = new Headers();
    for (const name of ['content-type', 'cache-control', 'etag', 'last-modified']) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    const location = upstream.headers.get('location');
    if (location) {
      const target = new URL(location, `http://127.0.0.1:${grant.port}${path}`);
      headers.set(
        'location',
        target.hostname === '127.0.0.1' && target.port === String(grant.port)
          ? `${target.pathname}${target.search}${target.hash}`
          : location,
      );
    }
    headers.set(
      'Content-Security-Policy',
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src 'self'; form-action 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'",
    );
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'no-referrer');
    return new Response(upstream.body, { status: upstream.status, headers });
  }

  return [
    registerApiRoute('/web/sandbox/:sessionId/processes', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const resolved = await owner(c, c.req.param('sessionId'));
        if (!resolved) return c.json({ error: 'Not found' }, 404);
        const body = (await c.req.json().catch(() => null)) as { command?: unknown; cwd?: unknown } | null;
        if (
          typeof body?.command !== 'string' ||
          !body.command.trim() ||
          body.command.length > 65536 ||
          (body.cwd !== undefined && typeof body.cwd !== 'string')
        )
          return c.json({ error: 'Invalid command' }, 400);
        return c.json(await resolved.sandbox.startPersistentProcess(body.command, body.cwd as string | undefined), 201);
      },
    }),
    registerApiRoute('/web/sandbox/:sessionId/processes/:processId', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const resolved = await owner(c, c.req.param('sessionId'));
        if (!resolved) return c.json({ error: 'Not found' }, 404);
        return c.json(await resolved.sandbox.getPersistentProcess(c.req.param('processId')));
      },
    }),
    registerApiRoute('/web/sandbox/:sessionId/processes/:processId', {
      method: 'DELETE',
      requiresAuth: false,
      handler: async c => {
        const resolved = await owner(c, c.req.param('sessionId'));
        if (!resolved) return c.json({ error: 'Not found' }, 404);
        await resolved.sandbox.stopPersistentProcess(c.req.param('processId'));
        return c.json({ stopped: true });
      },
    }),
    registerApiRoute('/web/sandbox/:sessionId/preview/:port', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        if (!enabled || origin === new URL(c.req.url).origin) return c.json({ error: 'Preview unavailable' }, 503);
        const port = Number(c.req.param('port'));
        if (!validPort(port)) return c.json({ error: 'Invalid port' }, 400);
        const resolved = await owner(c, c.req.param('sessionId'));
        if (!resolved) return c.json({ error: 'Not found' }, 404);
        const url = createSandboxPreviewUrl(origin!, secret!, {
          sessionId: resolved.session.id,
          userId: resolved.session.userId,
          orgId: resolved.session.orgId,
          sandboxId: resolved.session.sandboxId!,
          port,
          expires: Date.now() + 60_000,
        });
        return c.json({ url });
      },
    }),
    registerApiRoute('/web/preview/open', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        if (!previewHost(c)) return c.text('Not found', 404);
        const grant = verify(c.req.query('ticket'));
        const resolved = grant && (await resolve(grant.sessionId, grant.sandboxId));
        if (!resolved || resolved.session.userId !== grant.userId || resolved.session.orgId !== grant.orgId)
          return c.text('Not found', 404);
        setCookie(c, cookieName, sign(secret!, { ...grant, expires: Date.now() + 30 * 60_000 }), {
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
          path: cookiePath,
          maxAge: 1800,
        });
        c.header('Cache-Control', 'no-store');
        return c.redirect(`${contentPath}/`);
      },
    }),
    registerApiRoute('/web/preview/content/*', {
      method: 'GET',
      requiresAuth: false,
      handler: c => previewContent(c, new URL(c.req.url).pathname.slice(contentPath.length) || '/'),
    }),
    registerApiRoute('/*', {
      method: 'GET',
      requiresAuth: false,
      handler: c => previewContent(c, new URL(c.req.url).pathname),
    }),
  ];
}
