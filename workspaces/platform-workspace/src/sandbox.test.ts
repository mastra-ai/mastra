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
    const execBody = JSON.parse(fetchMock.mock.calls[1]![1].body as string);
    expect(execBody).toMatchObject({
      command: 'echo ok',
      cwd: '/workspace',
      env: { A: '1' },
    });
    expect(execBody.environmentId).toBeUndefined();
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

  it('reattaches when constructed with a sandbox id', async () => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ id: 'sbx_existing', createdAt: '2026-06-26T00:00:00.000Z' }))
      .mockResolvedValueOnce(json({ exitCode: 0, stdout: 'ok', stderr: '' }));
    const sandbox = new PlatformSandbox({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      sandboxId: 'sbx_existing',
      fetch: fetchMock,
    });

    await sandbox._start();
    await sandbox.executeCommand('pwd');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]![0])).toBe('https://proxy.test/v1/projects/proj_123/sandbox/sbx_existing');
    expect(String(fetchMock.mock.calls[1]![0])).toBe(
      'https://proxy.test/v1/projects/proj_123/sandbox/sbx_existing/exec',
    );
  });

  it('creates a fresh sandbox when the reattached sandbox no longer exists', async () => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    vi.stubEnv('MASTRA_ENVIRONMENT_ID', 'env_from_process');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ error: { message: 'Sandbox not found', type: 'not_found' } }, { status: 404 }))
      .mockResolvedValueOnce(json({ id: 'sbx_recreated', createdAt: '2026-06-26T00:00:00.000Z' }))
      .mockResolvedValueOnce(json({ exitCode: 0, stdout: 'ok', stderr: '' }));
    const sandbox = new PlatformSandbox({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      sandboxId: 'sbx_stale',
      fetch: fetchMock,
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
      'https://proxy.test/v1/projects/proj_123/sandbox/sbx_recreated/exec',
    );
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
        .mockResolvedValueOnce(json({ exitCode: 0, stdout: 'ok', stderr: '' }));
      const template = new PlatformSandbox({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        fetch: fetchMock,
      });

      const child = template.clone({ sandboxId: 'sbx_existing' });
      await child._start();
      await child.executeCommand!('echo hello');

      expect(String(fetchMock.mock.calls[0]![0])).toBe('https://proxy.test/v1/projects/proj_123/sandbox/sbx_existing');
      expect(String(fetchMock.mock.calls[1]![0])).toBe(
        'https://proxy.test/v1/projects/proj_123/sandbox/sbx_existing/exec',
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
