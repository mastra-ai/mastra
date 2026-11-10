import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Agent } from '@mastra/core/agent';
import { FGADeniedError } from '@mastra/core/auth/ee';
import type { FGACheckParams, IFGAProvider } from '@mastra/core/auth/ee';
import { Mastra } from '@mastra/core/mastra';
import { MASTRA_THREAD_ID_KEY } from '@mastra/core/request-context';
import type { MastraAuthConfig } from '@mastra/core/server';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MastraServer } from '../index';

const auth: MastraAuthConfig = {
  authenticateToken: async token => (token === 'alice' || token === 'bob' ? { id: token } : null),
  authorizeUser: () => true,
  mapUserToResourceId: user => (user as { id: string }).id,
};

/** In-memory FGA provider: a thread is readable only by its owner; other resources are open. */
class ThreadOwnerFGA implements IFGAProvider {
  constructor(private readonly threadOwners: Record<string, string>) {}

  async check(user: unknown, { resource }: FGACheckParams) {
    return resource.type !== 'thread' || this.threadOwners[resource.id] === (user as { id: string }).id;
  }

  async require(user: unknown, params: FGACheckParams) {
    if (!(await this.check(user, params))) throw new FGADeniedError(user, params.resource, params.permission);
  }

  async filterAccessible<T extends { id: string }>(user: unknown, resources: T[], resourceType: string) {
    const allowed = await Promise.all(
      resources.map(r => this.check(user, { resource: { type: resourceType, id: r.id }, permission: 'memory:read' })),
    );
    return resources.filter((_, i) => allowed[i]);
  }
}

let dir: string | undefined;

afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = undefined;
});

