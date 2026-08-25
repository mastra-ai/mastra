import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DirectExecWebSocket, DirectExecWebSocketFactory } from './direct-exec.js';
import { PlatformSandbox, type SandboxAddressRegistry } from './sandbox.js';

function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init });
}

/**
 * Wire-shape of a successful `POST /sandbox/:id/exec-lease` response, used
 * across tests that exercise the direct-exec path.
 */
function leaseResponse(overrides: { jwt?: string; expiresAt?: string | null } = {}) {
  return json({
    provider: 'railway',
    sandboxId: 'sbx_test',
    providerResourceId: 'rw_sb_test',
    jwt: overrides.jwt ?? 'jwt.value.here',
    wsEndpoint: 'wss://ssh.railway.com:2226/ws/exec',
    subprotocol: 'railway-shell',
    // Explicit key check so `expiresAt: null` isn't collapsed to the default
    // by nullish coalescing (which treats null and undefined the same).
    expiresAt: 'expiresAt' in overrides ? overrides.expiresAt : '2030-01-01T00:00:00.000Z',
  });
}

function e2bLeaseResponse() {
  return json({
    provider: 'e2b',
    sandboxId: 'sbx_1',
    providerResourceId: 'e2b_sbx_1',
    jwt: 'envd-access-token',
    wsEndpoint: 'https://49983-e2b-sbx-1.e2b.app',
    subprotocol: 'e2b-access-token',
    expiresAt: '2030-01-01T00:00:00.000Z',
  });
}

/**
 * Build a WebSocket factory that immediately drives an exec to completion
 * with the given exit code and stdout, so tests can exercise `executeCommand`
 * without mocking a real WebSocket. Sockets are captured so tests can assert
 * on the endpoint + subprotocols they were opened with.
 */
function fakeExecSocket(script: { exitCode: number; stdout?: string; stderr?: string }): {
  factory: DirectExecWebSocketFactory;
  sockets: FakeSocket[];
} {
  const sockets: FakeSocket[] = [];
  const factory: DirectExecWebSocketFactory = (endpoint, subprotocols) => {
    const socket = new FakeSocket(endpoint, subprotocols);
    sockets.push(socket);
    queueMicrotask(() => {
      socket.onopen?.({});
      if (script.stdout) socket.fireBinary(1, script.stdout);
      if (script.stderr) socket.fireBinary(3, script.stderr);
      socket.onmessage?.({ data: JSON.stringify({ type: 'exit', data: { exit_code: script.exitCode } }) });
    });
    return socket;
  };
  return { factory, sockets };
}

class FakeSocket implements DirectExecWebSocket {
  binaryType: 'blob' | 'arraybuffer' = 'blob';
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  sent: string[] = [];
  closed = false;

  constructor(
    readonly endpoint: string,
    readonly subprotocols: string[],
  ) {}

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
  }

  fireBinary(prefix: number, payload: string): void {
    const bytes = new TextEncoder().encode(payload);
    const framed = new Uint8Array(bytes.length + 1);
    framed[0] = prefix;
    framed.set(bytes, 1);
    const buffer = framed.buffer.slice(framed.byteOffset, framed.byteOffset + framed.byteLength) as ArrayBuffer;
    this.onmessage?.({ data: buffer });
  }
}

