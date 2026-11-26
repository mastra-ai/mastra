import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PlatformSandboxOptions } from '@mastra/platform-workspace';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformConnectError } from './connect/platform-connect';
import { MastraPlatform } from './mastra-platform';

const TOKEN = 'project-token';
const PROJECT_ID = 'proj_1';

type Connection = {
  id: string;
  integrationId: string;
  status: string;
  resourceId: string | null;
  connectUrl: string;
  createdAt: string;
};

/**
 * A stand-in for the Platform services a project token reaches directly: Mastra Connect (`/v2`),
 * Memory (`/v1/memory`), Knowledge (`/v1/knowledge`) and the workspace proxy (`/v1/railway`). Each
 * rejects a request without the project token, and Connect enforces end-user ownership the way the
 * real service does: an end user's connection is only visible, launchable and removable under a
 * matching `x-mastra-resource-id`.
 */
function platformServices() {
  const connections = new Map<string, Connection>([
    [
      'conn_shared',
      {
        id: 'conn_shared',
        integrationId: 'linear',
        status: 'active',
        resourceId: null,
        connectUrl: '',
        createdAt: '2026-11-01T00:00:00.000Z',
      },
    ],
  ]);
  const threads = new Map<string, { id: string; resourceId: string; title: string }>();
  const messages = new Map<string, unknown[]>();
  const sandboxes = new Map<string, { environmentId: string }>();
  let nextId = 1;

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const method = req.method ?? 'GET';
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : undefined;
    const send = (status: number, data?: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(data === undefined ? undefined : JSON.stringify(data));
    };
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { error: 'unauthorized' });

    const resourceId = req.headers['x-mastra-resource-id'] as string | undefined;
    const path = url.pathname;
    let m: RegExpMatchArray | null;

    // —— Mastra Connect ——
    if (path === '/v2/integrations' && method === 'GET') {
      return send(200, { integrations: [{ id: 'github', displayName: 'GitHub', capabilities: { mcp: true } }] });
    }
    if ((m = path.match(/^\/v2\/projects\/([^/]+)\/connections$/)) && method === 'GET') {
      if (m[1] !== PROJECT_ID) return send(404, { error: 'project not found' });
      const scoped = url.searchParams.get('resourceId');
      const rows = [...connections.values()].filter(
        c =>
          c.status === 'active' &&
          (scoped
            ? c.resourceId === scoped || (url.searchParams.get('includeGlobal') && !c.resourceId)
            : !c.resourceId),
      );
      return send(200, { connections: rows.map(({ connectUrl: _connectUrl, ...row }) => row) });
    }
    if ((m = path.match(/^\/v2\/projects\/([^/]+)\/integrations\/([^/]+)\/connect-sessions$/)) && method === 'POST') {
      if (m[1] !== PROJECT_ID) return send(404, { error: 'project not found' });
      if (!body?.resourceId || body.resourceId !== resourceId) return send(403, { error: 'resource mismatch' });
      const id = `conn_${nextId++}`;
      connections.set(id, {
        id,
        integrationId: m[2]!,
        status: 'pending',
        resourceId: body.resourceId,
        connectUrl: `https://connect.example/${id}`,
        createdAt: new Date().toISOString(),
      });
      // An end user's link is never part of the creation response.
      return send(201, {
        connectionId: id,
        integrationId: m[2],
        connectUrl: null,
        sessionToken: null,
        expiresAt: '2030-01-01T00:00:00.000Z',
      });
    }
    if ((m = path.match(/^\/v2\/connections\/([^/]+)\/connect-url$/)) && method === 'GET') {
      const row = connections.get(m[1]!);
      if (!row || row.status !== 'pending' || row.resourceId !== resourceId) return send(404, { error: 'not found' });
      return send(200, { connectUrl: row.connectUrl, expiresAt: '2030-01-01T00:00:00.000Z' });
    }
    if ((m = path.match(/^\/v2\/connections\/([^/]+)$/)) && method === 'DELETE') {
      const row = connections.get(m[1]!);
      if (!row) return send(404, { error: 'not found' });
      // A project token only removes the end-user connections it proves it owns.
      if (!row.resourceId) return send(403, { error: 'user session required' });
      if (row.resourceId !== resourceId) return send(404, { error: 'not found' });
      connections.delete(row.id);
      return send(204);
    }

    // —— Memory ——
    if ((m = path.match(/^\/v1\/memory\/([^/]+)(\/.*)$/))) {
      if (m[1] !== 'mem_1' || req.headers['x-mastra-project-id'] !== PROJECT_ID)
        return send(404, { error: 'not found' });
      const now = new Date().toISOString();
      const sub = m[2]!;
      let t: RegExpMatchArray | null;
      if (sub === '/threads' && method === 'POST') {
        const thread = { id: body.id ?? `thread_${nextId++}`, resourceId: body.resourceId, title: body.title ?? '' };
        threads.set(thread.id, thread);
        return send(201, { ...thread, metadata: {}, createdAt: now, updatedAt: now });
      }
      if (sub === '/threads' && method === 'GET') {
        const rows = [...threads.values()].filter(x => x.resourceId === url.searchParams.get('resourceId'));
        return send(200, {
          threads: rows.map(x => ({ ...x, metadata: {}, createdAt: now, updatedAt: now })),
          hasMore: false,
        });
      }
      if ((t = sub.match(/^\/threads\/([^/]+)\/messages$/))) {
        const id = decodeURIComponent(t[1]!);
        if (method === 'POST') {
          messages.set(id, [...(messages.get(id) ?? []), ...body.messages]);
          return send(200, { messages: body.messages });
        }
        return send(200, { messages: messages.get(id) ?? [], hasMore: false });
      }
    }

    // —— Knowledge ——
    if ((m = path.match(/^\/v1\/knowledge\/([^/]+)\/operations\/([^/]+)$/)) && method === 'POST') {
      if (m[1] !== 'kn_1') return send(404, { error: 'not found' });
      if (m[2] === 'listPages') return send(200, { result: { pages: [{ id: 'page_1', title: 'Refunds' }] } });
    }

    // —— Platform API: the record of a sandbox, which names the provider running it ——
    if ((m = path.match(/^\/v1\/server\/projects\/([^/]+)\/sandboxes\/([^/]+)$/)) && method === 'GET') {
      if (m[1] !== PROJECT_ID || !sandboxes.has(m[2]!)) return send(404, { error: 'Sandbox not found' });
      return send(200, {
        id: m[2],
        environmentId: sandboxes.get(m[2]!)!.environmentId,
        provider: 'railway',
        status: 'ready',
      });
    }

    // —— Workspace proxy ——
    if ((m = path.match(/^\/v1\/railway\/projects\/([^/]+)\/sandbox(?:\/([^/]+))?(\/exec-lease)?$/))) {
      if (m[1] !== PROJECT_ID) return send(404, { error: { type: 'not_found', message: 'project not found' } });
      const [, , sandboxId, lease] = m;
      if (!sandboxId && method === 'POST') {
        const id = `sbx_${nextId++}`;
        sandboxes.set(id, { environmentId: body.environmentId });
        return send(201, { id, createdAt: new Date().toISOString() });
      }
      if (sandboxId && !sandboxes.has(sandboxId)) {
        return send(404, { error: { type: 'not_found', message: 'sandbox not found' } });
      }
      if (sandboxId && !lease && method === 'GET') {
        return send(200, { id: sandboxId, createdAt: new Date().toISOString() });
      }
      if (sandboxId && lease && method === 'POST') {
        return send(200, {
          provider: 'railway',
          sandboxId,
          providerResourceId: `rw_${sandboxId}`,
          jwt: `lease-${sandboxId}`,
          wsEndpoint: 'wss://shell.example/ws/exec',
          subprotocol: 'railway-shell',
          expiresAt: '2030-01-01T00:00:00.000Z',
        });
      }
    }

    return send(404, { error: `no route for ${method} ${path}` });
  }

  const server = createServer((req, res) => {
    handle(req, res).catch(error => {
      res.writeHead(500);
      res.end(String(error));
    });
  });

  return {
    server,
    connections,
    sandboxes,
    /** The end user finishes signing in to the provider. */
    completeSignIn(connectionId: string) {
      connections.get(connectionId)!.status = 'active';
    },
  };
}

