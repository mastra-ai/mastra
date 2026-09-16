import { describe, expect, it } from 'vitest';

import {
  CloudflareSandboxBridgeClient,
  CloudflareSandboxBridgeError,
  type CloudflareCommandEvent,
} from './bridge-client';
import { createFakeBridge } from './testing/fake-bridge';

const BASE_URL = 'https://bridge.example.com';

function createClient(bridge = createFakeBridge({ apiToken: 'secret' })) {
  return {
    bridge,
    client: new CloudflareSandboxBridgeClient({ baseUrl: `${BASE_URL}/`, apiToken: 'secret', fetch: bridge.fetch }),
  };
}

function decode(events: CloudflareCommandEvent[], type: 'stdout' | 'stderr'): string {
  return events
    .filter(event => event.type === type)
    .map(event => Buffer.from((event as { data: Uint8Array }).data).toString('utf8'))
    .join('');
}

describe('CloudflareSandboxBridgeClient', () => {
  it('creates a sandbox with POST /v1/sandbox and a bearer token', async () => {
    const { bridge, client } = createClient();

    const id = await client.createSandbox();

    expect(id).toBe('sbx-1');
    expect(bridge.requests[0]).toMatchObject({
      method: 'POST',
      url: `${BASE_URL}/v1/sandbox`,
      authorization: 'Bearer secret',
    });
  });

  it('checks liveness with GET /v1/sandbox/:id/running', async () => {
    const { bridge, client } = createClient();
    const id = await client.createSandbox();

    await expect(client.isRunning(id)).resolves.toBe(true);
    await expect(client.isRunning('missing')).resolves.toBe(false);
    expect(bridge.requests.at(-1)).toMatchObject({ method: 'GET', url: `${BASE_URL}/v1/sandbox/missing/running` });
  });

  it('destroys a sandbox with DELETE /v1/sandbox/:id', async () => {
    const { bridge, client } = createClient();
    const id = await client.createSandbox();

    await client.deleteSandbox(id);

    expect(bridge.sandboxes.has(id)).toBe(false);
    expect(bridge.requests.at(-1)).toMatchObject({ method: 'DELETE', url: `${BASE_URL}/v1/sandbox/${id}` });
  });

  it('writes one file per PUT /v1/sandbox/:id/file/* request with raw bytes', async () => {
    const { bridge, client } = createClient();
    const id = await client.createSandbox();

    await client.writeFile(id, '/workspace/src/index.ts', 'export const a = 1;');
    await client.writeFile(id, '/workspace/bin/data', new Uint8Array([104, 105]));

    expect(bridge.requests.at(-2)).toMatchObject({
      method: 'PUT',
      url: `${BASE_URL}/v1/sandbox/${id}/file/workspace/src/index.ts`,
    });
    expect(bridge.files.get('/workspace/src/index.ts')).toBe('export const a = 1;');
    expect(bridge.files.get('/workspace/bin/data')).toBe('hi');
  });

  it('encodes file paths without leading slashes or a backtracking regex', async () => {
    const { bridge, client } = createClient();
    const id = await client.createSandbox();

    await client.writeFile(id, '///workspace/a b.txt', 'x');

    expect(bridge.requests.at(-1)?.url).toBe(`${BASE_URL}/v1/sandbox/${id}/file/workspace/a%20b.txt`);
  });

  it('reads a file with GET /v1/sandbox/:id/file/* and returns raw bytes', async () => {
    const { bridge, client } = createClient();
    const id = await client.createSandbox();
    await client.writeFile(id, '/workspace/notes.txt', 'hello bytes');

    const bytes = await client.readFile(id, '/workspace/notes.txt');

    expect(Buffer.from(bytes).toString('utf8')).toBe('hello bytes');
    expect(bridge.requests.at(-1)).toMatchObject({
      method: 'GET',
      url: `${BASE_URL}/v1/sandbox/${id}/file/workspace/notes.txt`,
    });
  });

  it('throws a bridge error when reading a missing file', async () => {
    const { client } = createClient();
    const id = await client.createSandbox();

    await expect(client.readFile(id, '/workspace/missing.txt')).rejects.toMatchObject({
      name: 'CloudflareSandboxBridgeError',
      status: 404,
    });
  });

  it('persists /workspace with GET /persist, forwarding excludes', async () => {
    const { bridge, client } = createClient();
    const id = await client.createSandbox();

    const archive = await client.persistWorkspace(id, { excludes: ['node_modules', '.git'] });

    expect(Buffer.from(archive).toString('utf8')).toBe('fake-tar-archive');
    expect(bridge.persists.at(-1)).toBe('node_modules,.git');
    expect(bridge.requests.at(-1)).toMatchObject({ method: 'GET' });
    expect(bridge.requests.at(-1)?.url).toBe(`${BASE_URL}/v1/sandbox/${id}/persist?excludes=node_modules%2C.git`);
  });

  it('omits the excludes query when none are given', async () => {
    const { bridge, client } = createClient();
    const id = await client.createSandbox();

    await client.persistWorkspace(id);

    expect(bridge.requests.at(-1)?.url).toBe(`${BASE_URL}/v1/sandbox/${id}/persist`);
    expect(bridge.persists.at(-1)).toBeNull();
  });

  it('hydrates /workspace with POST /hydrate carrying the raw tar', async () => {
    const { bridge, client } = createClient();
    const id = await client.createSandbox();
    const tar = new Uint8Array([1, 2, 3, 4]);

    await client.hydrateWorkspace(id, tar);

    expect(bridge.requests.at(-1)).toMatchObject({ method: 'POST', url: `${BASE_URL}/v1/sandbox/${id}/hydrate` });
    expect(Array.from(bridge.hydrations.at(-1)!)).toEqual([1, 2, 3, 4]);
  });

  it('mounts a bucket with POST /mount', async () => {
    const { bridge, client } = createClient();
    const id = await client.createSandbox();

    await client.mountBucket(id, {
      bucket: 'my-bucket',
      mountPath: '/mnt/data',
      options: { endpoint: 'https://acct.r2.cloudflarestorage.com', readOnly: true },
    });

    expect(bridge.requests.at(-1)).toMatchObject({ method: 'POST', url: `${BASE_URL}/v1/sandbox/${id}/mount` });
    expect(bridge.mounts.at(-1)).toEqual({
      bucket: 'my-bucket',
      mountPath: '/mnt/data',
      options: { endpoint: 'https://acct.r2.cloudflarestorage.com', readOnly: true },
    });
  });

  it('unmounts a bucket with POST /unmount', async () => {
    const { bridge, client } = createClient();
    const id = await client.createSandbox();

    await client.unmountBucket(id, '/mnt/data');

    expect(bridge.requests.at(-1)).toMatchObject({ method: 'POST', url: `${BASE_URL}/v1/sandbox/${id}/unmount` });
    expect(bridge.unmounts.at(-1)).toEqual({ mountPath: '/mnt/data' });
  });

  it('creates a session with POST /session and returns its id', async () => {
    const { bridge, client } = createClient();
    const id = await client.createSandbox();

    const generated = await client.createSession(id, { cwd: '/workspace', env: { NODE_ENV: 'test' } });
    expect(generated.id).toBe('sess-1');
    expect(bridge.sessions.has('sess-1')).toBe(true);
    expect(bridge.requests.at(-1)).toMatchObject({ method: 'POST', url: `${BASE_URL}/v1/sandbox/${id}/session` });

    const chosen = await client.createSession(id, { sessionId: 'my-session' });
    expect(chosen.id).toBe('my-session');
  });

  it('deletes a session with DELETE /session/:sid', async () => {
    const { bridge, client } = createClient();
    const id = await client.createSandbox();
    const session = await client.createSession(id);

    await client.deleteSession(id, session.id);

    expect(bridge.sessions.has(session.id)).toBe(false);
    expect(bridge.requests.at(-1)).toMatchObject({
      method: 'DELETE',
      url: `${BASE_URL}/v1/sandbox/${id}/session/${session.id}`,
    });
  });

  it('sends argv, timeout_ms and cwd to /exec', async () => {
    const { bridge, client } = createClient();
    const id = await client.createSandbox();

    await client.exec(
      id,
      { argv: ['echo', 'hello world'], timeoutMs: 10_000, cwd: '/workspace' },
      { onEvent: () => {} },
    );

    expect(bridge.execs[0]).toEqual({ argv: ['echo', 'hello world'], timeout_ms: 10_000, cwd: '/workspace' });
    expect(bridge.requests.at(-1)?.url).toBe(`${BASE_URL}/v1/sandbox/${id}/exec`);
  });

  it('base64-decodes stdout chunks and reports exit_code', async () => {
    const bridge = createFakeBridge({ apiToken: 'secret' });
    bridge.onExec = () => ({ stdout: 'hello world\n', stderr: 'warn\n', exitCode: 3, stdoutChunks: 4 });
    const { client } = createClient(bridge);
    const id = await client.createSandbox();

    const events: CloudflareCommandEvent[] = [];
    await client.exec(id, { argv: ['echo', 'hello'] }, { onEvent: event => events.push(event) });

    expect(decode(events, 'stdout')).toBe('hello world\n');
    expect(decode(events, 'stderr')).toBe('warn\n');
    expect(events.at(-1)).toEqual({ type: 'exit', exitCode: 3 });
  });

  it('surfaces terminal error events', async () => {
    const bridge = createFakeBridge({ apiToken: 'secret' });
    bridge.onExec = () => ({ error: { error: 'command timed out', code: 'TIMEOUT' } });
    const { client } = createClient(bridge);
    const id = await client.createSandbox();

    const events: CloudflareCommandEvent[] = [];
    await client.exec(id, { argv: ['sleep', '60'] }, { onEvent: event => events.push(event) });

    expect(events).toEqual([{ type: 'error', message: 'command timed out', code: 'TIMEOUT' }]);
  });

  it('throws a descriptive error for unsuccessful responses', async () => {
    const bridge = createFakeBridge({ apiToken: 'secret' });
    const { client } = createClient(bridge);

    await expect(client.isRunning('missing-route-check')).resolves.toBe(false);
    await expect(
      new CloudflareSandboxBridgeClient({ baseUrl: BASE_URL, apiToken: 'wrong', fetch: bridge.fetch }).createSandbox(),
    ).rejects.toMatchObject({ name: 'CloudflareSandboxBridgeError', status: 401, body: 'unauthorized' });
  });

  it('exposes status and body on bridge errors', () => {
    const error = new CloudflareSandboxBridgeError(404, 'missing');

    expect(error.status).toBe(404);
    expect(error.body).toBe('missing');
    expect(error.message).toContain('404');
  });
});
