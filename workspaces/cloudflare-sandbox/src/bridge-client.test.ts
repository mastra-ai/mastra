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
