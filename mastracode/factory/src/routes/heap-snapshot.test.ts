import { Readable } from 'node:stream';

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HeapSnapshotRoutes } from './heap-snapshot.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

const SNAPSHOT_HEADER = '{"snapshot":';

function fakeSnapshotStream(): NodeJS.ReadableStream {
  return Readable.from(Buffer.from(`${SNAPSHOT_HEADER}{"meta":{}}`));
}

interface BuildAppOptions {
  enabled?: boolean;
  isOrganizationAdmin?: (orgId: string, userId: string) => Promise<boolean>;
  user?: { workosId: string; organizationId?: string } | null;
  getHeapSnapshot?: () => NodeJS.ReadableStream;
}

function buildApp(options: BuildAppOptions = {}) {
  const user = options.user === undefined ? { workosId: 'u1', organizationId: 'org1' } : options.user;
  const logger = { info: vi.fn(), error: vi.fn() };
  const routes = new HeapSnapshotRoutes({
    auth: fakeRouteAuth({ enabled: options.enabled, isOrganizationAdmin: options.isOrganizationAdmin }),
    now: () => new Date('2026-11-18T12:00:00.000Z'),
    getHeapSnapshot: options.getHeapSnapshot ?? fakeSnapshotStream,
    logger,
  });
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(app as any, routes.routes());
  return { app, logger };
}

const request = (app: Hono) => app.request('/web/admin/heap-snapshot', { method: 'GET' });

describe('heap-snapshot route', () => {
  beforeEach(() => {
    vi.stubEnv('FACTORY_HEAP_SNAPSHOT', '1');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([undefined, '', '0', 'false', 'yes', 'on'])(
    'answers like a missing route when FACTORY_HEAP_SNAPSHOT=%s, even for an admin',
    async value => {
      if (value === undefined) delete process.env.FACTORY_HEAP_SNAPSHOT;
      else vi.stubEnv('FACTORY_HEAP_SNAPSHOT', value);
      const { app } = buildApp();
      const res = await request(app);
      const missing = await app.request('/web/admin/no-such-route');
      expect(res.status).toBe(404);
      expect(await res.text()).toBe(await missing.text());
    },
  );

  it.each(['1', 'true', ' TRUE '])('is enabled when FACTORY_HEAP_SNAPSHOT=%j', async value => {
    vi.stubEnv('FACTORY_HEAP_SNAPSHOT', value);
    const { app } = buildApp();
    expect((await request(app)).status).toBe(200);
  });

  it('403s a signed-in user who is not an organization administrator', async () => {
    const { app } = buildApp({ isOrganizationAdmin: async () => false });
    const res = await request(app);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'forbidden' });
  });

  it('403s a signed-in user without an organization', async () => {
    const { app } = buildApp({ user: { workosId: 'u1' } });
    const res = await request(app);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'organization_required' });
  });

  it('401s an anonymous caller in tenant mode', async () => {
    const { app } = buildApp({ user: null });
    const res = await request(app);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('streams an uncacheable attachment for an admin', async () => {
    const { app } = buildApp();
    const res = await request(app);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="factory-2026-11-18T12-00-00.000Z.heapsnapshot"',
    );
    expect((await res.text()).startsWith(SNAPSHOT_HEADER)).toBe(true);
  });

  it('streams a real v8 heap snapshot by default', async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const routes = new HeapSnapshotRoutes({ auth: fakeRouteAuth({ enabled: false }), logger });
    const app = new Hono();
    mountApiRoutes(app as any, routes.routes());
    const res = await request(app);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body.startsWith(SNAPSHOT_HEADER)).toBe(true);
    expect(() => JSON.parse(body)).not.toThrow();
  });

  it('allows one snapshot at a time and releases the guard when it finishes', async () => {
    let release!: () => void;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    let calls = 0;
    const producer = (): NodeJS.ReadableStream => {
      calls += 1;
      if (calls > 1) return fakeSnapshotStream();
      const readable = new Readable({ read() {} });
      readable.push(Buffer.from(SNAPSHOT_HEADER));
      void held.then(() => readable.push(null));
      return readable;
    };
    const { app } = buildApp({ getHeapSnapshot: producer });

    const first = await request(app);
    expect(first.status).toBe(200);

    const second = await request(app);
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ error: 'conflict' });

    release();
    expect(await first.text()).toBe(SNAPSHOT_HEADER);

    const third = await request(app);
    expect(third.status).toBe(200);
    expect((await third.text()).startsWith(SNAPSHOT_HEADER)).toBe(true);
  });

  it('releases the guard and logs when the snapshot producer throws', async () => {
    let calls = 0;
    const producer = (): NodeJS.ReadableStream => {
      calls += 1;
      if (calls === 1) throw new Error('snapshot exploded');
      return fakeSnapshotStream();
    };
    const { app, logger } = buildApp({ getHeapSnapshot: producer });

    const failed = await request(app);
    expect(failed.status).toBe(200);
    expect(await failed.text()).toBe('');
    expect(logger.error).toHaveBeenCalledWith(
      'heap snapshot failed',
      expect.objectContaining({ error: 'Error: snapshot exploded' }),
    );
    expect(logger.info).toHaveBeenCalledWith('heap snapshot finished', expect.objectContaining({ outcome: 'error' }));

    const retry = await request(app);
    expect(retry.status).toBe(200);
    expect((await retry.text()).startsWith(SNAPSHOT_HEADER)).toBe(true);
  });

  it('skips the admin check in local (no-auth) mode', async () => {
    const { app } = buildApp({ enabled: false, user: null });
    expect((await request(app)).status).toBe(200);
  });
});
