import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlatformSandbox } from './sandbox.js';

function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init });
}

describe('PlatformSandbox', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates a sandbox and executes commands through the proxy', async () => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
      .mockResolvedValueOnce(json({ exitCode: 0, stdout: 'ok', stderr: '', timedOut: false, truncated: false }));

    const sandbox = new PlatformSandbox({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      environmentId: 'env_123',
      fetch: fetchMock,
    });

    await sandbox._start();
    const result = await sandbox.executeCommand('echo', ['ok'], { cwd: '/workspace', env: { A: '1' } });

    expect(result).toMatchObject({ success: true, exitCode: 0, stdout: 'ok', stderr: '', command: 'echo ok' });
    expect(String(fetchMock.mock.calls[0]![0])).toBe('https://proxy.test/v1/projects/proj_123/sandbox');
    expect(await (fetchMock.mock.calls[0]![1].body as string)).toContain('env_123');
    expect(String(fetchMock.mock.calls[1]![0])).toBe('https://proxy.test/v1/projects/proj_123/sandbox/sbx_1/exec');
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

  it('reattaches when constructed with a sandbox id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ exitCode: 0, stdout: 'ok', stderr: '' }));
    const sandbox = new PlatformSandbox({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      sandboxId: 'sbx_existing',
      fetch: fetchMock,
    });

    await sandbox._start();
    await sandbox.executeCommand('pwd');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/sandbox/sbx_existing/exec');
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

  it('preserves an explicit timeout: 0 on executeCommand instead of dropping it', async () => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
      .mockResolvedValueOnce(json({ exitCode: 0, stdout: '', stderr: '' }));

    const sandbox = new PlatformSandbox({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      environmentId: 'env_123',
      fetch: fetchMock,
    });

    await sandbox._start();
    await sandbox.executeCommand('sleep', ['1'], { timeout: 0 });

    const body = JSON.parse(fetchMock.mock.calls[1]![1].body as string);
    expect(body.timeoutSec).toBe(0);
  });

  it('kill() throws because the proxy has no cancel endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ id: 'sbx_1' }))
      .mockResolvedValueOnce(json({ exitCode: 0, stdout: '', stderr: '' }));

    const sandbox = new PlatformSandbox({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      environmentId: 'env_123',
      fetch: fetchMock,
    });
    await sandbox._start();

    const handle = await sandbox.processes.spawn('sleep 10');
    await expect(handle.kill()).rejects.toThrow(/does not support killing/);
  });
});
