import { describe, expect, it, vi } from 'vitest';
import { PlatformSandbox } from './sandbox.js';

function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init });
}

describe('PlatformSandbox', () => {
  it('creates a sandbox and executes commands through the proxy', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }))
      .mockResolvedValueOnce(json({ exitCode: 0, stdout: 'ok', stderr: '', timedOut: false, truncated: false }));

    const sandbox = new PlatformSandbox({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      environmentId: 'env_123',
      proxyUrl: 'https://proxy.test',
      fetch: fetchMock,
    });

    await sandbox._start();
    const result = await sandbox.executeCommand('echo', ['ok'], { cwd: '/workspace', env: { A: '1' } });

    expect(result).toMatchObject({ success: true, exitCode: 0, stdout: 'ok', stderr: '', command: 'echo ok' });
    expect(String(fetchMock.mock.calls[0]![0])).toBe('https://proxy.test/v1/projects/proj_123/sandbox');
    expect(await (fetchMock.mock.calls[0]![1].body as string)).toContain('env_123');
    expect(String(fetchMock.mock.calls[1]![0])).toBe('https://proxy.test/v1/projects/proj_123/sandbox/sbx_1/exec');
  });

  it('forwards template selection as the `template` wire field', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' }));

    const sandbox = new PlatformSandbox({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      environmentId: 'env_123',
      proxyUrl: 'https://proxy.test',
      template: 'python',
      fetch: fetchMock,
    });

    await sandbox._start();

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.template).toBe('python');
    expect(body.templateId).toBeUndefined();
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
});
