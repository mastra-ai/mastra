import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSandboxPreviewRoutes } from './sandbox-preview.js';

const mocks = vi.hoisted(() => ({ peek: vi.fn() }));
vi.mock('../sandbox/session-sandbox.js', () => ({ peekSessionSandbox: mocks.peek }));

const sandbox = {
  sandboxId: 'sandbox-1',
  startPersistentProcess: vi.fn().mockResolvedValue({ id: 'process-1', pid: 42 }),
  getPersistentProcess: vi.fn().mockResolvedValue({ id: 'process-1', running: true }),
  stopPersistentProcess: vi.fn().mockResolvedValue(undefined),
  previewRequest: vi.fn().mockResolvedValue(new Response('<h1>ok</h1>', { headers: { 'content-type': 'text/html' } })),
};
const session = { id: 'session-1', orgId: 'org-1', userId: 'user-1', sandboxId: 'sandbox-1' };
const tenant = { orgId: 'org-1', userId: 'user-1' };
const origin = 'https://preview.example.test';
const app = new Hono();
for (const route of buildSandboxPreviewRoutes({
  auth: {
    enabled: () => true,
    ensureUser: async () => {},
    tenant: () => tenant,
    isOrganizationAdmin: async () => false,
  },
  sessions: { getBySessionId: async () => session },
  origin,
  secret: 'test-signing-key',
})) {
  if (!('handler' in route)) continue;
  app.on(route.method, route.path, c => route.handler(c as never, async () => {}));
}

beforeEach(() => {
  mocks.peek.mockReturnValue({ sandbox });
  tenant.userId = 'user-1';
  session.sandboxId = 'sandbox-1';
  sandbox.previewRequest.mockClear();
});

describe('sandbox preview authorization', () => {
  it('allows only the owner to start a persistent process', async () => {
    const start = () =>
      app.request('http://app.example.test/web/sandbox/session-1/processes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command: 'npm run dev' }),
      });
    expect((await start()).status).toBe(201);
    tenant.userId = 'other-user';
    expect((await start()).status).toBe(404);
  });

  it('requires an owner-minted ticket, correct host, cookie and live sandbox id', async () => {
    const issued = await app.request('http://app.example.test/web/sandbox/session-1/preview/3000');
    expect(issued.status).toBe(200);
    const { url } = (await issued.json()) as { url: string };
    expect(url.startsWith(`${origin}/web/preview/open?ticket=`)).toBe(true);
    expect((await app.request(url.replace(origin, 'http://app.example.test'))).status).toBe(404);
    const opened = await app.request(url.replace(origin, 'http://internal.railway'), {
      headers: { 'x-mastra-public-host': 'preview.example.test' },
    });
    expect(opened.status).toBe(302);
    const cookie = opened.headers.get('set-cookie')!;
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    const content = await app.request(`${origin}/web/preview/content/styles.css?v=1`, {
      headers: { cookie },
    });
    expect(content.status).toBe(200);
    expect(sandbox.previewRequest).toHaveBeenCalledWith(3000, '/styles.css?v=1');
    const absoluteAsset = await app.request(`${origin}/assets/app.js`, { headers: { cookie } });
    expect(absoluteAsset.status).toBe(200);
    expect(sandbox.previewRequest).toHaveBeenCalledWith(3000, '/assets/app.js');
    session.sandboxId = 'sandbox-2';
    expect((await app.request(`${origin}/web/preview/content/`, { headers: { cookie } })).status).toBe(404);
    expect(sandbox.previewRequest).toHaveBeenCalledTimes(2);
  });

  it('rejects forbidden ports and requests without a grant', async () => {
    expect((await app.request('http://app.example.test/web/sandbox/session-1/preview/47000')).status).toBe(400);
    expect((await app.request(`${origin}/web/preview/content/`)).status).toBe(404);
  });
});
