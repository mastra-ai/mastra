import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DirectExecWebSocket, DirectExecWebSocketFactory } from './direct-exec.js';
import { PlatformSandbox } from './sandbox.js';

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
    expect(String(fetchMock.mock.calls[0]![0])).toBe('https://proxy.test/v1/projects/proj_123/sandbox');
    expect(await (fetchMock.mock.calls[0]![1].body as string)).toContain('env_123');
    // Then the exec-lease mint — no /exec HTTP hit.
    expect(String(fetchMock.mock.calls[1]![0])).toBe(
      'https://proxy.test/v1/projects/proj_123/sandbox/sbx_1/exec-lease',
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
      expect(String(fetchMock.mock.calls[1]![0])).toBe('https://proxy.test/v1/projects/proj_123/sandbox');
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
    expect(String(fetchMock.mock.calls[0]![0])).toBe('https://proxy.test/v1/projects/proj_123/sandbox/sbx_existing');
    expect(String(fetchMock.mock.calls[1]![0])).toBe(
      'https://proxy.test/v1/projects/proj_123/sandbox/sbx_existing/exec-lease',
    );
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

    expect(String(fetchMock.mock.calls[0]![0])).toBe('https://proxy.test/v1/projects/proj_123/sandbox/sbx_stale');
    expect(String(fetchMock.mock.calls[1]![0])).toBe('https://proxy.test/v1/projects/proj_123/sandbox');
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body as string)).toMatchObject({
      id: sandbox.id,
      environmentId: 'env_from_process',
    });
    expect(String(fetchMock.mock.calls[2]![0])).toBe(
      'https://proxy.test/v1/projects/proj_123/sandbox/sbx_recreated/exec-lease',
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

    expect(String(fetchMock.mock.calls[1]![0])).toBe('https://proxy.test/v1/projects/proj_123/sandbox');
    expect(String(fetchMock.mock.calls[2]![0])).toBe(
      'https://proxy.test/v1/projects/proj_123/sandbox/sbx_recreated/exec-lease',
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
    expect(String(fetchMock.mock.calls[1]![0])).toBe('https://proxy.test/v1/projects/proj_123/sandbox/sbx_1');

    // getInfo() falls back to the local, no-remote branch because _sandboxId is cleared.
    // (Previously it would GET /sandbox/sbx_1 — a dead resource.)
    const info = await sandbox.getInfo();
    expect(info.id).toBe(sandbox.id);
    expect(fetchMock).toHaveBeenCalledTimes(2); // no third fetch
  });

  it('treats an explicit timeout: 0 as "no timeout" on the direct-exec path (matches proxy semantics)', async () => {
    // On the fallback /exec path, timeout: 0 must be preserved (not dropped
    // by a truthy check) so the proxy sees `timeoutSec: 0` and interprets it
    // as no-timeout. On the direct-exec path, the client owns the timeout —
    // "no timeout" is expressed by NOT arming a client-side timer, so the
    // exec runs to completion regardless of wall-clock elapsed.
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
        'https://proxy.test/v1/projects/proj_123/sandbox/sbx_1/exec-lease',
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

    it('falls back to the proxy /exec route when the exec-lease endpoint returns 404', async () => {
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        // Older platform deployment: exec-lease not present.
        .mockResolvedValueOnce(json({ error: { message: 'Not Found', type: 'not_found' } }, { status: 404 }))
        .mockResolvedValueOnce(json({ exitCode: 0, stdout: 'ok', stderr: '', timedOut: false, truncated: false }))
        // Second exec should skip the mint attempt entirely — the fallback bit is sticky.
        .mockResolvedValueOnce(json({ exitCode: 0, stdout: 'ok', stderr: '', timedOut: false, truncated: false }));
      // If the fallback fails to trigger, we'd end up here and the test would blow up
      // with an unhandled WS error. Passing a factory that throws makes that explicit.
      const factory: DirectExecWebSocketFactory = () => {
        throw new Error('should not open a WebSocket after 404 fallback');
      };

      const sandbox = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
        webSocketFactory: factory,
      });

      await sandbox._start();
      const first = await sandbox.executeCommand('echo one');
      const second = await sandbox.executeCommand('echo two');

      expect(first).toMatchObject({ exitCode: 0, stdout: 'ok' });
      expect(second).toMatchObject({ exitCode: 0, stdout: 'ok' });
      // Calls: provision, exec-lease (404), /exec (fallback), /exec (sticky fallback).
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(String(fetchMock.mock.calls[1]![0])).toBe(
        'https://proxy.test/v1/projects/proj_123/sandbox/sbx_1/exec-lease',
      );
      expect(String(fetchMock.mock.calls[2]![0])).toBe('https://proxy.test/v1/projects/proj_123/sandbox/sbx_1/exec');
      expect(String(fetchMock.mock.calls[3]![0])).toBe('https://proxy.test/v1/projects/proj_123/sandbox/sbx_1/exec');
    });

    it('propagates non-404/501 errors from the exec-lease mint instead of falling back silently', async () => {
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
      // Only provision + failed mint; no /exec fallback because 500 isn't a
      // "endpoint not present" signal.
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('falls back to /exec permanently after a WS transport failure', async () => {
      // Simulates a mid-handshake drop / expired token / provider hiccup:
      // lease mint succeeds but the direct-exec socket closes before an exit
      // frame arrives. We fall through to /exec for THIS call AND stay on
      // /exec for every subsequent call on this sandbox — we don't want to
      // pay a fresh mint + failed handshake on every exec when the transport
      // is broken (see direct-exec production incident 2026-07-29).
      vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
        .mockResolvedValueOnce(leaseResponse({ jwt: 'jwt.first' }))
        .mockResolvedValueOnce(
          json({ exitCode: 0, stdout: 'via-proxy-1', stderr: '', timedOut: false, truncated: false }),
        )
        .mockResolvedValueOnce(
          json({ exitCode: 0, stdout: 'via-proxy-2', stderr: '', timedOut: false, truncated: false }),
        );
      const sockets: FakeSocket[] = [];
      const factory: DirectExecWebSocketFactory = (endpoint, subprotocols) => {
        const socket = new FakeSocket(endpoint, subprotocols);
        sockets.push(socket);
        queueMicrotask(() => {
          socket.onopen?.({});
          // Close without an exit frame — transport failure.
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
      const first = await sandbox.executeCommand('echo one');
      const second = await sandbox.executeCommand('echo two');

      expect(first).toMatchObject({ exitCode: 0, stdout: 'via-proxy-1' });
      expect(second).toMatchObject({ exitCode: 0, stdout: 'via-proxy-2' });
      // Fetch sequence: provision, first lease, /exec fallback, /exec fallback (no re-mint).
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(String(fetchMock.mock.calls[1]![0])).toBe(
        'https://proxy.test/v1/projects/proj_123/sandbox/sbx_1/exec-lease',
      );
      expect(String(fetchMock.mock.calls[2]![0])).toBe('https://proxy.test/v1/projects/proj_123/sandbox/sbx_1/exec');
      expect(String(fetchMock.mock.calls[3]![0])).toBe('https://proxy.test/v1/projects/proj_123/sandbox/sbx_1/exec');
      // Only one WS attempt — kill switch prevents the second exec from retrying direct.
      expect(sockets).toHaveLength(1);
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
        'https://proxy.test/v1/projects/proj_123/sandbox/sbx_1/exec-lease',
      );
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

      expect(String(fetchMock.mock.calls[0]![0])).toBe('https://proxy.test/v1/projects/proj_123/sandbox');
      const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
      expect(body).toMatchObject({
        environmentId: 'env_123',
        idleTimeoutMinutes: 15,
        networkIsolation: 'PRIVATE',
        env: { GITHUB_TOKEN: 'ghs_abc' },
      });
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

      expect(String(fetchMock.mock.calls[0]![0])).toBe('https://proxy.test/v1/projects/proj_123/sandbox/sbx_existing');
      expect(String(fetchMock.mock.calls[1]![0])).toBe(
        'https://proxy.test/v1/projects/proj_123/sandbox/sbx_existing/exec-lease',
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
  });
});
