import { PermissionError } from '@mastra/core/workspace';
import { describe, expect, it, vi } from 'vitest';
import { RailwayFilesystem } from '../railway-filesystem.js';

function createMockSandbox() {
  const files = {
    mkdir: vi.fn().mockResolvedValue(undefined),
    read: vi.fn().mockResolvedValue(new TextEncoder().encode('hello')),
    write: vi.fn().mockResolvedValue(undefined),
    stat: vi
      .fn()
      .mockResolvedValue({ name: 'file', size: 5, mode: 0o644, isDir: false, modTime: '2026-06-29T12:00:00Z' }),
    list: vi.fn().mockResolvedValue([]),
    exists: vi.fn().mockResolvedValue(true),
    remove: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
  };
  const sandbox = {
    railway: { files },
    executeCommand: vi.fn().mockResolvedValue({ success: true, stdout: '', stderr: '' }),
    withRestartRetry: vi.fn((operation: () => Promise<unknown>) => operation()),
  };
  return { sandbox, files };
}

describe('RailwayFilesystem', () => {
  it('runs filesystem operations through the Railway SDK files API', async () => {
    const { sandbox, files } = createMockSandbox();

    const filesystem = new RailwayFilesystem({ sandbox: sandbox as any, basePath: '/workspace/repo' });

    await filesystem.init();
    await filesystem.writeFile('src/index.ts', 'content', { recursive: true });
    await expect(filesystem.readFile('README.md', { encoding: 'utf8' })).resolves.toBe('hello');

    expect(files.mkdir).toHaveBeenCalledWith('/workspace/repo');
    expect(files.write).toHaveBeenCalledWith('/workspace/repo/src/index.ts', expect.any(Uint8Array));
    expect(files.read).toHaveBeenCalledWith('/workspace/repo/README.md', { format: 'bytes' });
  });

  it('maps SandboxFileNotFoundError to FileNotFoundError', async () => {
    const { sandbox, files } = createMockSandbox();
    const { FileNotFoundError } = await import('@mastra/core/workspace');
    const { SandboxFileNotFoundError } = await import('@mastra/railway');

    files.read.mockRejectedValueOnce(
      new SandboxFileNotFoundError({
        operation: 'read',
        path: '/workspace/repo/missing.txt',
        message: 'not found',
      }),
    );

    const filesystem = new RailwayFilesystem({ sandbox: sandbox as any, basePath: '/workspace/repo' });
    await expect(filesystem.readFile('missing.txt')).rejects.toBeInstanceOf(FileNotFoundError);
  });

  it('keeps file operations contained to the Railway workspace root', async () => {
    const { sandbox } = createMockSandbox();
    const filesystem = new RailwayFilesystem({ sandbox: sandbox as any, basePath: '/workspace/repo' });
    await expect(filesystem.readFile('../outside.txt')).rejects.toBeInstanceOf(PermissionError);
  });

  it('re-runs file operations through the sandbox restart retry', async () => {
    const firstFiles = {
      ...createMockSandbox().files,
      read: vi.fn().mockRejectedValueOnce(new Error('sandbox destroyed')),
    };
    const secondFiles = {
      ...createMockSandbox().files,
      read: vi.fn().mockResolvedValue(new TextEncoder().encode('after restart')),
    };
    let currentFiles = firstFiles;
    const sandbox = {
      get railway() {
        return { files: currentFiles };
      },
      executeCommand: vi.fn().mockResolvedValue({ success: true, stdout: '', stderr: '' }),
      withRestartRetry: vi.fn(async (operation: () => Promise<unknown>) => {
        try {
          return await operation();
        } catch {
          currentFiles = secondFiles;
          return operation();
        }
      }),
    };

    const filesystem = new RailwayFilesystem({ sandbox: sandbox as any, basePath: '/workspace/repo' });
    await expect(filesystem.readFile('README.md', { encoding: 'utf8' })).resolves.toBe('after restart');

    expect(firstFiles.read).toHaveBeenCalledWith('/workspace/repo/README.md', { format: 'bytes' });
    expect(secondFiles.read).toHaveBeenCalledWith('/workspace/repo/README.md', { format: 'bytes' });
    expect(sandbox.withRestartRetry).toHaveBeenCalledOnce();
  });
});
