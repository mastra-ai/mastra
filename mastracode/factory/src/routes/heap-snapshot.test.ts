import { Readable } from 'node:stream';

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { HeapSnapshotRoutes } from './heap-snapshot.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

const SNAPSHOT_HEADER = '{"snapshot":';

/** Return a readable yielding the real v8 snapshot JSON header one byte at a time, then close. */
function fakeSnapshotStream(payload: string = `${SNAPSHOT_HEADER}{"meta":{}}`): NodeJS.ReadableStream {
  return Readable.from(Buffer.from(payload));
}

interface BuildAppOptions {
  enabled?: boolean;
  isOrganizationAdmin?: (orgId: string, userId: string) => Promise<boolean>;
  routeEnabled?: boolean;
  user?: { workosId: string; organizationId?: string } | null;
  getHeapSnapshot?: () => NodeJS.ReadableStream;
}

/** Build a Hono app mounting a fresh HeapSnapshotRoutes instance per test. */
function buildApp(options: BuildAppOptions = {}) {
  const user = options.user === undefined ? { workosId: 'u1', organizationId: 'org1' } : options.user;
  const routes = new HeapSnapshotRoutes({
    auth: fakeRouteAuth({ enabled: options.enabled, isOrganizationAdmin: options.isOrganizationAdmin }),
    isEnabled: () => options.routeEnabled !== false,
    now: () => new Date('2026-11-18T12:00:00.000Z'),
    ...(options.getHeapSnapshot ? { getHeapSnapshot: options.getHeapSnapshot } : {}),
    logger: { info: () => {} },
  });
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(app as any, routes.routes());
  return app;
}

const request = (app: Hono) =>
  app.request('/web/admin/heap-snapshot', {
    method: 'GET',
  });

describe('heap-snapshot route', () => {
  beforeEach(() => {
    delete process.env.FACTORY_HEAP_SNAPSHOT;
  });
  afterEach(() => {
    delete process.env.FACTORY_HEAP_SNAPSHOT;
  });

  it('404s when the env flag is off even for an organization admin', async () => {
    const app = buildApp({ routeEnabled: false });
    const res = await request(app);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('403s a signed-in user who is not an organization administrator', async () => {
    const app = buildApp({
      isOrganizationAdmin: async () => false,
      getHeapSnapshot: fakeSnapshotStream,
    });
    const res = await request(app);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'forbidden' });
  });

  it('401s an anonymous caller in tenant mode', async () => {
    const app = buildApp({
      user: null,
      getHeapSnapshot: fakeSnapshotStream,
    });
    const res = await request(app);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('streams a snapshot body starting with the v8 JSON header for an admin', async () => {
    const app = buildApp({
      getHeapSnapshot: fakeSnapshotStream,
    });
    const res = await request(app);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="factory-2026-11-18T12-00-00.000Z.heapsnapshot"',
    );
    const body = await res.text();
    expect(body.startsWith(SNAPSHOT_HEADER)).toBe(true);
  });

  it('returns 409 when a second concurrent request arrives while one is in flight', async () => {
    // Hold the first snapshot stream open until the second request has had a
    // chance to observe the in-flight guard.
    let release: (() => void) | undefined;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    const holdingStream = (): NodeJS.ReadableStream => {
      const readable = new Readable({ read() {} });
      readable.push(Buffer.from(SNAPSHOT_HEADER));
      held.then(() => readable.push(null));
      return readable;
    };

    const app = buildApp({ getHeapSnapshot: holdingStream });
    const first = request(app);
    // Let Hono start the streaming response and set `#inFlight = true` before
    // the second call lands.
    await new Promise(resolve => setImmediate(resolve));
    const secondRes = await request(app);
    expect(secondRes.status).toBe(409);
    expect(await secondRes.json()).toMatchObject({ error: 'conflict' });

    release?.();
    const firstRes = await first;
    expect(firstRes.status).toBe(200);
    await firstRes.text();

    // Third request after the first finishes should go through (guard released).
    const thirdApp = buildApp({ getHeapSnapshot: fakeSnapshotStream });
    const thirdRes = await request(thirdApp);
    expect(thirdRes.status).toBe(200);
  });

  it('respects the local (no-auth) scope without an admin check when the flag is on', async () => {
    const app = buildApp({
      enabled: false,
      getHeapSnapshot: fakeSnapshotStream,
      user: null,
    });
    const res = await request(app);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
  });
});