type ExecSocketFactory = NonNullable<PlatformSandboxOptions['webSocketFactory']>;

/**
 * The provider's shell endpoint: runs `echo` commands sent in the exec init frame and reports the
 * exit code. The lease's endpoint and token are recorded so the test can see which sandbox it hit.
 */
function providerShell() {
  const opened: { endpoint: string; subprotocols: string[] }[] = [];
  const factory: ExecSocketFactory = (endpoint, subprotocols) => {
    opened.push({ endpoint, subprotocols });
    const socket: ReturnType<ExecSocketFactory> = {
      binaryType: 'blob',
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      send(data: string) {
        const frame = JSON.parse(data) as { type: string; data?: { command?: string } };
        if (frame.type !== 'init_exec') return;
        const output = frame.data?.command?.match(/echo (.*)$/)?.[1]?.replace(/'/g, '') ?? '';
        const bytes = new TextEncoder().encode(`${output}\n`);
        const framed = new Uint8Array(bytes.length + 1);
        framed[0] = 1;
        framed.set(bytes, 1);
        queueMicrotask(() => {
          socket.onmessage?.({ data: framed.buffer });
          socket.onmessage?.({ data: JSON.stringify({ type: 'exit', data: { exit_code: 0 } }) });
        });
      },
      close() {},
    };
    queueMicrotask(() => socket.onopen?.({}));
    return socket;
  };
  return { factory, opened };
}

describe('MastraPlatform services', () => {
  let services: ReturnType<typeof platformServices>;
  let baseUrl: string;

  beforeAll(async () => {
    services = platformServices();
    await new Promise<void>(resolve => services.server.listen(0, '127.0.0.1', resolve));
    const address = services.server.address();
    if (!address || typeof address === 'string') throw new Error('Expected a TCP port');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>(resolve => services.server.close(() => resolve()));
  });

  beforeEach(() => {
    vi.stubEnv('MASTRA_INTEGRATIONS_API_URL', baseUrl);
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', baseUrl);
    vi.stubEnv('SANDBOX_PROVIDER', 'railway');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const platform = () => new MastraPlatform({ accessToken: TOKEN, projectId: PROJECT_ID, apiUrl: baseUrl });

  describe('connect', () => {
    it('connects an end user account that only that end user can see and remove', async () => {
      const { connect } = platform();

      expect((await connect.listIntegrations()).map(i => i.id)).toEqual(['github']);

      const session = await connect.createConnectSession('github', { resourceId: 'user-1' });
      expect(session).toMatchObject({
        integrationId: 'github',
        connectUrl: `https://connect.example/${session.connectionId}`,
      });

      // Pending until the end user signs in at the link.
      expect((await connect.listConnections({ resourceId: 'user-1' })).map(c => c.id)).toEqual(['conn_shared']);
      services.completeSignIn(session.connectionId);

      expect((await connect.listConnections({ resourceId: 'user-1' })).map(c => c.id).sort()).toEqual([
        session.connectionId,
        'conn_shared',
      ]);
      expect((await connect.listConnections({ resourceId: 'user-2' })).map(c => c.id)).toEqual(['conn_shared']);
      expect((await connect.listConnections()).map(c => c.id)).toEqual(['conn_shared']);

      await expect(connect.disconnect(session.connectionId, { resourceId: 'user-2' })).rejects.toMatchObject({
        name: 'PlatformConnectError',
        status: 404,
      });
      await connect.disconnect(session.connectionId, { resourceId: 'user-1' });
      expect((await connect.listConnections({ resourceId: 'user-1' })).map(c => c.id)).toEqual(['conn_shared']);
    });

    it('fails with the service status when the token is rejected', async () => {
      const { connect } = new MastraPlatform({ accessToken: 'wrong', projectId: PROJECT_ID });
      const error = await connect.listIntegrations().catch(e => e);
      expect(error).toBeInstanceOf(PlatformConnectError);
      expect(error.status).toBe(401);
    });
  });

  describe('memory', () => {
    it("reads and writes an end user's threads with the project token", async () => {
      const memory = platform().getMemory({ instanceId: 'mem_1', apiUrl: baseUrl });

      const thread = await memory.client.createThread({ resourceId: 'user-1', title: 'Billing' });
      await memory.client.saveMessages(thread.id, {
        resourceId: 'user-1',
        messages: [{ id: 'msg_1', role: 'user', content: 'Where is my invoice?' } as never],
      });

      expect((await memory.client.listThreads({ resourceId: 'user-1' })).threads.map(t => t.title)).toEqual([
        'Billing',
      ]);
      expect((await memory.client.listMessages(thread.id)).messages).toMatchObject([
        { id: 'msg_1', content: 'Where is my invoice?' },
      ]);
    });
  });

  describe('knowledge', () => {
    it("reads the instance's pages with the project token", async () => {
      const knowledge = platform().getKnowledge({ instanceId: 'kn_1', apiUrl: baseUrl });
      const store = await knowledge.getStorage();
      expect(await store!.listPages({ read: 'all' })).toEqual({ pages: [{ id: 'page_1', title: 'Refunds' }] });
    });
  });

  describe('sandboxes', () => {
    it('starts a sandbox in the environment and runs commands in it', async () => {
      const shell = providerShell();
      const sandbox = await platform().createSandbox({ environmentId: 'env_1', webSocketFactory: shell.factory });

      expect(sandbox.status).toBe('running');
      expect(services.sandboxes.get(sandbox.sandboxId!)).toEqual({ environmentId: 'env_1' });

      const result = await sandbox.executeCommand('echo', ['hello']);
      expect(result).toMatchObject({ success: true, exitCode: 0, stdout: 'hello\n' });
      expect(shell.opened).toEqual([
        { endpoint: 'wss://shell.example/ws/exec', subprotocols: ['railway-shell', `lease-${sandbox.sandboxId}`] },
      ]);
    });

    it('reattaches to an existing sandbox by id', async () => {
      const first = await platform().createSandbox({ environmentId: 'env_1' });
      const sandboxCount = services.sandboxes.size;

      const shell = providerShell();
      const again = await platform().createSandbox({ sandboxId: first.sandboxId, webSocketFactory: shell.factory });

      expect(again.sandboxId).toBe(first.sandboxId);
      expect(services.sandboxes.size).toBe(sandboxCount);
      expect((await again.executeCommand('echo', ['back'])).stdout).toBe('back\n');
    });

    it('reconnects to a saved sandbox through the provider that runs it', async () => {
      const first = await platform().createSandbox({ environmentId: 'env_1' });
      const sandboxCount = services.sandboxes.size;
      // This process would otherwise reach sandboxes through E2B, which doesn't run this one.
      vi.stubEnv('SANDBOX_PROVIDER', 'e2b');

      const shell = providerShell();
      const again = await platform().getSandbox(first.sandboxId!, { webSocketFactory: shell.factory });

      expect(again.sandboxId).toBe(first.sandboxId);
      expect(services.sandboxes.size).toBe(sandboxCount);
      expect((await again.executeCommand('echo', ['back'])).stdout).toBe('back\n');
    });

    it('fails rather than starting a new sandbox when the saved one is gone', async () => {
      const sandboxCount = services.sandboxes.size;
      await expect(
        platform().getSandbox('sbx_gone', { sandboxProvider: 'railway', environmentId: 'env_1' }),
      ).rejects.toThrow();
      expect(services.sandboxes.size).toBe(sandboxCount);
    });
  });
});