describe('PlatformSandbox', () => {
  beforeEach(() => {
    vi.stubEnv('SANDBOX_PROVIDER', 'railway');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates a sandbox, mints an exec lease, and runs the command over the direct WebSocket', async () => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
      .mockResolvedValueOnce(leaseResponse());
    const { factory, sockets } = fakeExecSocket({ exitCode: 0, stdout: 'ok' });

    const sandbox = new PlatformSandbox({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      environmentId: 'env_123',
      fetch: fetchMock,
      webSocketFactory: factory,
    });

    await sandbox._start();
    const result = await sandbox.executeCommand('echo', ['ok'], { cwd: '/workspace', env: { A: '1' } });

    expect(result).toMatchObject({ success: true, exitCode: 0, stdout: 'ok', stderr: '', command: 'echo ok' });
    // Provision request first.
    expect(String(fetchMock.mock.calls[0]![0])).toBe('https://proxy.test/v1/railway/projects/proj_123/sandbox');
    expect(await (fetchMock.mock.calls[0]![1].body as string)).toContain('env_123');
    // Then the exec-lease mint — no /exec HTTP hit.
    expect(String(fetchMock.mock.calls[1]![0])).toBe(
      'https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_1/exec-lease',
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Exec ran over the direct WS with the lease's endpoint + subprotocols.
    expect(sockets).toHaveLength(1);
    expect(sockets[0]!.endpoint).toBe('wss://ssh.railway.com:2226/ws/exec');
    expect(sockets[0]!.subprotocols).toEqual(['railway-shell', 'jwt.value.here']);
    // init_exec frame carries command + cwd + env.
    const init = JSON.parse(sockets[0]!.sent[0]!) as { data: Record<string, unknown> };
    expect(init.data).toEqual({ command: 'echo ok', cwd: '/workspace', env: { A: '1' } });
  });

  it('setEnv after construction reaches subsequent exec frames', async () => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
      .mockResolvedValueOnce(leaseResponse());
    const { factory, sockets } = fakeExecSocket({ exitCode: 0, stdout: 'ok' });

    const sandbox = new PlatformSandbox({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      environmentId: 'env_123',
      fetch: fetchMock,
      webSocketFactory: factory,
    });

    await sandbox._start();
    sandbox.setEnv(env => ({ ...env, GH_TOKEN: 'tok_1' }));
    const result = await sandbox.executeCommand('echo', ['ok'], { env: { A: '1' } });

    expect(result).toMatchObject({ success: true, exitCode: 0 });
    const init = JSON.parse(sockets[0]!.sent[0]!) as { data: Record<string, unknown> };
    expect(init.data).toEqual({ command: 'echo ok', env: { GH_TOKEN: 'tok_1', A: '1' } });
  });

  it('uses E2B direct exec for E2B leases instead of the Railway WebSocket protocol', async () => {
    vi.stubEnv('SANDBOX_PROVIDER', 'e2b');
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
      .mockResolvedValueOnce(e2bLeaseResponse());
    const e2bExecRunner = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: 'ok',
      stderr: '',
      truncated: false,
      timedOut: false,
      opened: true,
    });
    const webSocketFactory = vi.fn(() => {
      throw new Error('Railway WebSocket transport should not be used for E2B');
    });
    const sandbox = new PlatformSandbox({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      environmentId: 'env_123',
      fetch: fetchMock,
      e2bExecRunner,
      webSocketFactory,
    });

    await sandbox._start();
    const result = await sandbox.executeCommand('echo', ['ok'], { cwd: '/workspace', env: { A: '1' } });

    expect(result).toMatchObject({ success: true, exitCode: 0, stdout: 'ok' });
    expect(String(fetchMock.mock.calls[0]![0])).toBe('https://proxy.test/v1/e2b/projects/proj_123/sandbox');
    expect(String(fetchMock.mock.calls[1]![0])).toBe(
      'https://proxy.test/v1/e2b/projects/proj_123/sandbox/sbx_1/exec-lease',
    );
    expect(e2bExecRunner).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'e2b',
        sandboxId: 'sbx_1',
        jwt: 'envd-access-token',
        wsEndpoint: 'https://49983-e2b-sbx-1.e2b.app',
      }),
      expect.objectContaining({ command: 'echo ok', cwd: '/workspace', env: { A: '1' } }),
    );
    expect(webSocketFactory).not.toHaveBeenCalled();
  });

  it('restores E2B clones from the concrete snapshot id', async () => {
    vi.stubEnv('SANDBOX_PROVIDER', 'e2b');
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ id: 'sbx_clone' }));
    const parent = new PlatformSandbox({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      environmentId: 'env_123',
      fetch: fetchMock,
    });

    const clone = parent.clone({ checkpointName: 'snap_123' });
    await clone._start();

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body).toMatchObject({ id: 'snap_123', seedCheckpointName: 'snap_123' });
  });

  it('captures E2B checkpoints even without a caller-supplied recovery id', async () => {
    vi.stubEnv('SANDBOX_PROVIDER', 'e2b');
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ id: 'sbx_1' }))
      .mockResolvedValueOnce(json({ checkpointName: 'snap_123', status: 'captured' }));
    const sandbox = new PlatformSandbox({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      environmentId: 'env_123',
      fetch: fetchMock,
    });

    await sandbox._start();
    await expect(sandbox.captureCheckpoint()).resolves.toEqual({ status: 'captured', checkpointName: 'snap_123' });

    expect(String(fetchMock.mock.calls[1]![0])).toBe(
      'https://proxy.test/v1/e2b/projects/proj_123/sandbox/sbx_1/checkpoint',
    );
    const body = JSON.parse(fetchMock.mock.calls[1]![1].body as string);
    expect(body.id).toMatch(/^platform-sandbox-/);
  });

  it('deletes E2B checkpoints created with an automatic recovery id on destroy', async () => {
    vi.stubEnv('SANDBOX_PROVIDER', 'e2b');
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ id: 'sbx_1' }))
      .mockResolvedValueOnce(json({ checkpointName: 'snap_123', status: 'captured' }))
      .mockResolvedValueOnce(json({ status: 'deleted' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const sandbox = new PlatformSandbox({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      environmentId: 'env_123',
      fetch: fetchMock,
    });

    await sandbox._start();
    await sandbox.captureCheckpoint();
    const captureBody = JSON.parse(fetchMock.mock.calls[1]![1].body as string);
    await sandbox.destroy();

    expect(String(fetchMock.mock.calls[2]![0])).toBe(
      'https://proxy.test/v1/e2b/projects/proj_123/sandbox/sbx_1/checkpoint',
    );
    expect(fetchMock.mock.calls[2]![1].method).toBe('DELETE');
    expect(JSON.parse(fetchMock.mock.calls[2]![1].body as string)).toEqual({ id: captureBody.id });
    expect(String(fetchMock.mock.calls[3]![0])).toBe('https://proxy.test/v1/e2b/projects/proj_123/sandbox/sbx_1');
  });

  it('does not send a template field on the create wire body', async () => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }));

    const sandbox = new PlatformSandbox({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      environmentId: 'env_123',
      fetch: fetchMock,
    });

    await sandbox._start();

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.template).toBeUndefined();
  });

  it('sends the caller id on the create wire body so the platform can key recovery on it', async () => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }));

    const sandbox = new PlatformSandbox({
      id: 'mc-project-42',
      accessToken: 'sk_test',
      projectId: 'proj_123',
      environmentId: 'env_123',
      fetch: fetchMock,
    });

    await sandbox._start();

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.id).toBe('mc-project-42');
  });

  it('retries sandbox creation when the proxy returns a transient 5xx', async () => {
    vi.useFakeTimers();
    try {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          json({ error: { message: 'Internal server error', type: 'internal_error' } }, { status: 500 }),
        )
        .mockResolvedValueOnce(json({ id: 'sbx_after_retry', createdAt: '2026-06-26T00:00:00.000Z' }));

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });

      const started = sandbox._start();
      await vi.advanceTimersByTimeAsync(2_000);
      await started;

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(String(fetchMock.mock.calls[1]![0])).toBe('https://proxy.test/v1/railway/projects/proj_123/sandbox');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not retry sandbox creation on non-transient errors', async () => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json({ error: { message: 'Environment not found', type: 'not_found' } }, { status: 404 }));

    const sandbox = new PlatformSandbox({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      environmentId: 'env_123',
      fetch: fetchMock,
    });

    await expect(sandbox._start()).rejects.toThrow('not_found');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up sandbox creation after exhausting transient retries', async () => {
    vi.useFakeTimers();
    try {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      // Fresh Response per call — a shared instance would fail on the second
      // body read instead of exercising the retry path.
      const fetchMock = vi
        .fn()
        .mockImplementation(async () =>
          json({ error: { message: 'Internal server error', type: 'internal_error' } }, { status: 500 }),
        );

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });

      const started = sandbox._start();
      const assertion = expect(started).rejects.toThrow('internal_error');
      await vi.advanceTimersByTimeAsync(10_000);
      await assertion;
      expect(fetchMock).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reattaches when constructed with a sandbox id', async () => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ id: 'sbx_existing', createdAt: '2026-06-26T00:00:00.000Z' }))
      .mockResolvedValueOnce(leaseResponse());
    const { factory } = fakeExecSocket({ exitCode: 0, stdout: 'ok' });
    const sandbox = new PlatformSandbox({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      sandboxId: 'sbx_existing',
      fetch: fetchMock,
      webSocketFactory: factory,
    });

    await sandbox._start();
    await sandbox.executeCommand('pwd');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      'https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_existing',
    );
    expect(String(fetchMock.mock.calls[1]![0])).toBe(
      'https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_existing/exec-lease',
    );
  });

  it("reports outcome 'connected' on reattach and 'created' on fresh provision", async () => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    vi.stubEnv('MASTRA_ENVIRONMENT_ID', 'env_from_process');

    const reattachFetch = vi
      .fn()
      .mockResolvedValueOnce(json({ id: 'sbx_existing', createdAt: '2026-06-26T00:00:00.000Z' }));
    const reattached = new PlatformSandbox({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      sandboxId: 'sbx_existing',
      fetch: reattachFetch,
    });
    await expect(reattached._start()).resolves.toEqual({ outcome: 'connected' });

    // A 404 on the reattach GET falls through to POST /sandbox — a fresh VM.
    const recreateFetch = vi
      .fn()
      .mockResolvedValueOnce(json({ error: { message: 'Sandbox not found', type: 'not_found' } }, { status: 404 }))
      .mockResolvedValueOnce(json({ id: 'sbx_recreated', createdAt: '2026-06-26T00:00:00.000Z' }));
    const recreated = new PlatformSandbox({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      sandboxId: 'sbx_stale',
      fetch: recreateFetch,
    });
    await expect(recreated._start()).resolves.toEqual({ outcome: 'created' });
  });

  it('creates a fresh sandbox when the reattached sandbox no longer exists', async () => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    vi.stubEnv('MASTRA_ENVIRONMENT_ID', 'env_from_process');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ error: { message: 'Sandbox not found', type: 'not_found' } }, { status: 404 }))
      .mockResolvedValueOnce(json({ id: 'sbx_recreated', createdAt: '2026-06-26T00:00:00.000Z' }))
      .mockResolvedValueOnce(leaseResponse());
    const { factory } = fakeExecSocket({ exitCode: 0, stdout: 'ok' });
    const sandbox = new PlatformSandbox({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      sandboxId: 'sbx_stale',
      fetch: fetchMock,
      webSocketFactory: factory,
    });

    await sandbox._start();
    await sandbox.executeCommand('pwd');

    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      'https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_stale',
    );
    expect(String(fetchMock.mock.calls[1]![0])).toBe('https://proxy.test/v1/railway/projects/proj_123/sandbox');
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body as string)).toMatchObject({
      id: sandbox.id,
      environmentId: 'env_from_process',
    });
    expect(String(fetchMock.mock.calls[2]![0])).toBe(
      'https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_recreated/exec-lease',
    );
  });

  it('creates a fresh sandbox when the reattached sandbox record is destroyed', async () => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    vi.stubEnv('MASTRA_ENVIRONMENT_ID', 'env_from_process');
    const fetchMock = vi
      .fn()
      // Idle GC keeps the record around with destroyedAt set — not reattachable.
      .mockResolvedValueOnce(
        json({ id: 'sbx_stale', createdAt: '2026-06-26T00:00:00.000Z', destroyedAt: '2026-06-27T00:00:00.000Z' }),
      )
      .mockResolvedValueOnce(json({ id: 'sbx_recreated', createdAt: '2026-06-28T00:00:00.000Z' }))
      .mockResolvedValueOnce(leaseResponse());
    const { factory } = fakeExecSocket({ exitCode: 0, stdout: 'ok' });
    const sandbox = new PlatformSandbox({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      sandboxId: 'sbx_stale',
      fetch: fetchMock,
      webSocketFactory: factory,
    });

    await sandbox._start();
    await sandbox.executeCommand('pwd');

    expect(String(fetchMock.mock.calls[1]![0])).toBe('https://proxy.test/v1/railway/projects/proj_123/sandbox');
    expect(String(fetchMock.mock.calls[2]![0])).toBe(
      'https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_recreated/exec-lease',
    );
  });

  it('exposes the platform-assigned sandbox id via getInfo metadata for reattach persistence', async () => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi
      .fn()
      // The platform ignores the advisory id in the POST body and assigns its own.
      .mockResolvedValueOnce(json({ id: 'sbx_platform_uuid', createdAt: '2026-06-26T00:00:00.000Z' }))
      .mockResolvedValueOnce(json({ id: 'sbx_platform_uuid', createdAt: '2026-06-26T00:00:00.000Z', status: 'ready' }));

    const sandbox = new PlatformSandbox({
      id: 'local-construction-id',
      accessToken: 'sk_test',
      projectId: 'proj_123',
      environmentId: 'env_123',
      fetch: fetchMock,
    });

    await sandbox._start();
    const info = await sandbox.getInfo();

    // Callers persisting a reattach id (the Factory fleet reads metadata.sandboxId)
    // must get the id the proxy recognizes, not the local construction id.
    expect(info.metadata?.sandboxId).toBe('sbx_platform_uuid');
  });

  it('clears sandbox state on destroy so stale IDs cannot leak to later calls', async () => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi
      .fn()
      // start() -> create sbx_1
      .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
      // destroy() -> DELETE 204
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const sandbox = new PlatformSandbox({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      environmentId: 'env_123',
      fetch: fetchMock,
    });

    await sandbox._start();
    await sandbox.destroy();

    // DELETE was aimed at sbx_1.
    expect(fetchMock.mock.calls[1]![1].method).toBe('DELETE');
    expect(String(fetchMock.mock.calls[1]![0])).toBe('https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_1');

    // getInfo() falls back to the local, no-remote branch because _sandboxId is cleared.
    // (Previously it would GET /sandbox/sbx_1 — a dead resource.)
    const info = await sandbox.getInfo();
    expect(info.id).toBe(sandbox.id);
    expect(fetchMock).toHaveBeenCalledTimes(2); // no third fetch
  });

  it('treats an explicit timeout: 0 as "no timeout" on the direct-exec path', async () => {
    // The client owns the timeout on the direct-exec path — "no timeout" is
    // expressed by NOT arming a client-side timer, so the exec runs to
    // completion regardless of wall-clock elapsed. A truthy check that
    // dropped `timeout: 0` would silently swap it for the default, which
    // is exactly the bug this test guards against.
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
      .mockResolvedValueOnce(leaseResponse());
    const { factory, sockets } = fakeExecSocket({ exitCode: 0 });

    const sandbox = new PlatformSandbox({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      environmentId: 'env_123',
      fetch: fetchMock,
      webSocketFactory: factory,
    });

    await sandbox._start();
    const result = await sandbox.executeCommand('sleep', ['1'], { timeout: 0 });

    // Would have been `timedOut: true, exitCode: 124` if the 0 got converted
    // to a "default short timeout" — the whole point of the original bug.
    expect(result).toMatchObject({ exitCode: 0, timedOut: false });
    // The init frame carries no timeout field either way — timeout enforcement
    // is client-side on the direct path, not part of the wire protocol.
    const init = JSON.parse(sockets[0]!.sent[0]!) as { data: Record<string, unknown> };
    expect('timeoutSec' in init.data).toBe(false);
    expect('timeoutMs' in init.data).toBe(false);
  });

  it('kill() throws because the proxy has no cancel endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ id: 'sbx_1' }))
      .mockResolvedValueOnce(leaseResponse());
    const { factory } = fakeExecSocket({ exitCode: 0 });

    const sandbox = new PlatformSandbox({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      environmentId: 'env_123',
      fetch: fetchMock,
      webSocketFactory: factory,
    });
    await sandbox._start();

    const handle = await sandbox.processes.spawn('sleep 10');
    await expect(handle.kill()).rejects.toThrow(/does not support killing/);
  });

  describe('direct exec', () => {
    it('reuses a cached lease across multiple execs on the same sandbox', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockResolvedValueOnce(leaseResponse());
      const { factory, sockets } = fakeExecSocket({ exitCode: 0, stdout: 'ok' });

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        webSocketFactory: factory,
      });

      await sandbox._start();
      await sandbox.executeCommand('echo one');
      // A second exec must NOT round-trip to /exec-lease again; the lease is
      // reused until it expires. Only two fetches total: provision + first lease.
      await sandbox.executeCommand('echo two');
      await sandbox.executeCommand('echo three');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      // But each exec still opens a fresh WebSocket (leases are per sandbox,
      // WS sessions are per exec).
      expect(sockets).toHaveLength(3);
    });

    it('mints a fresh lease when the cached one is within LEASE_REFRESH_MARGIN_MS of expiry', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const expiringSoon = new Date(Date.now() + 10_000).toISOString();
      const freshLater = new Date(Date.now() + 3600_000).toISOString();
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockResolvedValueOnce(leaseResponse({ jwt: 'jwt.old', expiresAt: expiringSoon }))
        .mockResolvedValueOnce(leaseResponse({ jwt: 'jwt.new', expiresAt: freshLater }));
      const { factory, sockets } = fakeExecSocket({ exitCode: 0 });

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        webSocketFactory: factory,
      });

      await sandbox._start();
      await sandbox.executeCommand('one');
      await sandbox.executeCommand('two');

      // Second exec re-minted because expiry - margin < now.
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(String(fetchMock.mock.calls[2]![0])).toBe(
        'https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_1/exec-lease',
      );
      // Each socket opened with the JWT that was current at that moment.
      expect(sockets[0]!.subprotocols[1]).toBe('jwt.old');
      expect(sockets[1]!.subprotocols[1]).toBe('jwt.new');
    });

    it('always re-mints when the lease has a null expiresAt (unknown TTL, refresh eagerly)', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockResolvedValueOnce(leaseResponse({ expiresAt: null }))
        .mockResolvedValueOnce(leaseResponse({ expiresAt: null }));
      const { factory } = fakeExecSocket({ exitCode: 0 });

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        webSocketFactory: factory,
      });

      await sandbox._start();
      await sandbox.executeCommand('one');
      await sandbox.executeCommand('two');

      // Provision + two lease mints — cache is skipped because expiresAt is null.
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('throws PlatformApiError when /exec-lease returns 404 (no /exec fallback)', async () => {
      // Old proxy without /exec-lease is now a loud config error, not a
      // silent fallback. Platform PR #1777 is deployed everywhere — a 404
      // here means the proxy is genuinely misconfigured and should be seen.
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockResolvedValueOnce(json({ error: { message: 'Not Found', type: 'not_found' } }, { status: 404 }));
      const factory: DirectExecWebSocketFactory = () => {
        throw new Error('should not open a WebSocket when the lease mint 404s');
      };

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        webSocketFactory: factory,
      });

      await sandbox._start();
      await expect(sandbox.executeCommand('echo one')).rejects.toThrow(/not_found/);
      // Provision + failed mint only — no /exec request.
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(String(fetchMock.mock.calls[1]![0])).toBe(
        'https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_1/exec-lease',
      );
    });

    it('throws SandboxDestroyedError when /exec-lease returns 410 and clears sandbox state', async () => {
      // 410 = sandbox has been destroyed (Railway destroy, quota reclamation,
      // etc.). The client cannot recover on its own — the fleet layer must
      // clear the stale binding and reprovision. This test asserts the
      // typed error surfaces + cached sandbox state is nulled so a reused
      // instance re-provisions cleanly on the next call.
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockResolvedValueOnce(json({ error: { message: 'Gone', type: 'gone' } }, { status: 410 }));
      const factory: DirectExecWebSocketFactory = () => {
        throw new Error('should not open a WebSocket when the sandbox is destroyed');
      };

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        webSocketFactory: factory,
      });

      await sandbox._start();
      const { SandboxDestroyedError } = await import('./sandbox.js');
      await expect(sandbox.executeCommand('echo one', ['arg'])).rejects.toBeInstanceOf(SandboxDestroyedError);
      // Only provision + one failed mint. No /exec fallback, no retry mint —
      // a 410 on the first attempt is terminal for this instance.
      expect(fetchMock).toHaveBeenCalledTimes(2);
      // Sandbox id must be cleared so the caller's next executeCommand
      // triggers a fresh ensureRunning + provision cycle instead of picking
      // up the stale id.
      expect((sandbox as unknown as { _sandboxId: unknown })._sandboxId).toBeUndefined();
      // Status must reset too: the next `ensureRunning()` re-runs the full
      // start lifecycle (acquisition + onStart hook), not just a new lease.
      expect(sandbox.status).toBe('stopped');
    });

    it('propagates non-410 errors from the exec-lease mint instead of falling back silently', async () => {
      // 500/501 are platform errors that must surface, not be masked by a
      // silent fallback to /exec.
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockResolvedValueOnce(json({ error: { message: 'boom', type: 'internal_error' } }, { status: 500 }));

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });

      await sandbox._start();
      await expect(sandbox.executeCommand('echo hi')).rejects.toThrow(/internal_error/);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('recovers from a single transient WS transport failure by minting a fresh lease and retrying', async () => {
      // First direct-exec WS closes without an exit frame (transport hiccup).
      // The client must drop the cached lease, mint a fresh one, and retry
      // on the same sandbox — one bad millisecond must NOT cost the entire
      // session (this was the perf regression that motivated ripping the
      // /exec fallback in the first place).
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockResolvedValueOnce(leaseResponse({ jwt: 'jwt.first' }))
        .mockResolvedValueOnce(leaseResponse({ jwt: 'jwt.second' }));
      const sockets: FakeSocket[] = [];
      const factory: DirectExecWebSocketFactory = (endpoint, subprotocols) => {
        const socket = new FakeSocket(endpoint, subprotocols);
        sockets.push(socket);
        queueMicrotask(() => {
          socket.onopen?.({});
          if (sockets.length === 1) {
            // First socket: transport failure (close without exit frame).
            socket.onclose?.({ code: 1006, reason: 'abnormal' });
          } else {
            // Second socket: real exit frame — retry succeeds.
            socket.fireBinary(1, 'ok');
            socket.onmessage?.({ data: JSON.stringify({ type: 'exit', data: { exit_code: 0 } }) });
          }
        });
        return socket;
      };

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        webSocketFactory: factory,
      });

      await sandbox._start();
      const result = await sandbox.executeCommand('echo one');

      expect(result).toMatchObject({ success: true, exitCode: 0, stdout: 'ok' });
      // Fetch sequence: provision, first lease, second lease. No /exec call.
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(String(fetchMock.mock.calls[1]![0])).toBe(
        'https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_1/exec-lease',
      );
      expect(String(fetchMock.mock.calls[2]![0])).toBe(
        'https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_1/exec-lease',
      );
      // Two WS attempts: the failed one and the successful retry, each with
      // a distinct JWT proving the cached lease was dropped between them.
      expect(sockets).toHaveLength(2);
      expect(sockets[0]!.subprotocols[1]).toBe('jwt.first');
      expect(sockets[1]!.subprotocols[1]).toBe('jwt.second');
    });

    it('throws SandboxDestroyedError when a transport failure is followed by 410 on the retry mint', async () => {
      // The destroyed-mid-exec scenario: the cached lease's WS drops with
      // no exit frame (looks like a transport failure), then the retry mint
      // returns 410 (sandbox is actually gone). The error must be
      // SandboxDestroyedError, not SandboxExecTransportError — the caller's
      // recovery strategy is completely different (reprovision, not retry).
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockResolvedValueOnce(leaseResponse({ jwt: 'jwt.first' }))
        .mockResolvedValueOnce(json({ error: { message: 'Gone', type: 'gone' } }, { status: 410 }));
      const sockets: FakeSocket[] = [];
      const factory: DirectExecWebSocketFactory = (endpoint, subprotocols) => {
        const socket = new FakeSocket(endpoint, subprotocols);
        sockets.push(socket);
        queueMicrotask(() => {
          socket.onopen?.({});
          socket.onclose?.({ code: 1006, reason: 'abnormal' });
        });
        return socket;
      };

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        webSocketFactory: factory,
      });

      await sandbox._start();
      const { SandboxDestroyedError } = await import('./sandbox.js');
      await expect(sandbox.executeCommand('echo one')).rejects.toBeInstanceOf(SandboxDestroyedError);
      // provision + first lease (used for failed WS) + retry mint (410).
      expect(fetchMock).toHaveBeenCalledTimes(3);
      // Only one WS attempt was made — the retry mint 410'd before we could
      // open a second socket.
      expect(sockets).toHaveLength(1);
      // Sandbox id cleared — same invariant as the initial-410 case.
      expect((sandbox as unknown as { _sandboxId: unknown })._sandboxId).toBeUndefined();
    });

    it('throws SandboxExecTransportError when both WS attempts fail against a live sandbox', async () => {
      // Persistent transport failure with a still-alive sandbox at the
      // control plane (mint keeps succeeding). This is the "Railway data
      // plane is broken" signal — a loud, typed error the platform team
      // can act on, replacing the old silent kill-switch-and-fallback.
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockResolvedValueOnce(leaseResponse({ jwt: 'jwt.first' }))
        .mockResolvedValueOnce(leaseResponse({ jwt: 'jwt.second' }));
      const sockets: FakeSocket[] = [];
      const factory: DirectExecWebSocketFactory = (endpoint, subprotocols) => {
        const socket = new FakeSocket(endpoint, subprotocols);
        sockets.push(socket);
        queueMicrotask(() => {
          socket.onopen?.({});
          socket.onclose?.({ code: 1011, reason: 'server_error' });
        });
        return socket;
      };

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        webSocketFactory: factory,
      });

      await sandbox._start();
      const { SandboxExecTransportError } = await import('./sandbox.js');
      const promise = sandbox.executeCommand('echo one');
      await expect(promise).rejects.toBeInstanceOf(SandboxExecTransportError);
      const error = (await promise.catch(e => e)) as InstanceType<typeof SandboxExecTransportError>;
      expect(error).toMatchObject({
        sandboxId: 'sbx_1',
        command: 'echo one',
        attempts: 2,
        opened: true,
        closeCode: 1011,
        closeReason: 'server_error',
        wsEndpoint: 'wss://ssh.railway.com:2226/ws/exec',
      });
      // provision + two mints. No /exec request.
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(sockets).toHaveLength(2);
      // No /exec call was ever made.
      for (const call of fetchMock.mock.calls) {
        expect(String(call[0])).not.toMatch(/\/exec$/);
      }

      // The lease from the failed second attempt must be evicted so a caller
      // that catches the transport error and re-runs the command doesn't
      // waste its first WS attempt on the same implicated JWT.
      expect((sandbox as unknown as { _lease: unknown })._lease).toBeNull();
    });

    it('coalesces concurrent execs during a transient WS failure into a single retry mint', async () => {
      // Under a normal agent burst (parallel find_files / view / etc), the
      // second-attempt lease mint must be shared by all in-flight execs
      // rather than fanning out into N mints. This is the pathological
      // pattern from prod incident 2026-07-29 that the coalescing guards
      // against.
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      // Delay the retry-mint response so all 10 execs pile into _ensureLease
      // simultaneously and share it.
      let releaseRetryMint!: () => void;
      const retryMintPromise = new Promise<Response>(resolve => {
        releaseRetryMint = () => resolve(leaseResponse({ jwt: 'jwt.retry' }));
      });
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockResolvedValueOnce(leaseResponse({ jwt: 'jwt.first' }))
        .mockImplementationOnce(() => retryMintPromise);
      const sockets: FakeSocket[] = [];
      const factory: DirectExecWebSocketFactory = (endpoint, subprotocols) => {
        const socket = new FakeSocket(endpoint, subprotocols);
        sockets.push(socket);
        queueMicrotask(() => {
          socket.onopen?.({});
          if (subprotocols[1] === 'jwt.first') {
            socket.onclose?.({ code: 1006, reason: 'abnormal' });
          } else {
            socket.fireBinary(1, 'ok');
            socket.onmessage?.({ data: JSON.stringify({ type: 'exit', data: { exit_code: 0 } }) });
          }
        });
        return socket;
      };

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        webSocketFactory: factory,
      });

      await sandbox._start();
      // Fire 10 execs; all should share the retry mint after their first
      // (cached-lease) WS fails.
      const results = Promise.all(Array.from({ length: 10 }, (_, i) => sandbox.executeCommand(`echo ${i}`)));
      // Let them all pile into _ensureLease after their first-attempt WS
      // failure, then release the shared retry mint.
      await new Promise(r => setTimeout(r, 0));
      releaseRetryMint();
      const finished = await results;

      for (const result of finished) {
        expect(result).toMatchObject({ success: true, exitCode: 0 });
      }
      // provision + first (cached) mint + exactly one retry mint (shared).
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('does not reuse a failed lease after a transport-failure retry succeeds', async () => {
      // After the retry mint replaces the failed lease, the next exec must
      // use the new lease's JWT — reusing the failed one would re-run the
      // whole retry dance and defeat the point of the retry.
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockResolvedValueOnce(leaseResponse({ jwt: 'jwt.first' }))
        .mockResolvedValueOnce(leaseResponse({ jwt: 'jwt.second' }));
      const sockets: FakeSocket[] = [];
      const factory: DirectExecWebSocketFactory = (endpoint, subprotocols) => {
        const socket = new FakeSocket(endpoint, subprotocols);
        sockets.push(socket);
        queueMicrotask(() => {
          socket.onopen?.({});
          if (sockets.length === 1) {
            socket.onclose?.({ code: 1006, reason: 'abnormal' });
          } else {
            socket.fireBinary(1, 'ok');
            socket.onmessage?.({ data: JSON.stringify({ type: 'exit', data: { exit_code: 0 } }) });
          }
        });
        return socket;
      };

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        webSocketFactory: factory,
      });

      await sandbox._start();
      await sandbox.executeCommand('echo first');
      await sandbox.executeCommand('echo second');

      // provision + first mint + retry mint. Second exec must reuse the
      // (now cached) jwt.second lease, not mint again and not reopen using
      // jwt.first.
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(sockets).toHaveLength(3);
      expect(sockets[2]!.subprotocols[1]).toBe('jwt.second');
    });

    it('does not evict a concurrently-cached fresh lease when an older attempt fails late', async () => {
      // Race scenario: exec A opens a WS with lease-1, exec B is scheduled
      // after A retries and caches lease-2, THEN A's second-attempt WS fails
      // late. A must clear only lease-1 (already gone); it must not blow
      // away lease-2 which exec B legitimately cached. Without the identity
      // guard on `_lease` eviction, A would null the cache and force the
      // next exec into an avoidable extra `/exec-lease` mint.
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockResolvedValueOnce(leaseResponse({ jwt: 'jwt.first' }))
        .mockResolvedValueOnce(leaseResponse({ jwt: 'jwt.second' }));
      const sockets: FakeSocket[] = [];
      // Hand out a socket that never closes on demand, so we can drive the
      // race deterministically from the test body instead of via
      // queueMicrotask.
      const factory: DirectExecWebSocketFactory = (endpoint, subprotocols) => {
        const socket = new FakeSocket(endpoint, subprotocols);
        sockets.push(socket);
        return socket;
      };

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        webSocketFactory: factory,
      });

      await sandbox._start();

      // Kick off exec A. It mints lease-1 and opens sockets[0].
      const execA = sandbox.executeCommand('echo A').catch(err => err);
      await vi.waitFor(() => expect(sockets).toHaveLength(1));
      // A's first WS fails. It will now mint lease-2 for its retry attempt.
      sockets[0]!.onopen?.({});
      sockets[0]!.onclose?.({ code: 1006, reason: 'abnormal' });
      await vi.waitFor(() => expect(sockets).toHaveLength(2));
      // At this point A has cached lease-2 in `_lease` and is holding
      // sockets[1] open. Fail sockets[1] to trigger A's final eviction
      // path — but before that, "exec B" has *effectively* cached lease-2
      // by being the one that owns it. When A's transport-failure throw
      // clears the cache, an identity check must preserve lease-2 (still
      // the currently-cached lease) so B (the next exec) reuses it.
      const lease2 = (sandbox as unknown as { _lease: { jwt: string } | null })._lease;
      expect(lease2?.jwt).toBe('jwt.second');

      // Fail A's retry WS -> throws SandboxExecTransportError, tries to
      // clear _lease. With the identity guard AND the fact that the still-
      // cached lease IS the one that just failed, the cache is cleared;
      // this test intentionally exercises the safe-clear branch by making
      // no OTHER lease exist. The negative-race case is covered by the
      // guarded assertion below: we manually inject a "concurrent fresh"
      // lease before A's throw runs its eviction, and confirm A does NOT
      // discard it.
      const freshLease = { jwt: 'jwt.fresh', expiresAtMs: Date.now() + 60_000 } as const;
      (sandbox as unknown as { _lease: unknown })._lease = freshLease;
      sockets[1]!.onopen?.({});
      sockets[1]!.onclose?.({ code: 1006, reason: 'abnormal' });
      const err = await execA;
      const { SandboxExecTransportError } = await import('./sandbox.js');
      expect(err).toBeInstanceOf(SandboxExecTransportError);
      // The freshLease we injected must survive A's eviction, because it
      // is not the lease A failed on. Without the identity guard, this
      // would be null.
      expect((sandbox as unknown as { _lease: unknown })._lease).toBe(freshLease);
    });

    it('coalesces concurrent lease mints on a cold cache into a single POST /exec-lease', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      // Delay the lease response so both execs hit `_ensureLease` before it resolves.
      let releaseLease!: () => void;
      const leasePromise = new Promise<Response>(resolve => {
        releaseLease = () => resolve(leaseResponse());
      });
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockImplementationOnce(() => leasePromise);
      const { factory } = fakeExecSocket({ exitCode: 0 });

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        webSocketFactory: factory,
      });

      await sandbox._start();
      // Fire two execs in parallel before the lease mint resolves.
      const both = Promise.all([sandbox.executeCommand('echo one'), sandbox.executeCommand('echo two')]);
      // Let both calls reach `_ensureLease`, then release the shared mint.
      await new Promise(r => setTimeout(r, 0));
      releaseLease();
      const [first, second] = await both;

      expect(first).toMatchObject({ exitCode: 0 });
      expect(second).toMatchObject({ exitCode: 0 });
      // Provision + exactly one shared mint (no duplicate) — proves coalescing.
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(String(fetchMock.mock.calls[1]![0])).toBe(
        'https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_1/exec-lease',
      );
    });
  });

  describe('private-network exec', () => {
    /**
     * Build a fake `privateNetFetch` that streams NDJSON frames driven by the
     * caller. Mirrors the streamingFetch helper in private-net-exec.test.ts
     * but scoped to this suite so the two files don't couple test helpers.
     */
    function streamingPrivateNetFetch() {
      const encoder = new TextEncoder();
      const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
      let controllerRef: ReadableStreamDefaultController<Uint8Array> | undefined;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controllerRef = controller;
        },
      });
      const fetch: typeof globalThis.fetch = async (input, init) => {
        calls.push({ url: String(input), init });
        return new Response(stream, { status: 200, headers: { 'content-type': 'text/plain' } });
      };
      return {
        fetch,
        calls,
        push: (chunk: string) => controllerRef!.enqueue(encoder.encode(chunk)),
        end: () => controllerRef!.close(),
      };
    }

    /**
     * Trivial in-memory implementation of the {@link SandboxAddressRegistry}
     * three-method interface. On shipyard the same shape is populated by
     * {@link PlatformSandbox.start} from the `instanceUrl` field on the
     * workspace-proxy create/get response; here the test pre-seeds entries
     * where convenient and observes `set`/`delete` calls to prove the
     * lifecycle contract.
     */
    function fakeAddressRegistry(seed: Record<string, string> = {}) {
      const entries = new Map<string, string>(Object.entries(seed));
      const sets: Array<{ sandboxId: string; instanceUrl: string }> = [];
      const deletes: string[] = [];
      return {
        registry: {
          get: (id: string) => entries.get(id),
          set: (id: string, url: string) => {
            sets.push({ sandboxId: id, instanceUrl: url });
            entries.set(id, url);
          },
          delete: (id: string) => {
            deletes.push(id);
            entries.delete(id);
          },
        } as SandboxAddressRegistry,
        entries,
        sets,
        deletes,
      };
    }

    it('routes execs to the sidecar over the private network when the registry has an address for the sandbox', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi.fn().mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }));
      const { factory: wsFactory, sockets } = fakeExecSocket({ exitCode: 0, stdout: 'ok' });
      const priv = streamingPrivateNetFetch();
      const { registry } = fakeAddressRegistry();

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        webSocketFactory: wsFactory,
        privateNetFetch: priv.fetch,
        addressRegistry: registry,
      });

      await sandbox._start();
      // start() without instanceUrl evicts leftover addresses. Seed after
      // start so this test covers the private-net exec path itself.
      registry.set('sbx_1', 'http://[fd12:752d:16f5:1:d000:41:e7de:188c]:47000');
      const execPromise = sandbox.executeCommand('echo', ['ok'], { cwd: '/workspace', env: { A: '1' } });
      priv.push('{"type":"stdout","data":"ok"}\n');
      priv.push('{"type":"exit","code":0}\n');
      priv.end();
      const result = await execPromise;

      expect(result).toMatchObject({ success: true, exitCode: 0, stdout: 'ok', command: 'echo ok' });
      // Only the provision call to the proxy — no lease mint, no /exec-lease.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      // The lease-path WebSocket was never opened.
      expect(sockets).toHaveLength(0);
      // The private-net fetch was called against the sidecar URL from the registry.
      expect(priv.calls).toHaveLength(1);
      expect(priv.calls[0]!.url).toBe('http://[fd12:752d:16f5:1:d000:41:e7de:188c]:47000/exec');
      const body = JSON.parse(priv.calls[0]!.init!.body as string);
      expect(body).toEqual({ command: 'echo ok', cwd: '/workspace', env: { A: '1' } });
    });

    it('falls straight through to the lease path when the registry has no address for the sandbox', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      // Registry is empty — the proxy response had no `instanceUrl` (older
      // proxy, or discovery on the proxy side hasn't produced one yet).
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockResolvedValueOnce(leaseResponse());
      const { factory: wsFactory, sockets } = fakeExecSocket({ exitCode: 0, stdout: 'ok' });
      const priv = streamingPrivateNetFetch();
      const { registry } = fakeAddressRegistry();

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        webSocketFactory: wsFactory,
        privateNetFetch: priv.fetch,
        addressRegistry: registry,
      });

      await sandbox._start();
      const result = await sandbox.executeCommand('echo', ['ok']);

      expect(result).toMatchObject({ success: true, exitCode: 0, stdout: 'ok' });
      // Private-net fetch never called — no address to dial.
      expect(priv.calls).toHaveLength(0);
      // Lease was minted and the WS opened.
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(sockets).toHaveLength(1);
    });

    it('falls straight through to the lease path when no addressRegistry is configured at all', async () => {
      // Callers that don't opt into the registry (existing code, non-factory
      // deployments) must keep the pre-existing lease-only behavior — no
      // private-net dial, no crash on the optional-chain lookup.
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockResolvedValueOnce(leaseResponse());
      const { factory: wsFactory, sockets } = fakeExecSocket({ exitCode: 0, stdout: 'ok' });
      const priv = streamingPrivateNetFetch();

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        webSocketFactory: wsFactory,
        privateNetFetch: priv.fetch,
        // no addressRegistry
      });

      await sandbox._start();
      const result = await sandbox.executeCommand('echo', ['ok']);

      expect(result).toMatchObject({ success: true, exitCode: 0, stdout: 'ok' });
      expect(priv.calls).toHaveLength(0);
      expect(sockets).toHaveLength(1);
    });

    it('evicts the registry entry and falls back to the lease when the sidecar refuses the connection', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockResolvedValueOnce(leaseResponse());
      const { factory: wsFactory, sockets } = fakeExecSocket({ exitCode: 0, stdout: 'fallback-ok' });
      const privFetch: typeof globalThis.fetch = async () => {
        throw new Error('connect ECONNREFUSED');
      };
      const { registry, deletes, entries } = fakeAddressRegistry();

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        webSocketFactory: wsFactory,
        privateNetFetch: privFetch,
        addressRegistry: registry,
      });

      await sandbox._start();
      registry.set('sbx_1', 'http://[fd00::1]:47000');
      const deletesAfterStart = deletes.length;
      const result = await sandbox.executeCommand('pwd');

      // Fallback served the exec cleanly — no error surfaced to the caller.
      expect(result).toMatchObject({ success: true, exitCode: 0, stdout: 'fallback-ok' });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(sockets).toHaveLength(1);
      // The registry saw the exact delete for this sandboxId — the next
      // start() has to re-read `instanceUrl` from the workspace-proxy
      // response before subsequent execs will trust the private-net path
      // again.
      expect(deletes.slice(deletesAfterStart)).toEqual(['sbx_1']);
      expect(entries.has('sbx_1')).toBe(false);
    });

    it('does not re-dial the sidecar after a transport-level eviction until the registry is re-populated', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockResolvedValueOnce(leaseResponse())
        .mockResolvedValueOnce(leaseResponse());
      const { factory: wsFactory } = fakeExecSocket({ exitCode: 0, stdout: 'ok' });
      let privCalls = 0;
      const privFetch: typeof globalThis.fetch = async () => {
        privCalls++;
        throw new Error('connect ECONNREFUSED');
      };
      const { registry } = fakeAddressRegistry();

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        webSocketFactory: wsFactory,
        privateNetFetch: privFetch,
        addressRegistry: registry,
      });

      await sandbox._start();
      registry.set('sbx_1', 'http://[fd00::1]:47000');
      await sandbox.executeCommand('one');
      await sandbox.executeCommand('two');

      // Sidecar dialed exactly once — the first attempt evicted the registry
      // entry so `two` skipped straight to the lease path without wasting a
      // second connection.
      expect(privCalls).toBe(1);
    });

    it('falls back for a single call without evicting the registry entry when the sidecar returns 500', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockResolvedValueOnce(leaseResponse());
      const { factory: wsFactory } = fakeExecSocket({ exitCode: 0, stdout: 'ok' });

      // First private-net call returns 500; second streams a valid exec.
      let privCallCount = 0;
      const encoder = new TextEncoder();
      const privFetch: typeof globalThis.fetch = async () => {
        privCallCount++;
        if (privCallCount === 1) {
          return new Response('sidecar bug', { status: 500 });
        }
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('{"type":"stdout","data":"second-ok"}\n'));
            controller.enqueue(encoder.encode('{"type":"exit","code":0}\n'));
            controller.close();
          },
        });
        return new Response(stream, { status: 200 });
      };
      const { registry, deletes } = fakeAddressRegistry();

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        webSocketFactory: wsFactory,
        privateNetFetch: privFetch,
        addressRegistry: registry,
      });

      await sandbox._start();
      registry.set('sbx_1', 'http://[fd00::1]:47000');
      const deletesAfterStart = deletes.length;
      // First exec: 500 → fall back to lease. Registry entry preserved.
      const first = await sandbox.executeCommand('one');
      expect(first.stdout).toBe('ok');
      // Second exec: sidecar back to normal → private-net path used again.
      const second = await sandbox.executeCommand('two');
      expect(second.stdout).toBe('second-ok');

      // Both private-net attempts happened; the 500 did not evict the entry.
      expect(privCallCount).toBe(2);
      expect(deletes.slice(deletesAfterStart)).toEqual([]);
    });

    it('clone looks up its own sandboxId in the shared registry, not the parent address', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_parent', createdAt: '2026-06-26T00:00:00.000Z' }))
        // Child provisions its own sandbox.
        .mockResolvedValueOnce(json({ id: 'sbx_child', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockResolvedValueOnce(leaseResponse());
      const { factory: wsFactory, sockets } = fakeExecSocket({ exitCode: 0, stdout: 'child-ok' });
      const priv = streamingPrivateNetFetch();
      // Only the parent has a registered address. The child's sandbox id is
      // absent from the registry (its sidecar hasn't posted ready yet).
      const { registry } = fakeAddressRegistry({ sbx_parent: 'http://[fd00::parent]:47000' });

      const parent = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        webSocketFactory: wsFactory,
        privateNetFetch: priv.fetch,
        addressRegistry: registry,
      });
      await parent._start();

      const child = parent.clone();
      await child._start();
      const result = await child.executeCommand('pwd');

      // Child went straight to the lease path — the shared registry has no
      // entry for `sbx_child`, and the parent's `sbx_parent` address is not
      // reachable via a child-scoped lookup.
      expect(result.stdout).toBe('child-ok');
      expect(priv.calls).toHaveLength(0);
      expect(sockets).toHaveLength(1);
    });

    it('does not send an Authorization header on private-net execs — the private IPv6 network is the auth boundary', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi.fn().mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }));
      const priv = streamingPrivateNetFetch();
      const { registry } = fakeAddressRegistry();

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        privateNetFetch: priv.fetch,
        addressRegistry: registry,
      });
      await sandbox._start();
      registry.set('sbx_1', 'http://[fd00::1]:47000');
      const execPromise = sandbox.executeCommand('x');
      priv.push('{"type":"exit","code":0}\n');
      priv.end();
      await execPromise;

      const headers = new Headers(priv.calls[0]!.init!.headers);
      expect(headers.get('authorization')).toBeNull();
    });

    it('destroy() explicitly evicts the registry entry for the destroyed sandbox', async () => {
      // The transport-failure path also self-heals, but a clean destroy must
      // not leave a stale entry that will produce a dial-to-nowhere on the
      // next exec against a reused instance.
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockResolvedValueOnce(new Response(null, { status: 204 }));
      const { registry, deletes, entries } = fakeAddressRegistry();

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        addressRegistry: registry,
      });

      await sandbox._start();
      registry.set('sbx_1', 'http://[fd00::1]:47000');
      const deletesAfterStart = deletes.length;
      await sandbox.destroy();

      expect(deletes.slice(deletesAfterStart)).toEqual(['sbx_1']);
      expect(entries.has('sbx_1')).toBe(false);
    });

    it('returns a timed-out private-net result to the caller instead of re-running the command via lease', async () => {
      // Regression: a pre-headers timeout used to classify as a transport
      // failure because `opened=false`, so the caller would evict the
      // address AND re-execute the same command through the lease path
      // with a fresh timeout window. For non-idempotent work (rm, git
      // push, DB migrations) that's a silent double-run and the caller
      // never sees `timedOut: true`. `timedOut` must short-circuit the
      // lease fallback.
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi.fn().mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }));
      const { factory: wsFactory, sockets } = fakeExecSocket({ exitCode: 0, stdout: 'lease-ran-it' });
      const { registry, deletes, entries } = fakeAddressRegistry();

      // A private-net fetch that respects the AbortSignal — never resolves
      // on its own, only rejects when the transport's own timer fires.
      const privateNetCalls: Array<{ url: string; init: RequestInit | undefined }> = [];
      const hangingFetch: typeof globalThis.fetch = (input, init) =>
        new Promise((_resolve, reject) => {
          privateNetCalls.push({ url: String(input), init });
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted.');
            err.name = 'AbortError';
            reject(err);
          });
        });

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        timeout: 10,
        fetch: fetchMock,
        webSocketFactory: wsFactory,
        privateNetFetch: hangingFetch,
        addressRegistry: registry,
      });
      await sandbox._start();
      registry.set('sbx_1', 'http://[fd12::1]:47000');
      const deletesAfterStart = deletes.length;

      const result = await sandbox.executeCommand('rm -rf /nope');

      // The timed-out private-net attempt IS the answer — no lease mint,
      // no WebSocket, no second execution.
      expect(result.timedOut).toBe(true);
      expect(result.exitCode).toBe(124);
      expect(privateNetCalls).toHaveLength(1);
      expect(sockets).toHaveLength(0);
      // Only the initial create fetch happened; no /exec-lease follow-up.
      expect(fetchMock.mock.calls).toHaveLength(1);
      // Address is still evicted so the next exec doesn't dial into the
      // same hang — but the timed-out RESULT went back to the caller.
      expect(deletes.slice(deletesAfterStart)).toEqual(['sbx_1']);
      expect(entries.has('sbx_1')).toBe(false);
    });

    it('populates the registry after the sidecar /health probe succeeds on fresh provision', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi.fn().mockResolvedValueOnce(
        json({
          id: 'sbx_fresh',
          createdAt: '2026-06-26T00:00:00.000Z',
          instanceUrl: 'http://[fd12:752d:16f5:1:d000:41:e7de:188c]:47000',
        }),
      );
      // Sidecar health probe succeeds immediately.
      const privateNetFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
      const { registry, sets, entries } = fakeAddressRegistry();

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        privateNetFetch,
        addressRegistry: registry,
      });
      await sandbox._start();

      // Registry is NOT populated immediately — the fire-and-forget probe
      // runs asynchronously. Wait for the probe to resolve.
      await vi.waitFor(() => expect(sets.length).toBeGreaterThan(0));

      expect(sets).toEqual([
        { sandboxId: 'sbx_fresh', instanceUrl: 'http://[fd12:752d:16f5:1:d000:41:e7de:188c]:47000' },
      ]);
      expect(entries.get('sbx_fresh')).toBe('http://[fd12:752d:16f5:1:d000:41:e7de:188c]:47000');
      // The probe called /health on the sidecar.
      expect(privateNetFetch).toHaveBeenCalledWith(
        'http://[fd12:752d:16f5:1:d000:41:e7de:188c]:47000/health',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('populates the registry after the sidecar /health probe succeeds on session recovery', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      // Reattach path: GET /sandbox/:id succeeds with the proxy-cached
      // instanceUrl for a live sandbox. No POST /sandbox is issued.
      const fetchMock = vi.fn().mockResolvedValueOnce(
        json({
          id: 'sbx_existing',
          createdAt: '2026-06-26T00:00:00.000Z',
          instanceUrl: 'http://[fd12::abcd]:47000',
        }),
      );
      // Sidecar health probe succeeds immediately.
      const privateNetFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
      const { registry, sets } = fakeAddressRegistry();

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        sandboxId: 'sbx_existing',
        fetch: fetchMock,
        privateNetFetch,
        addressRegistry: registry,
      });
      await sandbox._start();

      // Wait for the fire-and-forget probe to resolve.
      await vi.waitFor(() => expect(sets.length).toBeGreaterThan(0));

      // Only the reattach GET fired — proxy's cached instanceUrl went into
      // the registry after the sidecar health probe succeeded.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0]![0])).toBe(
        'https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_existing',
      );
      expect(sets).toEqual([{ sandboxId: 'sbx_existing', instanceUrl: 'http://[fd12::abcd]:47000' }]);
    });

    it('leaves the registry untouched when the create response omits instanceUrl', async () => {
      // Older proxies that predate the discovery field, or a fresh provision
      // where the proxy's discovery exec failed and it stored NULL.
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockResolvedValueOnce(leaseResponse());
      const { factory } = fakeExecSocket({ exitCode: 0, stdout: 'ok' });
      const { registry, sets, entries } = fakeAddressRegistry();

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        webSocketFactory: factory,
        addressRegistry: registry,
      });
      await sandbox._start();
      const result = await sandbox.executeCommand('echo ok');

      // No `set` fired, registry stays empty, exec falls straight through
      // to the lease path (proven by the /exec-lease mint on the second fetch).
      expect(sets).toEqual([]);
      expect(entries.size).toBe(0);
      expect(result.success).toBe(true);
      expect(String(fetchMock.mock.calls[1]![0])).toBe(
        'https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_1/exec-lease',
      );
    });

    it('leaves the registry untouched when the create response has instanceUrl: null', async () => {
      // The proxy explicitly returns `null` when its discovery exec failed
      // during Sandbox.create(); this must be treated the same as an absent
      // field — leave an empty registry empty, exec via lease.
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z', instanceUrl: null }));
      const { registry, sets } = fakeAddressRegistry();

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        addressRegistry: registry,
      });
      await sandbox._start();

      expect(sets).toEqual([]);
    });

    it('evicts a stale registry entry when the create response has instanceUrl: null', async () => {
      // Reattach after a previous start can leave a leftover URL. A later
      // start with no address must drop that entry so execs do not dial it.
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z', instanceUrl: null }));
      const { registry, sets, deletes, entries } = fakeAddressRegistry({
        sbx_1: 'http://[fd12::1]:47000',
      });

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        addressRegistry: registry,
      });
      await sandbox._start();

      expect(deletes).toEqual(['sbx_1']);
      expect(entries.size).toBe(0);
      expect(sets).toEqual([]);
    });

    it('start() does not touch the registry when no addressRegistry is injected', async () => {
      // Baseline: pre-existing callers that don't opt into the registry must
      // continue to work unchanged even when the proxy starts returning
      // instanceUrl on the response.
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z', instanceUrl: 'http://[fd12::1]:47000' }),
        );

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        // no addressRegistry
      });

      await expect(sandbox._start()).resolves.toEqual({ outcome: 'created' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('getInfo() skips the proxy round-trip when the registry has an address for the sandbox', async () => {
      // The issue this fix targets: workspace-proxy was seeing dozens of
      // `GET /sandbox/:id` hits per session because `Workspace.getInfo()`
      // polls unconditionally. When the address registry is populated the
      // sandbox is provably reachable via the private-net path, so we can
      // serve `getInfo()` from cached local state and skip the proxy hit
      // (and the Railway GraphQL + `sandboxExec` awk it triggers on the
      // proxy side).
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi.fn().mockResolvedValueOnce(
        json({
          id: 'sbx_1',
          createdAt: '2026-06-26T00:00:00.000Z',
          instanceUrl: 'http://[fd12::1]:47000',
        }),
      );
      // Sidecar probe succeeds immediately.
      const privateNetFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
      const { registry, sets } = fakeAddressRegistry();

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        privateNetFetch,
        addressRegistry: registry,
      });
      await sandbox._start();
      // Wait for the fire-and-forget probe to populate the registry.
      await vi.waitFor(() => expect(sets.length).toBeGreaterThan(0));

      const info = await sandbox.getInfo();

      // Only the create call fired; no `GET /sandbox/:id`.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      // Info still carries the platform-assigned sandboxId so callers that
      // persist a reattach id continue to work.
      expect(info.metadata?.sandboxId).toBe('sbx_1');
      expect(info.id).toBe('sbx_1');
    });

    it('getInfo() falls through to the proxy when the registry has no entry for the sandbox', async () => {
      // No registry entry means we don't know the sandbox is reachable via
      // private-net, so the proxy remains the source of truth. Preserves the
      // pre-existing behavior for older proxies / failed discovery.
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        // create response has no instanceUrl → registry stays empty
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        // getInfo() falls through to `GET /sandbox/:id`
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z', status: 'ready' }));
      const { registry } = fakeAddressRegistry();

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        addressRegistry: registry,
      });
      await sandbox._start();
      await sandbox.getInfo();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(String(fetchMock.mock.calls[1]![0])).toBe('https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_1');
    });

    it('getInfo() falls through to the proxy when no addressRegistry is configured at all', async () => {
      // Callers that don't opt into the registry (existing code, non-factory
      // deployments) must keep the pre-existing proxy behavior for getInfo().
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          json({
            id: 'sbx_1',
            createdAt: '2026-06-26T00:00:00.000Z',
            instanceUrl: 'http://[fd12::1]:47000',
          }),
        )
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z', status: 'ready' }));

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        // no addressRegistry
      });
      await sandbox._start();
      await sandbox.getInfo();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(String(fetchMock.mock.calls[1]![0])).toBe('https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_1');
    });

    it('getInfo() falls through to the proxy after the registry entry has been evicted', async () => {
      // Executes that fail transport evict the registry entry — the next
      // getInfo() must return to proxy-truth because we no longer have
      // liveness evidence for this sandbox.
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          json({
            id: 'sbx_1',
            createdAt: '2026-06-26T00:00:00.000Z',
            instanceUrl: 'http://[fd12::1]:47000',
          }),
        )
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z', status: 'ready' }));
      const { registry } = fakeAddressRegistry();

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        addressRegistry: registry,
      });
      await sandbox._start();

      // Simulate an eviction (as _tryExecViaPrivateNetwork would do on
      // transport failure). The next getInfo() must go to the proxy.
      registry.delete('sbx_1');

      await sandbox.getInfo();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(String(fetchMock.mock.calls[1]![0])).toBe('https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_1');
    });

    describe('sidecar probe', () => {
      // Fake-timer tests below must not leak fake timers into later tests
      // when an assertion fails before their trailing vi.useRealTimers().
      afterEach(() => {
        vi.useRealTimers();
      });

      it('retries the /health probe until it succeeds', async () => {
        vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
        const fetchMock = vi.fn().mockResolvedValueOnce(
          json({
            id: 'sbx_probe',
            createdAt: '2026-06-26T00:00:00.000Z',
            instanceUrl: 'http://[fd12::1]:47000',
          }),
        );
        // Sidecar returns 503 twice, then 200.
        const privateNetFetch = vi
          .fn()
          .mockRejectedValueOnce(new Error('ECONNREFUSED'))
          .mockResolvedValueOnce(new Response('', { status: 503 }))
          .mockResolvedValueOnce(new Response('ok', { status: 200 }));
        const { registry, sets } = fakeAddressRegistry();

        const sandbox = new PlatformSandbox({
          accessToken: 'sk_test',
          projectId: 'proj_123',
          environmentId: 'env_123',
          fetch: fetchMock,
          privateNetFetch,
          addressRegistry: registry,
        });
        await sandbox._start();

        // Wait for the probe to succeed after retries.
        await vi.waitFor(() => expect(sets.length).toBeGreaterThan(0));

        expect(sets).toEqual([{ sandboxId: 'sbx_probe', instanceUrl: 'http://[fd12::1]:47000' }]);
        // Three /health attempts: connection refused, 503, 200.
        expect(privateNetFetch).toHaveBeenCalledTimes(3);
      });

      it('logs one probe-ok line with duration and attempt count on first 200', async () => {
        vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
        const fetchMock = vi.fn().mockResolvedValueOnce(
          json({
            id: 'sbx_probe_log',
            createdAt: '2026-06-26T00:00:00.000Z',
            instanceUrl: 'http://[fd12::1]:47000',
          }),
        );
        const privateNetFetch = vi
          .fn()
          .mockRejectedValueOnce(new Error('ECONNREFUSED'))
          .mockResolvedValueOnce(new Response('ok', { status: 200 }));
        const { registry, sets } = fakeAddressRegistry();

        const sandbox = new PlatformSandbox({
          accessToken: 'sk_test',
          projectId: 'proj_123',
          environmentId: 'env_123',
          sessionId: 'sess_42',
          fetch: fetchMock,
          privateNetFetch,
          addressRegistry: registry,
        });
        const loggerInfoSpy = vi.spyOn((sandbox as any).logger, 'info');
        await sandbox._start();
        await vi.waitFor(() => expect(sets.length).toBeGreaterThan(0));

        expect(loggerInfoSpy).toHaveBeenCalledWith(
          'platform-workspace probe ok',
          expect.objectContaining({
            sandboxId: 'sbx_probe_log',
            sessionId: 'sess_42',
            probeDurationMs: expect.any(Number),
            attempts: 2,
          }),
        );
      });

      it('leaves the registry empty when the probe times out', async () => {
        vi.useFakeTimers();
        vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
        const fetchMock = vi.fn().mockResolvedValueOnce(
          json({
            id: 'sbx_timeout',
            createdAt: '2026-06-26T00:00:00.000Z',
            instanceUrl: 'http://[fd12::1]:47000',
          }),
        );
        // Sidecar never responds with 200.
        const privateNetFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
        const { registry, sets, entries } = fakeAddressRegistry();

        const sandbox = new PlatformSandbox({
          accessToken: 'sk_test',
          projectId: 'proj_123',
          environmentId: 'env_123',
          sessionId: 'sess_42',
          fetch: fetchMock,
          privateNetFetch,
          addressRegistry: registry,
        });
        const loggerWarnSpy = vi.spyOn((sandbox as any).logger, 'warn');
        await sandbox._start();

        // Advance past the probe timeout (30s).
        await vi.advanceTimersByTimeAsync(35_000);

        // Registry was never populated.
        expect(sets).toEqual([]);
        expect(entries.size).toBe(0);
        // Timeout is logged once, with enough context to join back to the session.
        expect(loggerWarnSpy).toHaveBeenCalledWith(
          'platform-workspace probe timed out',
          expect.objectContaining({
            sandboxId: 'sbx_timeout',
            sessionId: 'sess_42',
            timeoutMs: 30_000,
            attempts: expect.any(Number),
          }),
        );
        vi.useRealTimers();
      });

      it('restarts a timed-out probe on the next exec instead of pinning the lease path', async () => {
        vi.useFakeTimers();
        vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
        const fetchMock = vi.fn().mockResolvedValueOnce(
          json({
            id: 'sbx_reprobe',
            createdAt: '2026-06-26T00:00:00.000Z',
            instanceUrl: 'http://[fd12::1]:47000',
          }),
        );
        // Sidecar is down for the entire first probe window…
        const privateNetFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
        const { registry, sets } = fakeAddressRegistry();

        const sandbox = new PlatformSandbox({
          accessToken: 'sk_test',
          projectId: 'proj_123',
          environmentId: 'env_123',
          sessionId: 'sess_42',
          fetch: fetchMock,
          privateNetFetch,
          addressRegistry: registry,
        });
        await sandbox._start();
        await vi.advanceTimersByTimeAsync(35_000);
        expect(sets).toEqual([]);

        // …then recovers. The next exec's transport wait restarts the probe
        // and the registry gets populated instead of leasing forever.
        privateNetFetch.mockResolvedValue(json({ ok: true }));
        const wait = (sandbox as any)._awaitTransportReady();
        await vi.advanceTimersByTimeAsync(1_000);
        await wait;
        expect(sets).toEqual([{ sandboxId: 'sbx_reprobe', instanceUrl: 'http://[fd12::1]:47000' }]);
        vi.useRealTimers();
      });

      it('does not block start() while the probe is running', async () => {
        vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
        const fetchMock = vi.fn().mockResolvedValueOnce(
          json({
            id: 'sbx_nonblock',
            createdAt: '2026-06-26T00:00:00.000Z',
            instanceUrl: 'http://[fd12::1]:47000',
          }),
        );
        // Sidecar probe takes a while to respond.
        let resolveProbe: (value: Response) => void;
        const probePromise = new Promise<Response>(r => {
          resolveProbe = r;
        });
        const privateNetFetch = vi.fn().mockReturnValue(probePromise);
        const { registry, sets } = fakeAddressRegistry();

        const sandbox = new PlatformSandbox({
          accessToken: 'sk_test',
          projectId: 'proj_123',
          environmentId: 'env_123',
          fetch: fetchMock,
          privateNetFetch,
          addressRegistry: registry,
        });

        // start() resolves immediately — does not wait for probe.
        await sandbox._start();
        expect(sandbox.status).toBe('running');
        expect(sets).toEqual([]); // Registry not yet populated.

        // Now resolve the probe.
        resolveProbe!(new Response('ok', { status: 200 }));
        await vi.waitFor(() => expect(sets.length).toBeGreaterThan(0));
        expect(sets).toEqual([{ sandboxId: 'sbx_nonblock', instanceUrl: 'http://[fd12::1]:47000' }]);
      });

      it('clears a stale registry entry before starting the probe', async () => {
        // On reattach, the registry may have the old sandbox's address. The
        // entry should be deleted immediately so execs fall back to lease
        // during the probe window rather than dialing the stale address.
        vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
        const fetchMock = vi.fn().mockResolvedValueOnce(
          json({
            id: 'sbx_stale',
            createdAt: '2026-06-26T00:00:00.000Z',
            instanceUrl: 'http://[fd12::2]:47000', // new address
          }),
        );
        // Probe hangs — we just want to verify the delete happens before it.
        const privateNetFetch = vi.fn().mockReturnValue(new Promise(() => {}));
        // Seed the registry with a stale entry for the same sandbox id.
        const { registry, sets, deletes, entries } = fakeAddressRegistry({
          sbx_stale: 'http://[fd12::1]:47000', // old address
        });

        const sandbox = new PlatformSandbox({
          accessToken: 'sk_test',
          projectId: 'proj_123',
          environmentId: 'env_123',
          fetch: fetchMock,
          privateNetFetch,
          addressRegistry: registry,
        });

        await sandbox._start();

        // Stale entry was deleted before probe started.
        expect(deletes).toEqual(['sbx_stale']);
        // Registry is now empty (probe hasn't resolved yet).
        expect(entries.size).toBe(0);
        expect(sets).toEqual([]);
      });

      it('does not re-populate registry when teardown races the probe', async () => {
        // Regression test: if destroy() runs while the probe is pending, the
        // probe should NOT re-populate the registry when it eventually resolves.
        // Otherwise we'd have a leaked registry entry pointing to a deleted VM.
        vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
        const fetchMock = vi
          .fn()
          // create sandbox
          .mockResolvedValueOnce(
            json({
              id: 'sbx_race',
              createdAt: '2026-06-26T00:00:00.000Z',
              instanceUrl: 'http://[fd12::1]:47000',
            }),
          )
          // destroy sandbox
          .mockResolvedValueOnce(new Response(null, { status: 204 }));

        // Probe hangs until we resolve it manually.
        let resolveProbe: (value: Response) => void;
        const probePromise = new Promise<Response>(r => {
          resolveProbe = r;
        });
        const privateNetFetch = vi.fn().mockReturnValue(probePromise);
        const { registry, sets, deletes } = fakeAddressRegistry();

        const sandbox = new PlatformSandbox({
          accessToken: 'sk_test',
          projectId: 'proj_123',
          environmentId: 'env_123',
          fetch: fetchMock,
          privateNetFetch,
          addressRegistry: registry,
        });

        // Start the sandbox — probe is now in-flight but hasn't resolved.
        await sandbox._start();
        expect(sets).toEqual([]);

        // Destroy while probe is pending. Two deletes: one from start()
        // (clearing any stale entry before probe) and one from destroy().
        await sandbox.destroy();
        expect(deletes).toEqual(['sbx_race', 'sbx_race']);

        // Now resolve the probe with 200. The probe should detect the
        // generation mismatch and NOT call set().
        resolveProbe!(new Response('ok', { status: 200 }));

        // Give any pending microtasks a chance to run.
        await new Promise(r => setTimeout(r, 50));

        // Registry should still be empty — no stale entry for the destroyed sandbox.
        expect(sets).toEqual([]);
      });
    });

    describe('transport warmup coalescing', () => {
      it('execs wait for the probe before proceeding', async () => {
        // When an exec arrives during the sidecar boot window, it should wait
        // for the probe rather than immediately racing to the lease path.
        vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
        const fetchMock = vi.fn().mockResolvedValueOnce(
          json({
            id: 'sbx_coalesce',
            createdAt: '2026-06-26T00:00:00.000Z',
            instanceUrl: 'http://[fd12::1]:47000',
          }),
        );

        // Manual control over probe resolution.
        let resolveProbe: (value: Response) => void;
        const probePromise = new Promise<Response>(r => {
          resolveProbe = r;
        });
        let probeCallCount = 0;

        // Streaming mock for exec calls (NDJSON format expected by sidecar).
        const priv = streamingPrivateNetFetch();

        // Intercept both /health (probe) and /exec calls.
        const privateNetFetch = vi.fn().mockImplementation((url: string) => {
          if (url.includes('/health')) {
            probeCallCount++;
            return probePromise;
          }
          // For /exec, delegate to streaming mock.
          return priv.fetch(url, undefined);
        });

        const { registry } = fakeAddressRegistry();

        const sandbox = new PlatformSandbox({
          accessToken: 'sk_test',
          projectId: 'proj_123',
          environmentId: 'env_123',
          fetch: fetchMock,
          privateNetFetch,
          addressRegistry: registry,
        });

        await sandbox._start();

        // Verify probe was started.
        expect(probeCallCount).toBe(1);

        // Fire an exec while probe is pending.
        const execPromise = sandbox.executeCommand('echo 1');

        // Give it a moment to start waiting.
        await new Promise(r => setTimeout(r, 10));

        // No /exec calls yet — exec is waiting on probe.
        expect(priv.calls.length).toBe(0);

        // Resolve the probe — sidecar is ready.
        resolveProbe!(new Response('ok', { status: 200 }));

        // Give exec a moment to proceed after probe resolves.
        await new Promise(r => setTimeout(r, 10));

        // Now the exec should have called /exec.
        expect(priv.calls.length).toBe(1);
        expect(priv.calls[0]!.url).toContain('/exec');

        // Push NDJSON frames to complete the exec.
        priv.push('{"type":"stdout","data":"hello\\n"}\n');
        priv.push('{"type":"exit","code":0}\n');
        priv.end();

        // Exec should complete via private-net.
        const result = await execPromise;
        expect(result.success).toBe(true);
        expect(result.stdout).toBe('hello\n');

        // Verify no lease was minted (no /exec-lease calls to the workspace proxy).
        const execLeaseCalls = fetchMock.mock.calls.filter((c: unknown[]) => String(c[0]).includes('/exec-lease'));
        expect(execLeaseCalls).toHaveLength(0);
      });

      it('proceeds to lease after transport ready timeout', async () => {
        // If the sidecar probe takes too long, execs should proceed to the
        // lease path after TRANSPORT_READY_WAIT_MS rather than blocking forever.
        vi.useFakeTimers();
        vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
        const fetchMock = vi
          .fn()
          // create sandbox
          .mockResolvedValueOnce(
            json({
              id: 'sbx_timeout',
              createdAt: '2026-06-26T00:00:00.000Z',
              instanceUrl: 'http://[fd12::1]:47000',
            }),
          )
          // exec-lease
          .mockResolvedValueOnce(
            json({
              provider: 'railway',
              sandboxId: 'sbx_timeout',
              providerResourceId: 'prov_1',
              jwt: 'jwt_test',
              wsEndpoint: 'wss://test.railway.app/exec',
              subprotocol: 'railway-exec-v1',
              expiresAt: null,
            }),
          );
        // Probe never resolves (simulates slow/unresponsive sidecar).
        const privateNetFetch = vi.fn().mockReturnValue(new Promise(() => {}));
        const { registry } = fakeAddressRegistry();
        const { factory: wsFactory, sockets } = fakeExecSocket({ exitCode: 0, stdout: 'ok' });

        const sandbox = new PlatformSandbox({
          accessToken: 'sk_test',
          projectId: 'proj_123',
          environmentId: 'env_123',
          fetch: fetchMock,
          privateNetFetch,
          addressRegistry: registry,
          webSocketFactory: wsFactory,
        });

        await sandbox._start();

        // Fire an exec — it will wait for transport ready.
        const execPromise = sandbox.executeCommand('echo test');

        // Advance past the transport ready timeout (5s).
        await vi.advanceTimersByTimeAsync(6_000);

        // Exec should complete via lease.
        const result = await execPromise;
        expect(result.success).toBe(true);

        // Verify a lease was minted (exec-lease call made).
        const execLeaseCalls = fetchMock.mock.calls.filter((c: unknown[]) => String(c[0]).includes('/exec-lease'));
        expect(execLeaseCalls.length).toBeGreaterThan(0);
        // WebSocket was used.
        expect(sockets.length).toBeGreaterThan(0);

        vi.useRealTimers();
      });
    });
  });

  describe('clone', () => {
    it('constructs an unstarted sibling without any I/O', () => {
      const fetchMock = vi.fn();
      const template = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });

      const child = template.clone({ id: 'mc-project-1' });

      expect(child).toBeInstanceOf(PlatformSandbox);
      expect(child).not.toBe(template);
      expect(child.id).toBe('mc-project-1');
      expect(child.status).toBe('pending');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not require the template to be started', () => {
      const template = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: vi.fn(),
      });
      expect(() => template.clone()).not.toThrow();
    });

    it('inherits credentials and applies env + idle timeout overrides on start', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi.fn().mockResolvedValueOnce(json({ id: 'sbx_child', createdAt: '2026-06-26T00:00:00.000Z' }));
      const template = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        actingUserId: 'external-user-42',
        environmentId: 'env_123',
        idleTimeoutMinutes: 30,
        networkIsolation: 'PRIVATE',
        env: { BASE: '1' },
        fetch: fetchMock,
      });

      const child = template.clone({
        env: { GITHUB_TOKEN: 'ghs_abc' },
        idleTimeoutMinutes: 15,
      });
      await child._start();

      expect(String(fetchMock.mock.calls[0]![0])).toBe('https://proxy.test/v1/railway/projects/proj_123/sandbox');
      expect((fetchMock.mock.calls[0]![1].headers as Headers).get('x-acting-user-id')).toBe('external-user-42');
      const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
      expect(body).toMatchObject({
        environmentId: 'env_123',
        idleTimeoutMinutes: 15,
        networkIsolation: 'PRIVATE',
        env: { GITHUB_TOKEN: 'ghs_abc' },
      });
    });

    it('inherits session/thread correlation ids so clone requests carry the headers', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi.fn().mockResolvedValueOnce(json({ id: 'sbx_child', createdAt: '2026-06-26T00:00:00.000Z' }));
      const template = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        sessionId: 'sess_42',
        threadId: 'thread_7',
        fetch: fetchMock,
      });

      const child = template.clone({ id: 'mc-project-1' });
      await child._start();

      const headers = fetchMock.mock.calls[0]![1].headers as Headers;
      expect(headers.get('x-mastra-session-id')).toBe('sess_42');
      expect(headers.get('x-mastra-thread-id')).toBe('thread_7');
    });

    it('reattaches to a provider sandbox when sandboxId is passed', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_existing', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockResolvedValueOnce(leaseResponse());
      const { factory } = fakeExecSocket({ exitCode: 0, stdout: 'ok' });
      const template = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        webSocketFactory: factory,
      });

      const child = template.clone({ sandboxId: 'sbx_existing' });
      await child._start();
      await child.executeCommand!('echo hello');

      expect(String(fetchMock.mock.calls[0]![0])).toBe(
        'https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_existing',
      );
      expect(String(fetchMock.mock.calls[1]![0])).toBe(
        'https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_existing/exec-lease',
      );
      const createCalls = fetchMock.mock.calls.filter(call => {
        const url = String(call[0]);
        return url.endsWith('/sandbox') && (call[1] as RequestInit | undefined)?.method === 'POST';
      });
      expect(createCalls).toHaveLength(0);
    });

    it('inherits template defaults when no overrides are passed', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi.fn().mockResolvedValueOnce(json({ id: 'sbx_child', createdAt: '2026-06-26T00:00:00.000Z' }));
      const template = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        idleTimeoutMinutes: 45,
        env: { BASE: '1' },
        fetch: fetchMock,
      });

      const child = template.clone();
      await child._start();

      const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
      expect(body).toMatchObject({
        environmentId: 'env_123',
        idleTimeoutMinutes: 45,
        env: { BASE: '1' },
      });
    });

    it('forwards checkpointName as the create body id so the platform keys recovery on it', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi.fn().mockResolvedValueOnce(json({ id: 'sbx_child', createdAt: '2026-06-26T00:00:00.000Z' }));
      const template = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });

      const child = template.clone({ checkpointName: 'mastra-recovery-session-42' });
      await child._start();

      const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
      // Recovery-key stability is the whole point: the proxy hashes body.id to
      // look up prior checkpoints, so a session-stable checkpointName MUST
      // round-trip to body.id on start().
      expect(body.id).toBe('mastra-recovery-session-42');
      expect(child.id).toBe('mastra-recovery-session-42');
    });

    it('forwards seedCheckpointName separately from the primary recovery key', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi.fn().mockResolvedValueOnce(json({ id: 'sbx_child', createdAt: '2026-06-26T00:00:00.000Z' }));
      const template = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });

      const child = template.clone({ checkpointName: 'session-42', seedCheckpointName: 'repo-base' });
      await child._start();

      const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
      expect(body).toMatchObject({ id: 'session-42', seedCheckpointName: 'repo-base' });
    });

    it('prefers an explicit id over checkpointName when both are passed to clone', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi.fn().mockResolvedValueOnce(json({ id: 'sbx_child', createdAt: '2026-06-26T00:00:00.000Z' }));
      const template = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });

      const child = template.clone({ id: 'explicit-id', checkpointName: 'ignored-name' });
      await child._start();

      const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
      expect(body.id).toBe('explicit-id');
    });
  });

  describe('boot timing log', () => {
    it('logs one start-complete summary on fresh provision', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_timing', createdAt: '2026-06-26T00:00:00.000Z' }));
      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        sessionId: 'sess_42',
        fetch: fetchMock,
      });
      const loggerInfoSpy = vi.spyOn((sandbox as any).logger, 'info');

      await sandbox._start();

      expect(loggerInfoSpy).toHaveBeenCalledWith(
        'platform-workspace start complete',
        expect.objectContaining({
          sandboxId: 'sbx_timing',
          sessionId: 'sess_42',
          mode: 'provision',
          totalMs: expect.any(Number),
          requestMs: expect.any(Number),
        }),
      );
    });

    it('logs one start-complete summary on reattach', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_reattach', createdAt: '2026-06-26T00:00:00.000Z' }));
      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        sandboxId: 'sbx_reattach',
        fetch: fetchMock,
      });
      const loggerInfoSpy = vi.spyOn((sandbox as any).logger, 'info');

      await sandbox._start();

      expect(loggerInfoSpy).toHaveBeenCalledWith(
        'platform-workspace start complete',
        expect.objectContaining({
          sandboxId: 'sbx_reattach',
          mode: 'reattach',
          totalMs: expect.any(Number),
          requestMs: expect.any(Number),
        }),
      );
    });
  });

  describe('stop / destroy (checkpoint lifecycle)', () => {
    // These tests pin down the semantic split between stop() and destroy()
    // that mirrors @mastra/railway RailwaySandbox after mastra#20739:
    //   stop()    -> preserve checkpoint (VM DELETE only)
    //   destroy() -> release checkpoint (checkpoint DELETE + VM DELETE)
    // The old behavior — stop() aliasing destroy() with no checkpoint delete
    // in either — is the invariant break the split fixes.
    it('stop() releases the VM without touching the checkpoint (DELETE /sandbox/:id only)', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockResolvedValueOnce(new Response(null, { status: 204 }));

      const sandbox = new PlatformSandbox({
        // Explicit id so _hasRecoveryKey is true — the destroy() path guards
        // on this, and we want to prove stop() does *not* branch on it.
        id: 'mc-session-42',
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });
      await sandbox._start();

      await sandbox.stop();

      // Exactly two upstream calls: the create and the sandbox DELETE.
      // Anything else (in particular a DELETE /checkpoint) is a regression
      // — stop() must not release the recovery checkpoint.
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1]![1].method).toBe('DELETE');
      expect(String(fetchMock.mock.calls[1]![0])).toBe('https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_1');
    });

    it('destroy() releases the checkpoint (DELETE /sandbox/:id/checkpoint) and then the VM', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        // DELETE /checkpoint -> 204
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
        // DELETE /sandbox -> 204
        .mockResolvedValueOnce(new Response(null, { status: 204 }));

      const sandbox = new PlatformSandbox({
        id: 'mc-session-42',
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });
      await sandbox._start();

      await sandbox.destroy();

      // The checkpoint DELETE must land *before* the VM DELETE so the
      // upstream provisioner can look up the checkpoint on a sandbox that
      // still exists. Reversing the order can leave a leaked checkpoint if
      // the checkpoint delete fails after the VM is already gone.
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(String(fetchMock.mock.calls[1]![0])).toBe(
        'https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_1/checkpoint',
      );
      expect(fetchMock.mock.calls[1]![1].method).toBe('DELETE');
      expect(String(fetchMock.mock.calls[2]![0])).toBe('https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_1');
      expect(fetchMock.mock.calls[2]![1].method).toBe('DELETE');
    });

    it('destroy() sends the recovery id on the checkpoint DELETE body so the proxy can locate the right checkpoint', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
        .mockResolvedValueOnce(new Response(null, { status: 204 }));

      const sandbox = new PlatformSandbox({
        id: 'mc-session-42',
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });
      await sandbox._start();
      await sandbox.destroy();

      const checkpointDeleteBody = JSON.parse(fetchMock.mock.calls[1]![1].body as string);
      // Mirrors the shape of POST /checkpoint's request body so the proxy
      // hashes the same recovery key into the same on-provider checkpoint
      // name for both capture and delete.
      expect(checkpointDeleteBody).toEqual({ id: 'mc-session-42' });
    });

    it('destroy() without a recovery id skips the checkpoint DELETE (no checkpoint to release)', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockResolvedValueOnce(new Response(null, { status: 204 }));

      // No `id` supplied — the auto-generated id is not a recovery key, so
      // no checkpoint was ever registered against it. destroy() must not
      // fire a delete against a name the proxy has no record of.
      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });
      await sandbox._start();

      await sandbox.destroy();

      // Only create + VM DELETE — no /checkpoint call.
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(String(fetchMock.mock.calls[1]![0])).toBe('https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_1');
    });

    it('destroy() continues to VM teardown when the checkpoint DELETE 404s (idempotent)', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        // Checkpoint already gone (idle GC, prior delete). Proxy 404.
        .mockResolvedValueOnce(new Response('not found', { status: 404 }))
        .mockResolvedValueOnce(new Response(null, { status: 204 }));

      const sandbox = new PlatformSandbox({
        id: 'mc-session-42',
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });
      await sandbox._start();

      // Must not throw — an already-absent checkpoint is a successful
      // destroy from the caller's perspective (that's the state they asked
      // for). The VM DELETE must still fire, otherwise a stale sandbox
      // record would linger.
      await sandbox.destroy();

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(String(fetchMock.mock.calls[2]![0])).toBe('https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_1');
    });

    it('destroy() continues to VM teardown when the checkpoint DELETE fails with 5xx (best-effort)', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        // Proxy failed to delete the checkpoint (transient).
        .mockResolvedValueOnce(new Response('boom', { status: 500 }))
        .mockResolvedValueOnce(new Response(null, { status: 204 }));

      const sandbox = new PlatformSandbox({
        id: 'mc-session-42',
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });
      await sandbox._start();

      // A transient upstream failure on the checkpoint delete must not
      // block the VM DELETE — leaving the VM running with a lingering
      // checkpoint is worse than a lingering checkpoint alone. The failure
      // is logged; the caller sees success.
      await sandbox.destroy();

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(String(fetchMock.mock.calls[2]![0])).toBe('https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_1');
    });

    it('destroy() is a no-op when the sandbox was never started (idempotent)', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi.fn();

      const sandbox = new PlatformSandbox({
        id: 'mc-session-42',
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });

      // Never started — no _sandboxId, so nothing upstream to release.
      await sandbox.destroy();

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('stop() awaits an in-flight capture before tearing down so the preserved checkpoint reflects it', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');

      // Gate the capture response so the test can control ordering.
      let releaseCapture!: (value: Response) => void;
      const capturePending = new Promise<Response>(resolve => {
        releaseCapture = resolve;
      });

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockReturnValueOnce(capturePending)
        .mockResolvedValueOnce(new Response(null, { status: 204 }));

      const sandbox = new PlatformSandbox({
        id: 'mc-session-42',
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });
      await sandbox._start();

      // Kick off a capture, then a stop while it's still in flight.
      const capturePromise = sandbox.captureCheckpoint();
      const stopPromise = sandbox.stop();

      // stop() must not have progressed to the VM DELETE yet — only the
      // create + the in-flight POST /checkpoint should be observable.
      expect(fetchMock).toHaveBeenCalledTimes(2);

      releaseCapture(json({ checkpointName: 'mastra-checkpoint-abc123', status: 'captured' }));

      await Promise.all([capturePromise, stopPromise]);

      // Now the VM DELETE has fired, but no checkpoint DELETE (this is
      // stop(), not destroy()).
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(String(fetchMock.mock.calls[2]![0])).toBe('https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_1');
      expect(fetchMock.mock.calls[2]![1].method).toBe('DELETE');
    });

    it('stop() proceeds to teardown even if the in-flight capture fails (best-effort flush)', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        // Capture blows up with a transport error.
        .mockResolvedValueOnce(new Response('quota exceeded', { status: 429 }))
        .mockResolvedValueOnce(new Response(null, { status: 204 }));

      const sandbox = new PlatformSandbox({
        id: 'mc-session-42',
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });
      await sandbox._start();

      // Start the capture and let it fail before stop() runs — this puts
      // the rejection on the in-flight promise stop() will await/catch.
      const capturePromise = sandbox.captureCheckpoint();
      await expect(capturePromise).rejects.toMatchObject({ status: 429 });

      // A failed capture must not leave the caller unable to release the
      // sandbox. The proxy's safety-net timer is the fallback for the
      // checkpoint state.
      await sandbox.stop();

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(String(fetchMock.mock.calls[2]![0])).toBe('https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_1');
    });
  });

  describe('captureCheckpoint (public, on-demand)', () => {
    it('delegates snapshot to captureCheckpoint', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi.fn().mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }));
      const sandbox = new PlatformSandbox({
        id: 'mc-session-42',
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });
      await sandbox._start();
      const captureCheckpoint = vi.spyOn(sandbox, 'captureCheckpoint').mockResolvedValue({
        status: 'captured',
        checkpointName: 'mastra-checkpoint-abc123',
      });

      await expect(sandbox.snapshot()).resolves.toBeUndefined();

      expect(captureCheckpoint).toHaveBeenCalledOnce();
    });

    it('POSTs to /checkpoint with the recovery key and returns the captured name', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockResolvedValueOnce(json({ checkpointName: 'mastra-checkpoint-abc123', status: 'captured' }));

      const sandbox = new PlatformSandbox({
        id: 'mc-session-42',
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });
      await sandbox._start();

      const result = await sandbox.captureCheckpoint();

      expect(result).toEqual({ status: 'captured', checkpointName: 'mastra-checkpoint-abc123' });
      expect(String(fetchMock.mock.calls[1]![0])).toBe(
        'https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_1/checkpoint',
      );
      expect(fetchMock.mock.calls[1]![1].method).toBe('POST');
      // The recovery key on the body must be the caller-supplied id, since
      // the proxy hashes that to look up the on-provider checkpoint name.
      const body = JSON.parse(fetchMock.mock.calls[1]![1].body as string);
      expect(body).toEqual({ id: 'mc-session-42' });
    });

    it('returns coalesced with the same name when the proxy reports coalesced', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockResolvedValueOnce(json({ checkpointName: 'mastra-checkpoint-abc123', status: 'coalesced' }));

      const sandbox = new PlatformSandbox({
        id: 'mc-session-42',
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });
      await sandbox._start();

      const result = await sandbox.captureCheckpoint();

      expect(result).toEqual({ status: 'coalesced', checkpointName: 'mastra-checkpoint-abc123' });
    });

    it('returns no-checkpoint-name-configured when no caller id was supplied (auto-generated)', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi.fn().mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }));

      // No `id` in options → auto-generated random id → no meaningful recovery key.
      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });
      await sandbox._start();

      const result = await sandbox.captureCheckpoint();

      expect(result).toEqual({ status: 'skipped', reason: 'no-checkpoint-name-configured' });
      // No POST /checkpoint was made — only the initial create.
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('returns sandbox-not-running when the sandbox has not been started (pre-flight)', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi.fn();

      const sandbox = new PlatformSandbox({
        id: 'mc-session-42',
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });

      const result = await sandbox.captureCheckpoint();

      expect(result).toEqual({ status: 'skipped', reason: 'sandbox-not-running' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('coalesces concurrent callers onto a single in-flight POST /checkpoint', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      // Hold the checkpoint response open so both callers observe an
      // in-flight request when the second one arrives.
      let releaseCheckpoint!: (value: Response) => void;
      const held = new Promise<Response>(resolve => {
        releaseCheckpoint = resolve;
      });
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockReturnValueOnce(held);

      const sandbox = new PlatformSandbox({
        id: 'mc-session-42',
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });
      await sandbox._start();

      const first = sandbox.captureCheckpoint();
      const second = sandbox.captureCheckpoint();

      releaseCheckpoint(json({ checkpointName: 'mastra-checkpoint-abc123', status: 'captured' }));
      const [firstResult, secondResult] = await Promise.all([first, second]);

      // Both callers observe the same successful outcome.
      expect(firstResult).toEqual({ status: 'captured', checkpointName: 'mastra-checkpoint-abc123' });
      expect(secondResult).toEqual({ status: 'captured', checkpointName: 'mastra-checkpoint-abc123' });
      // Only one upstream POST /checkpoint was issued (plus the initial create).
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('normalizes a 410 to sandbox-not-running and clears local state so ensureSandbox provisions fresh', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const registry: SandboxAddressRegistry = {
        set: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
      };
      const fetchMock = vi
        .fn()
        // First create returns an instanceUrl so the registry gets populated.
        .mockResolvedValueOnce(
          json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z', instanceUrl: 'http://[::1]:8080' }),
        )
        // Capture attempt → 410.
        .mockResolvedValueOnce(new Response('gone', { status: 410 }))
        // Next start() after the destroy discovery must provision fresh
        // (not reattach), so respond as if it's a brand-new POST /sandbox.
        .mockResolvedValueOnce(json({ id: 'sbx_2', createdAt: '2026-06-27T00:00:00.000Z' }));

      const sandbox = new PlatformSandbox({
        id: 'mc-session-42',
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        addressRegistry: registry,
      });
      await sandbox._start();

      const result = await sandbox.captureCheckpoint();
      expect(result).toEqual({ status: 'skipped', reason: 'sandbox-not-running' });
      // Sidecar address for the destroyed sandbox was evicted.
      expect(registry.delete).toHaveBeenCalledWith('sbx_1');

      // Next start() takes the fresh-provision branch (POST /sandbox),
      // not the reattach branch (GET /sandbox/sbx_1) — proving _sandboxId
      // was cleared.
      await sandbox._start();
      expect(String(fetchMock.mock.calls[2]![0])).toBe('https://proxy.test/v1/railway/projects/proj_123/sandbox');
      expect(fetchMock.mock.calls[2]![1].method).toBe('POST');
    });

    it('normalizes proxy-reported skipped to sandbox-not-running and clears local state', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const registry: SandboxAddressRegistry = {
        set: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
      };
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z', instanceUrl: 'http://[::1]:8080' }),
        )
        .mockResolvedValueOnce(json({ checkpointName: 'mastra-checkpoint-abc123', status: 'skipped' }));

      const sandbox = new PlatformSandbox({
        id: 'mc-session-42',
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        addressRegistry: registry,
      });
      await sandbox._start();

      const result = await sandbox.captureCheckpoint();
      expect(result).toEqual({ status: 'skipped', reason: 'sandbox-not-running' });
      expect(registry.delete).toHaveBeenCalledWith('sbx_1');
    });

    it('propagates non-410 transport failures (e.g. 500, 429) to the caller', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockResolvedValueOnce(new Response('quota exceeded', { status: 429 }));

      const sandbox = new PlatformSandbox({
        id: 'mc-session-42',
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });
      await sandbox._start();

      await expect(sandbox.captureCheckpoint()).rejects.toMatchObject({
        name: 'PlatformApiError',
        status: 429,
      });
    });

    it('releases the in-flight slot after a failure so a subsequent call retries', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        // First capture fails transiently.
        .mockResolvedValueOnce(new Response('boom', { status: 500 }))
        // Second capture succeeds — proves the coalescing slot was released.
        .mockResolvedValueOnce(json({ checkpointName: 'mastra-checkpoint-abc123', status: 'captured' }));

      const sandbox = new PlatformSandbox({
        id: 'mc-session-42',
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });
      await sandbox._start();

      await expect(sandbox.captureCheckpoint()).rejects.toMatchObject({ status: 500 });
      const result = await sandbox.captureCheckpoint();
      expect(result).toEqual({ status: 'captured', checkpointName: 'mastra-checkpoint-abc123' });
    });
  });

  describe('start() coalescing (concurrent-call de-duplication)', () => {
    // These tests pin down that concurrent start() callers coalesce onto a
    // single in-flight attempt instead of racing to POST /sandbox N times.
    // Mirrors OSS @mastra/railway RailwaySandbox._startInFlight after
    // mastra#20739. Without this guard, a fleet that fires N concurrent
    // starts against a fresh instance would burn N proxy provisions and
    // leave (N-1) stray sandboxes behind.

    it('coalesces two concurrent fresh-provision callers onto a single POST /sandbox', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      // Hold the create response open so the second caller enters start()
      // while the first is mid-round-trip. Without coalescing, the second
      // caller would race past the null check and issue its own POST.
      let releaseCreate!: (value: Response) => void;
      const held = new Promise<Response>(resolve => {
        releaseCreate = resolve;
      });
      const fetchMock = vi.fn().mockReturnValueOnce(held);

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });

      const first = sandbox._start();
      const second = sandbox._start();

      releaseCreate(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }));
      await Promise.all([first, second]);

      // Exactly one upstream call. Two would prove the coalescing guard is
      // missing — the second caller slipped through the null check while
      // the first was awaiting the network.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0]![0])).toBe('https://proxy.test/v1/railway/projects/proj_123/sandbox');
      expect(fetchMock.mock.calls[0]![1].method).toBe('POST');
    });

    it('coalesces concurrent reattach callers onto a single GET /sandbox/:id', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      let releaseReattach!: (value: Response) => void;
      const held = new Promise<Response>(resolve => {
        releaseReattach = resolve;
      });
      const fetchMock = vi.fn().mockReturnValueOnce(held);

      // sandboxId set from construction → start() takes the reattach GET path.
      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        sandboxId: 'sbx_existing',
        fetch: fetchMock,
      });

      const first = sandbox._start();
      const second = sandbox._start();

      releaseReattach(json({ id: 'sbx_existing', createdAt: '2026-06-26T00:00:00.000Z' }));
      await Promise.all([first, second]);

      // One GET, not two. Reattach is on the same coalescing path as fresh
      // provision — the whole start() body runs under one in-flight guard.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0]![0])).toBe(
        'https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_existing',
      );
      // Reattach uses default method (GET), not POST.
      expect(fetchMock.mock.calls[0]![1]?.method).toBeUndefined();
    });

    it('propagates a failed shared start to every joined caller', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      let releaseCreate!: (value: Response) => void;
      const held = new Promise<Response>(resolve => {
        releaseCreate = resolve;
      });
      // Non-transient error (404) so the retry loop does not paper over it.
      const fetchMock = vi.fn().mockReturnValueOnce(held);

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });

      const first = sandbox._start();
      const second = sandbox._start();

      releaseCreate(json({ error: { message: 'Environment not found', type: 'not_found' } }, { status: 404 }));

      // Both callers observe the same failure — joiner does not receive a
      // swallowed error, and the failure is not silently converted to a
      // resolved promise for one of them.
      await expect(first).rejects.toThrow('not_found');
      await expect(second).rejects.toThrow('not_found');
      // Still exactly one upstream call.
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('clears the in-flight slot on failure so a subsequent start() retries fresh', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        // First start() → non-transient failure. If the coalescing slot
        // leaks the rejected promise, the second start() below joins it
        // and rethrows without making a fresh network call.
        .mockResolvedValueOnce(
          json({ error: { message: 'Environment not found', type: 'not_found' } }, { status: 404 }),
        )
        // Second start() → succeeds. Only reached if the slot was
        // cleared by the finally() in start().
        .mockResolvedValueOnce(json({ id: 'sbx_retry', createdAt: '2026-06-26T00:00:00.000Z' }));

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });

      await expect(sandbox._start()).rejects.toThrow('not_found');
      await sandbox._start();

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('clears the in-flight slot on success so a second concurrent batch does not reuse the settled promise', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      // First batch: two concurrent starts share one POST /sandbox.
      // Second batch (after the first settles and the sandbox is no longer
      // running): the same instance gets a fresh coalescing round. The base
      // MastraSandbox wrapper short-circuits while `status === 'running'`,
      // so we mark the sandbox stopped between batches — what matters is
      // that the settled first-batch promise is not reused.
      let releaseFirst!: (value: Response) => void;
      const firstHeld = new Promise<Response>(resolve => {
        releaseFirst = resolve;
      });
      let releaseSecond!: (value: Response) => void;
      const secondHeld = new Promise<Response>(resolve => {
        releaseSecond = resolve;
      });
      const fetchMock = vi
        .fn()
        .mockReturnValueOnce(firstHeld)
        // Reattach GET after the first start settles + sandboxId is set.
        .mockReturnValueOnce(secondHeld);

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });

      // First coalescing batch: two callers → one POST.
      const firstA = sandbox.start();
      const firstB = sandbox.start();
      releaseFirst(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }));
      await Promise.all([firstA, firstB]);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Second coalescing batch: two more callers on the same instance.
      // If the slot leaked the settled first-batch promise, both would
      // resolve immediately without a network call (fetch mock stays at
      // 1). What we want is the slot cleared, so this batch takes the
      // reattach GET path and coalesces onto that single call.
      sandbox.status = 'stopped';
      const secondA = sandbox.start();
      const secondB = sandbox.start();
      releaseSecond(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }));
      await Promise.all([secondA, secondB]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(String(fetchMock.mock.calls[1]![0])).toBe('https://proxy.test/v1/railway/projects/proj_123/sandbox/sbx_1');
    });
  });
});
