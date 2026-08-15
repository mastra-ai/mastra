import type { CommandResult } from '@mastra/core/workspace';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CloudflareCommandEvent } from './bridge-client';
import { CloudflareSandbox } from './sandbox';

const client = {
  createSandbox: vi.fn(),
  getSandbox: vi.fn(),
  deleteSandbox: vi.fn(),
  writeFiles: vi.fn(),
  executeCommand: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  client.createSandbox.mockResolvedValue({ id: 'remote-1', status: 'running', createdAt: '2026-08-01T00:00:00Z' });
  client.getSandbox.mockResolvedValue({ id: 'existing-1', status: 'running' });
  client.deleteSandbox.mockResolvedValue(undefined);
  client.writeFiles.mockResolvedValue(undefined);
  client.executeCommand.mockResolvedValue(undefined);
});

function createSandbox(options: Record<string, unknown> = {}) {
  return new CloudflareSandbox({ baseUrl: 'https://bridge.example', client, ...options });
}

describe('CloudflareSandbox', () => {
  it('creates and destroys a remote sandbox', async () => {
    const sandbox = createSandbox({ id: 'logical-1' });

    await sandbox.start();
    expect(client.createSandbox).toHaveBeenCalledOnce();
    expect(sandbox.getInfo()).toMatchObject({
      id: 'logical-1',
      provider: 'cloudflare-sandbox',
      metadata: { sandboxId: 'remote-1' },
    });

    await sandbox.destroy();
    expect(client.deleteSandbox).toHaveBeenCalledWith('remote-1');
  });

  it('reconnects when a sandbox ID is provided', async () => {
    const sandbox = createSandbox({ sandboxId: 'existing-1' });

    await sandbox.start();

    expect(client.getSandbox).toHaveBeenCalledWith('existing-1');
    expect(client.createSandbox).not.toHaveBeenCalled();
  });

  it('merges command settings and streams output', async () => {
    client.executeCommand.mockImplementation(
      async (_id: string, request: unknown, options: { onEvent: (event: CloudflareCommandEvent) => void }) => {
        expect(request).toEqual({
          command: "cd /workspace/app && BASE=one LOCAL='two words' printf '%s' hello",
          timeout: 2,
        });
        options.onEvent({ type: 'stdout', data: 'hello' });
        options.onEvent({ type: 'stderr', data: 'warning' });
        options.onEvent({ type: 'complete', exitCode: 0 });
      },
    );
    const onStdout = vi.fn();
    const onStderr = vi.fn();
    const sandbox = createSandbox({ env: { BASE: 'one' }, workingDirectory: '/workspace/app' });
    await sandbox.start();

    const result = await sandbox.executeCommand('printf', ['%s', 'hello'], {
      env: { LOCAL: 'two words' },
      timeout: 1500,
      onStdout,
      onStderr,
    });

    expect(result).toMatchObject<Partial<CommandResult>>({
      success: true,
      exitCode: 0,
      stdout: 'hello',
      stderr: 'warning',
    });
    expect(onStdout).toHaveBeenCalledWith('hello');
    expect(onStderr).toHaveBeenCalledWith('warning');
  });

  it('uploads text and binary files under /workspace', async () => {
    const sandbox = createSandbox();
    await sandbox.start();

    await sandbox.writeFiles([
      { path: 'src/index.ts', content: 'export {}' },
      { path: '/workspace/data.bin', content: Buffer.from([1, 2, 3]) },
    ]);

    expect(client.writeFiles).toHaveBeenCalledWith('remote-1', [
      { path: 'workspace/src/index.ts', content: 'export {}' },
      { path: 'workspace/data.bin', content: 'AQID', encoding: 'base64' },
    ]);
  });

  it('rejects writes outside /workspace', async () => {
    const sandbox = createSandbox();
    await sandbox.start();

    await expect(sandbox.writeFiles([{ path: '/tmp/file', content: 'no' }])).rejects.toThrow('under /workspace');
  });

  it('requires start before remote operations', async () => {
    const sandbox = createSandbox();

    await expect(sandbox.executeCommand('true')).rejects.toThrow('has not been started');
    await expect(sandbox.writeFiles([])).rejects.toThrow('has not been started');
  });
});
