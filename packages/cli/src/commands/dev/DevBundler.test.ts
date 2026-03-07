import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { remove } from 'fs-extra/esm';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DevBundler } from './DevBundler';

// Mock process.exit and process.argv to avoid CLI triggering
const mockExit = vi.hoisted(() => vi.fn());
vi.stubGlobal('process', {
  ...process,
  exit: mockExit,
  argv: ['node', 'test'],
});

// Hoisted override for stat — null means use the real implementation.
const statBehavior = vi.hoisted(() => ({ override: null as (() => Promise<any>) | null }));

vi.mock('node:fs/promises', async importOriginal => {
  const mod = (await importOriginal()) as Record<string, any>;
  return {
    ...mod,
    stat: (...args: any[]) => {
      if (statBehavior.override) return statBehavior.override();
      return (mod.stat as any)(...args);
    },
  };
});

// Mock commander to prevent CLI from running
vi.mock('commander', () => {
  class CommandMock {
    name: any;
    version: any;
    addHelpText: any;
    action: any;
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

describe('DevBundler', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalExit = process.exit;

  beforeEach(() => {
    vi.clearAllMocks();
    statBehavior.override = null;
    process.exit = vi.fn() as any;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    process.exit = originalExit;
    statBehavior.override = null;
  });

  describe('watch - public files', () => {
    it('should include public-files-copier plugin in watcher', async () => {
      const devBundler = new DevBundler(undefined, '/fake/src/mastra');
      const { createWatcher } = await import('@mastra/deployer/build');

      const tmpDir = '.test-watch-public-tmp';
      try {
        await devBundler.watch('test-entry.js', tmpDir, []);

        const call = vi.mocked(createWatcher).mock.calls[0]!;
        const inputOptions = call[0] as { plugins: Array<{ name: string }> };
        const pluginNames = inputOptions.plugins.map((p: { name: string }) => p.name).filter(Boolean);

        expect(pluginNames).toContain('public-files-copier');
      } finally {
        await remove(tmpDir);
      }
    });

    it('should call copyPublic in the buildEnd hook', async () => {
      const tmpDir = '.test-buildend-tmp';
      const mastraDir = join(tmpDir, 'src', 'mastra');
      const publicDir = join(mastraDir, 'public');

      try {
        mkdirSync(publicDir, { recursive: true });
        writeFileSync(join(publicDir, 'worker.js'), 'console.log("worker")');

        const devBundler = new DevBundler(undefined, mastraDir);
        const { createWatcher } = await import('@mastra/deployer/build');

        await devBundler.watch('test-entry.js', tmpDir, []);

        const call = vi.mocked(createWatcher).mock.calls[0]!;
        const inputOptions = call[0] as { plugins: Array<{ name: string; buildEnd?: () => Promise<void> }> };
        const copierPlugin = inputOptions.plugins.find(p => p.name === 'public-files-copier');

        expect(copierPlugin).toBeDefined();
        expect(copierPlugin!.buildEnd).toBeDefined();

        // Invoke the buildEnd hook — should not throw
        await copierPlugin!.buildEnd!();
      } finally {
        await remove(tmpDir);
      }
    });

    it('should call addWatchFile when public directory exists', async () => {
      const tmpDir = '.test-watchfile-tmp';
      const mastraDir = join(tmpDir, 'src', 'mastra');
      const publicDir = join(mastraDir, 'public');

      try {
        mkdirSync(publicDir, { recursive: true });

        const devBundler = new DevBundler(undefined, mastraDir);
        const { createWatcher } = await import('@mastra/deployer/build');

        await devBundler.watch('test-entry.js', tmpDir, []);

        const call = vi.mocked(createWatcher).mock.calls[0]!;
        const inputOptions = call[0] as {
          plugins: Array<{ name: string; buildStart?: () => void }>;
        };
        const copierPlugin = inputOptions.plugins.find(p => p.name === 'public-files-copier');

        const mockAddWatchFile = vi.fn();
        copierPlugin!.buildStart!.call({ addWatchFile: mockAddWatchFile } as any);

        expect(mockAddWatchFile).toHaveBeenCalledWith(publicDir);
      } finally {
        await remove(tmpDir);
      }
    });

    it('should skip addWatchFile when public directory does not exist', async () => {
      const devBundler = new DevBundler(undefined, '/nonexistent/src/mastra');
      const { createWatcher } = await import('@mastra/deployer/build');

      const tmpDir = '.test-no-watchfile-tmp';
      try {
        await devBundler.watch('test-entry.js', tmpDir, []);

        const call = vi.mocked(createWatcher).mock.calls[0]!;
        const inputOptions = call[0] as {
          plugins: Array<{ name: string; buildStart?: () => void }>;
        };
        const copierPlugin = inputOptions.plugins.find(p => p.name === 'public-files-copier');

        const mockAddWatchFile = vi.fn();
        copierPlugin!.buildStart!.call({ addWatchFile: mockAddWatchFile } as any);

        expect(mockAddWatchFile).not.toHaveBeenCalled();
      } finally {
        await remove(tmpDir);
      }
    });

    it('should fall back to dirname(entryFile) when mastraDir is not provided', async () => {
      const devBundler = new DevBundler();
      const { createWatcher } = await import('@mastra/deployer/build');

      const tmpDir = '.test-fallback-tmp';
      try {
        await devBundler.watch('/some/project/src/mastra/index.ts', tmpDir, []);

        const call = vi.mocked(createWatcher).mock.calls[0]!;
        const inputOptions = call[0] as {
          plugins: Array<{ name: string; buildEnd?: () => Promise<void> }>;
        };
        const copierPlugin = inputOptions.plugins.find(p => p.name === 'public-files-copier');

        // buildEnd should not throw — copyPublic handles missing directories
        expect(copierPlugin).toBeDefined();
        await expect(copierPlugin!.buildEnd!()).resolves.toBeUndefined();
      } finally {
        await remove(tmpDir);
      }
    });
  });

  describe('copyPublic', () => {
    it('should not throw when public directory does not exist', async () => {
      const devBundler = new DevBundler(undefined, '/nonexistent/mastra');

      await expect((devBundler as any).copyPublic('/nonexistent/mastra', '/tmp/output')).resolves.toBeUndefined();
    });

    it('should propagate non-ENOENT errors', async () => {
      statBehavior.override = () => Promise.reject(Object.assign(new Error('Permission denied'), { code: 'EACCES' }));

      const devBundler = new DevBundler(undefined, '/some/mastra');

      await expect((devBundler as any).copyPublic('/some/mastra', '/tmp/output')).rejects.toThrow('Permission denied');
    });

    it('should resolve when public directory exists', async () => {
      const tmpDir = '.test-copy-tmp';
      const mastraDir = join(tmpDir, 'src', 'mastra');
      const publicDir = join(mastraDir, 'public');

      try {
        mkdirSync(publicDir, { recursive: true });
        writeFileSync(join(publicDir, 'worker.js'), 'console.log("worker")');

        const devBundler = new DevBundler(undefined, mastraDir);

        await expect((devBundler as any).copyPublic(mastraDir, tmpDir)).resolves.toBeUndefined();
      } finally {
        await remove(tmpDir);
      }
    });
  });

  describe('watch', () => {
    it('should use NODE_ENV from environment when available', async () => {
      process.env.NODE_ENV = 'test-env';
      const devBundler = new DevBundler();
      const { getWatcherInputOptions } = await import('@mastra/deployer/build');

      const tmpDir = '.test-tmp';
      try {
        await devBundler.watch('test-entry.js', tmpDir, []);

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

    it('should default to development when NODE_ENV is not set', async () => {
      delete process.env.NODE_ENV;
      const devBundler = new DevBundler();
      const { getWatcherInputOptions } = await import('@mastra/deployer/build');

      const tmpDir = '.test-tmp';
      try {
        await devBundler.watch('test-entry.js', tmpDir, []);

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
