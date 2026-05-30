import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { remove } from 'fs-extra/esm';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DevBundler } from './DevBundler';

// Mock process.exit and process.argv to avoid CLI triggering
const mockExit = vi.hoisted(() => vi.fn());
vi.stubGlobal('process', {
  ...process,
  exit: mockExit,
  argv: ['node', 'test'], // Override command line args
});

// Mock commander to prevent CLI from running
vi.mock('commander', () => {
  // Use a class for the Command constructor mock (Vitest v4 requirement)
  class CommandMock {
    name: any;
    version: any;
    addHelpText: any;
    action: any;
    argument: any;
    command: any;
    description: any;
    option: any;
    parse: any;
    help: any;

    constructor() {
      this.name = vi.fn().mockReturnThis();
      this.version = vi.fn().mockReturnThis();
      this.addHelpText = vi.fn().mockReturnThis();
      this.action = vi.fn().mockReturnThis();
      this.argument = vi.fn().mockReturnThis();
      this.command = vi.fn().mockReturnThis();
      this.description = vi.fn().mockReturnThis();
      this.option = vi.fn().mockReturnThis();
      this.parse = vi.fn();
      this.help = vi.fn();
    }
  }

  return {
    Command: CommandMock,
  };
});
// Don't reference top-level variables in mock definitions
vi.mock('@mastra/deployer/build', () => {
  return {
    createWatcher: vi.fn().mockResolvedValue({
      on: vi.fn().mockImplementation((event, cb) => {
        if (event === 'event') {
          setTimeout(() => cb({ code: 'BUNDLE_END' }), 0);
        }
      }),
      off: vi.fn(),
    }),
    getWatcherInputOptions: vi.fn().mockResolvedValue({ plugins: [] }),
  };
});

vi.mock('fs-extra', () => {
  return {
    pathExists: vi.fn().mockResolvedValue(false),
    copy: vi.fn().mockResolvedValue(undefined),
  };
});

// Import DevBundler after mocks