async function setup(authConfig?: MastraAuthConfig, fga?: IFGAProvider, middleware?: MiddlewareHandler) {
  dir = await mkdtemp(join(tmpdir(), 'om-ownership-'));
  const storage = new LibSQLStore({ id: 'om-ownership', url: `file:${join(dir, 'mastra.db')}` });
  const agentFor = (id: string, scope: 'thread' | 'resource') =>
    new Agent({
      id,
      name: id,
      instructions: 'Test',
      model: 'openai/gpt-4o',
      memory: new Memory({ storage, options: { observationalMemory: { model: 'openai/gpt-4o', scope } } }),
    });
  const mastra = new Mastra({
    logger: false,
    storage,
    agents: {
      'thread-agent': agentFor('thread-agent', 'thread'),
      'resource-agent': agentFor('resource-agent', 'resource'),
    },
    ...(authConfig ? { server: { auth: authConfig, fga, ...(middleware ? { middleware } : {}) } } : {}),
  });

  await storage.init();
  const memoryStore = (await storage.getStore('memory'))!;
  for (const user of ['alice', 'bob']) {
    await memoryStore.saveThread({
      thread: {
        id: `${user}-thread`,
        resourceId: user,
        title: '',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    for (const [scope, threadId] of [
      ['thread', `${user}-thread`],
      ['resource', null],
    ] as const) {
      const record = await memoryStore.initializeObservationalMemory({ threadId, resourceId: user, scope, config: {} });
      await memoryStore.updateActiveObservations({
        id: record.id,
        observations: `${user} ${scope} secret`,
        tokenCount: user === 'alice' ? 11 : 22,
        lastObservedAt: new Date(),
      });
    }
  }

  const app = new Hono();
  await new MastraServer({ app, mastra }).init();
  return app;
}

function request(app: Hono, path: string, token?: string, body?: unknown) {
  return app.request(`http://localhost/api${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

const getOM = (app: Hono, query: string, token?: string) =>
  request(app, `/memory/observational-memory?${query}`, token);
const bufferStatus = (app: Hono, body: Record<string, string>, token?: string) =>
  request(app, '/memory/observational-memory/buffer-status', token, body);

describe('observational memory ownership over HTTP', () => {
  it('lets the owner read their thread-scoped observations', async () => {
    const app = await setup(auth);
    const res = await getOM(app, 'agentId=thread-agent&resourceId=alice&threadId=alice-thread', 'alice');
    expect(res.status).toBe(200);
    expect((await res.json()).record.activeObservations).toBe('alice thread secret');

    const buffered = await bufferStatus(
      app,
      { agentId: 'thread-agent', resourceId: 'alice', threadId: 'alice-thread' },
      'alice',
    );
    expect(buffered.status).toBe(200);
    expect((await buffered.json()).record.activeObservations).toBe('alice thread secret');
  });

  it("denies another user's thread-scoped observations", async () => {
    const app = await setup(auth);
    for (const resourceId of ['alice', 'bob']) {
      const res = await getOM(app, `agentId=thread-agent&resourceId=${resourceId}&threadId=alice-thread`, 'bob');
      expect(res.status).toBe(403);
      expect(JSON.stringify(await res.json())).not.toContain('alice thread secret');

      const buffered = await bufferStatus(
        app,
        { agentId: 'thread-agent', resourceId, threadId: 'alice-thread' },
        'bob',
      );
      expect(buffered.status).toBe(403);
      expect(JSON.stringify(await buffered.json())).not.toContain('alice thread secret');
    }
  });

  it("scopes resource-scoped observations to the caller's resource", async () => {
    const app = await setup(auth);
    const res = await getOM(app, 'agentId=resource-agent&resourceId=alice', 'bob');
    expect(res.status).toBe(200);
    expect((await res.json()).record.activeObservations).toBe('bob resource secret');

    const buffered = await bufferStatus(app, { agentId: 'resource-agent', resourceId: 'alice' }, 'bob');
    expect(buffered.status).toBe(200);
    expect((await buffered.json()).record.activeObservations).toBe('bob resource secret');

    const own = await getOM(app, 'agentId=resource-agent&resourceId=alice', 'alice');
    expect((await own.json()).record.activeObservations).toBe('alice resource secret');
  });

  it("does not expose another user's observational memory status", async () => {
    const app = await setup(auth);
    const denied = await request(
      app,
      '/memory/status?agentId=thread-agent&resourceId=alice&threadId=alice-thread',
      'bob',
    );
    expect(denied.status).toBe(403);

    const own = await request(app, '/memory/status?agentId=thread-agent&resourceId=bob&threadId=bob-thread', 'bob');
    expect(own.status).toBe(200);
    expect((await own.json()).observationalMemory).toMatchObject({ enabled: true, hasRecord: true });
  });

  it("reports resource-scoped observational memory status for the caller's resource", async () => {
    const app = await setup(auth);
    const res = await request(app, '/memory/status?agentId=resource-agent&resourceId=alice', 'bob');
    expect(res.status).toBe(200);
    const status = (await res.json()).observationalMemory;
    expect(status).toMatchObject({ enabled: true, hasRecord: true, tokenCount: 22 });
    expect(status.tokenCount).not.toBe(11);
  });

  it('denies observations when the FGA provider denies memory:read on the thread', async () => {
    // Without a resource mapper, resource ownership doesn't separate users, so FGA is the only gate here.
    const { mapUserToResourceId: _mapper, ...authWithoutMapper } = auth;
    const app = await setup(authWithoutMapper, new ThreadOwnerFGA({ 'alice-thread': 'alice', 'bob-thread': 'bob' }));
    const query = 'agentId=thread-agent&resourceId=alice&threadId=alice-thread';

    const denied = await getOM(app, query, 'bob');
    expect(denied.status).toBe(403);
    expect(JSON.stringify(await denied.json())).not.toContain('alice thread secret');

    const allowed = await getOM(app, query, 'alice');
    expect(allowed.status).toBe(200);
    expect((await allowed.json()).record.activeObservations).toBe('alice thread secret');
  });

  it('uses the thread pinned in the request context over the client-supplied thread', async () => {
    const pinBobThread: MiddlewareHandler = async (c, next) => {
      c.get('requestContext').set(MASTRA_THREAD_ID_KEY, 'bob-thread');
      await next();
    };
    const app = await setup(auth, undefined, pinBobThread);
    const query = 'agentId=thread-agent&resourceId=bob&threadId=other-bob-thread';

    const res = await getOM(app, query, 'bob');
    expect(res.status).toBe(200);
    expect((await res.json()).record.activeObservations).toBe('bob thread secret');

    const buffered = await bufferStatus(
      app,
      { agentId: 'thread-agent', resourceId: 'bob', threadId: 'other-bob-thread' },
      'bob',
    );
    expect((await buffered.json()).record.activeObservations).toBe('bob thread secret');

    const status = await request(app, `/memory/status?${query}`, 'bob');
    expect((await status.json()).observationalMemory).toMatchObject({ hasRecord: true, tokenCount: 22 });
  });

  it('keeps client-supplied ids when auth is not configured', async () => {
    const app = await setup();
    const res = await getOM(app, 'agentId=thread-agent&resourceId=alice&threadId=alice-thread');
    expect(res.status).toBe(200);
    expect((await res.json()).record.activeObservations).toBe('alice thread secret');

    const resource = await getOM(app, 'agentId=resource-agent&resourceId=alice');
    expect((await resource.json()).record.activeObservations).toBe('alice resource secret');

    const buffered = await bufferStatus(app, {
      agentId: 'thread-agent',
      resourceId: 'alice',
      threadId: 'alice-thread',
    });
    expect((await buffered.json()).record.activeObservations).toBe('alice thread secret');
  });
});

describe('gateway observational memory ownership over HTTP', () => {
  const threads: Record<string, string> = { 'alice-thread': 'alice', 'bob-thread': 'bob' };
  const orphanRecords: Record<string, string> = { 'orphan-thread': 'alice' };
  const hits: string[] = [];
  let failThreadLookup = false;
  let gateway: Server;

  beforeAll(async () => {
    gateway = createServer((req, res) => {
      const url = new URL(req.url!, 'http://gateway');
      hits.push(url.pathname);
      const match = url.pathname.match(/^\/v1\/memory\/threads\/([^/]+)(\/observations\/(record|history))?$/);
      const threadId = match && decodeURIComponent(match[1]!);
      // orphan-thread has alice's observation record but no thread (deleted, or mid-deletion)
      const owner = threadId ? (threads[threadId] ?? (match[2] ? orphanRecords[threadId] : undefined)) : undefined;
      res.setHeader('Content-Type', 'application/json');
      if (!match || !owner) return res.writeHead(404).end('{}');
      if (!match[2] && failThreadLookup) return res.writeHead(503).end('{}');
      const now = new Date().toISOString();
      if (!match[2]) {
        return res.end(
          JSON.stringify({
            thread: {
              id: threadId,
              projectId: 'p',
              resourceId: owner,
              title: null,
              metadata: null,
              createdAt: now,
              updatedAt: now,
            },
          }),
        );
      }
      const record = {
        id: `${owner}-om`,
        scope: 'thread',
        threadId,
        resourceId: owner,
        createdAt: now,
        updatedAt: now,
        lastObservedAt: now,
        originType: 'initial',
        generationCount: 0,
        activeObservations: `${owner} gateway secret`,
        totalTokensObserved: 5,
        observationTokenCount: 5,
        pendingMessageTokens: 0,
        isReflecting: false,
        isObserving: false,
        isBufferingObservation: false,
        isBufferingReflection: false,
      };
      res.end(JSON.stringify(match[3] === 'record' ? { record } : { records: [record] }));
    });
    await new Promise<void>(resolve => gateway.listen(0, '127.0.0.1', resolve));
    vi.stubEnv('MASTRA_GATEWAY_URL', `http://127.0.0.1:${(gateway.address() as AddressInfo).port}`);
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'test-gateway-key');
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await new Promise(resolve => gateway.close(resolve));
  });

  afterEach(() => {
    hits.length = 0;
    failThreadLookup = false;
  });

  async function gatewayApp() {
    const agent = new Agent({
      id: 'gw-agent',
      name: 'gw-agent',
      instructions: 'Test',
      model: 'mastra/openai/gpt-5-mini',
    });
    const mastra = new Mastra({ logger: false, agents: { 'gw-agent': agent }, server: { auth } });
    const app = new Hono();
    await new MastraServer({ app, mastra }).init();
    return app;
  }

  const ids = 'agentId=gw-agent&resourceId=alice&threadId=alice-thread';

  it("denies another user's gateway thread on every observational memory route", async () => {
    const app = await gatewayApp();
    for (const res of [
      await getOM(app, ids, 'bob'),
      await bufferStatus(app, { agentId: 'gw-agent', resourceId: 'alice', threadId: 'alice-thread' }, 'bob'),
      await request(app, `/memory/status?${ids}`, 'bob'),
    ]) {
      expect(res.status).toBe(403);
      expect(JSON.stringify(await res.json())).not.toContain('alice gateway secret');
    }
    expect(hits.some(path => path.includes('/observations/'))).toBe(false);

    const own = await getOM(app, ids, 'alice');
    expect(own.status).toBe(200);
    expect((await own.json()).record.activeObservations).toBe('alice gateway secret');
  });

  it('keeps memory status best-effort without fetching observations when the thread lookup fails', async () => {
    const app = await gatewayApp();
    failThreadLookup = true;
    const res = await request(app, `/memory/status?${ids}`, 'alice');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: true, memoryType: 'gateway', observationalMemory: { enabled: true } });
    expect(hits.some(path => path.includes('/observations/'))).toBe(false);
  });

  it('returns no observations for a gateway thread that no longer exists', async () => {
    const app = await gatewayApp();
    const orphanIds = 'agentId=gw-agent&resourceId=bob&threadId=orphan-thread';
    const responses = [
      await getOM(app, orphanIds, 'bob'),
      await bufferStatus(app, { agentId: 'gw-agent', resourceId: 'bob', threadId: 'orphan-thread' }, 'bob'),
      await request(app, `/memory/status?${orphanIds}`, 'bob'),
    ];
    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(JSON.stringify(await res.json())).not.toContain('alice gateway secret');
    }
    expect(hits.some(path => path.includes('/observations/'))).toBe(false);
  });
});