describe('DevBundler', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalSourceMode = process.env.MASTRA_SOURCE_MODE;
  const originalExit = process.exit;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock process.exit to prevent it from actually exiting during tests
    process.exit = vi.fn() as any;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalSourceMode === undefined) {
      delete process.env.MASTRA_SOURCE_MODE;
    } else {
      process.env.MASTRA_SOURCE_MODE = originalSourceMode;
    }
    process.exit = originalExit;
  });

  describe('prepare', () => {
    it('should copy playground dist into the dev server output in source mode', async () => {
      process.env.MASTRA_SOURCE_MODE = '1';
      const devBundler = new DevBundler();
      const fsExtra = await import('fs-extra');
      vi.mocked(fsExtra.pathExists as unknown as () => Promise<boolean>).mockResolvedValue(true);

      const tmpDir = '.test-tmp';
      try {
        await devBundler.prepare(tmpDir);

        expect(fsExtra.copy).toHaveBeenCalledWith(
          expect.stringMatching(/packages\/playground\/dist$/),
          join(tmpDir, 'output', 'studio'),
          { overwrite: true },
        );
      } finally {
        await remove(tmpDir);
      }
    });

    it('should write a source mode fallback page when studio assets are missing', async () => {
      process.env.MASTRA_SOURCE_MODE = '1';
      const devBundler = new DevBundler();
      const fsExtra = await import('fs-extra');
      vi.mocked(fsExtra.pathExists as unknown as () => Promise<boolean>).mockResolvedValue(false);

      const tmpDir = '.test-tmp';
      try {
        await devBundler.prepare(tmpDir);

        expect(fsExtra.copy).not.toHaveBeenCalled();
        await expect(readFile(join(tmpDir, 'output', 'studio', 'index.html'), 'utf-8')).resolves.toContain(
          'Mastra dev server running in source mode',
        );
      } finally {
        await remove(tmpDir);
      }
    });
  });

  describe('watch', () => {
    it('should use NODE_ENV from environment when available', async () => {
      // Arrange
      process.env.NODE_ENV = 'test-env';
      const devBundler = new DevBundler();
      const { getWatcherInputOptions } = await import('@mastra/deployer/build');

      const tmpDir = '.test-tmp';
      try {
        // Act
        await devBundler.watch('test-entry.js', tmpDir, []);

        // Assert
        expect(getWatcherInputOptions).toHaveBeenCalledWith(
          'test-entry.js',
          'node',
          {
            'process.env.NODE_ENV': JSON.stringify('test-env'),
          },
          expect.objectContaining({ sourcemap: false }),
        );
      } finally {
        await remove(tmpDir);
      }
    });

    it('should use the source template path from the package root in source mode', async () => {
      const originalSourceMode = process.env.MASTRA_SOURCE_MODE;
      process.env.MASTRA_SOURCE_MODE = '1';
      const devBundler = new DevBundler();
      const fsExtra = await import('fs-extra');
      const { createWatcher } = await import('@mastra/deployer/build');
      vi.mocked(fsExtra.pathExists as unknown as () => Promise<boolean>).mockResolvedValue(true);

      const tmpDir = '.test-tmp';
      try {
        await devBundler.watch('test-entry.js', tmpDir, []);

        const inputOptions = vi.mocked(createWatcher).mock.calls[0][0] as { input: { index: string } };
        expect(inputOptions.input.index).toMatch(/packages\/cli\/src\/public\/templates\/dev\.entry\.js$/);
      } finally {
        if (originalSourceMode === undefined) {
          delete process.env.MASTRA_SOURCE_MODE;
        } else {
          process.env.MASTRA_SOURCE_MODE = originalSourceMode;
        }
        await remove(tmpDir);
      }
    });

    it('should fall back to the packaged template path when source files are unavailable in source mode', async () => {
      const originalSourceMode = process.env.MASTRA_SOURCE_MODE;
      process.env.MASTRA_SOURCE_MODE = '1';
      const devBundler = new DevBundler();
      const fsExtra = await import('fs-extra');
      const { createWatcher } = await import('@mastra/deployer/build');
      vi.mocked(fsExtra.pathExists as unknown as () => Promise<boolean>).mockResolvedValue(false);

      const tmpDir = '.test-tmp';
      try {
        await devBundler.watch('test-entry.js', tmpDir, []);

        const inputOptions = vi.mocked(createWatcher).mock.calls[0][0] as { input: { index: string } };
        expect(inputOptions.input.index).toMatch(/(dist|src\/commands\/dev)\/templates\/dev\.entry\.js$/);
      } finally {
        if (originalSourceMode === undefined) {
          delete process.env.MASTRA_SOURCE_MODE;
        } else {
          process.env.MASTRA_SOURCE_MODE = originalSourceMode;
        }
        await remove(tmpDir);
      }
    });

    it('should not add source-mode workspace package watcher when source mode is disabled', async () => {
      const originalSourceMode = process.env.MASTRA_SOURCE_MODE;
      delete process.env.MASTRA_SOURCE_MODE;
      const devBundler = new DevBundler();
      const { createWatcher } = await import('@mastra/deployer/build');

      try {
        await devBundler.watch('test-entry.js', '.test-tmp', [], [{ name: '@mastra/core', version: 'workspace:*' }]);

        const inputOptions = vi.mocked(createWatcher).mock.calls[0][0] as {
          plugins: Array<{ name: string }>;
        };

        expect(inputOptions.plugins.some(plugin => plugin.name === 'mastra-source-mode-package-watcher')).toBe(false);
      } finally {
        if (originalSourceMode === undefined) {
          delete process.env.MASTRA_SOURCE_MODE;
        } else {
          process.env.MASTRA_SOURCE_MODE = originalSourceMode;
        }
      }
    });

    it('should add source-mode workspace package source files to the Rollup watcher', async () => {
      const originalSourceMode = process.env.MASTRA_SOURCE_MODE;
      const originalWorkspaceRoot = process.env.MASTRA_SOURCE_MODE_WORKSPACE_ROOT;
      process.env.MASTRA_SOURCE_MODE = '1';
      const devBundler = new DevBundler();
      const fsExtra = await import('fs-extra');
      const { createWatcher } = await import('@mastra/deployer/build');
      vi.mocked(fsExtra.pathExists as unknown as (path: string) => Promise<boolean>).mockImplementation(async path =>
        existsSync(path),
      );

      const tmpDir = '.test-tmp';
      const workspaceRoot = resolve(tmpDir, 'workspace');
      try {
        process.env.MASTRA_SOURCE_MODE_WORKSPACE_ROOT = workspaceRoot;
        await mkdir(workspaceRoot, { recursive: true });
        await writeFile(join(workspaceRoot, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
        await mkdir(join(workspaceRoot, 'packages', 'core', 'src', 'agent'), { recursive: true });
        await mkdir(join(workspaceRoot, 'packages', 'server', 'src'), { recursive: true });
        await writeFile(
          join(workspaceRoot, 'packages', 'core', 'package.json'),
          JSON.stringify({ name: '@mastra/core', dependencies: { '@mastra/server': 'workspace:*' } }),
        );
        await writeFile(
          join(workspaceRoot, 'packages', 'server', 'package.json'),
          JSON.stringify({ name: '@mastra/server' }),
        );
        await writeFile(join(workspaceRoot, 'packages', 'core', 'src', 'agent', 'index.ts'), 'export {}');
        await writeFile(join(workspaceRoot, 'packages', 'core', 'src', 'agent', 'index.test.ts'), 'export {}');
        await writeFile(join(workspaceRoot, 'packages', 'server', 'src', 'index.ts'), 'export {}');

        await devBundler.watch('test-entry.js', tmpDir, [], [{ name: '@mastra/core', version: 'workspace:*' }]);

        const inputOptions = vi.mocked(createWatcher).mock.calls[0][0] as {
          plugins: Array<{ name: string; buildStart?: () => void }>;
        };
        const plugin = inputOptions.plugins.find(plugin => plugin.name === 'mastra-source-mode-package-watcher');
        const addWatchFile = vi.fn();
        plugin?.buildStart?.call({ addWatchFile });

        expect(addWatchFile).toHaveBeenCalledWith(join(workspaceRoot, 'packages', 'core', 'src', 'agent', 'index.ts'));
        expect(addWatchFile).toHaveBeenCalledWith(join(workspaceRoot, 'packages', 'server', 'src', 'index.ts'));
        expect(addWatchFile).not.toHaveBeenCalledWith(
          join(workspaceRoot, 'packages', 'core', 'src', 'agent', 'index.test.ts'),
        );
      } finally {
        if (originalSourceMode === undefined) {
          delete process.env.MASTRA_SOURCE_MODE;
        } else {
          process.env.MASTRA_SOURCE_MODE = originalSourceMode;
        }
        if (originalWorkspaceRoot === undefined) {
          delete process.env.MASTRA_SOURCE_MODE_WORKSPACE_ROOT;
        } else {
          process.env.MASTRA_SOURCE_MODE_WORKSPACE_ROOT = originalWorkspaceRoot;
        }
        await remove(tmpDir);
      }
    });

    it('should default to development when NODE_ENV is not set', async () => {
      // Arrange
      delete process.env.NODE_ENV;
      const devBundler = new DevBundler();
      const { getWatcherInputOptions } = await import('@mastra/deployer/build');

      // Act
      const tmpDir = '.test-tmp';
      await devBundler.watch('test-entry.js', tmpDir, []);
      try {
        // Assert
        expect(getWatcherInputOptions).toHaveBeenCalledWith(
          'test-entry.js',
          'node',
          {
            'process.env.NODE_ENV': JSON.stringify('development'),
          },
          expect.objectContaining({ sourcemap: false }),
        );
      } finally {
        await remove(tmpDir);
      }
    });
  });
});
