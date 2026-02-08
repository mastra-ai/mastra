import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
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
  const originalExit = process.exit;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock process.exit to prevent it from actually exiting during tests
    process.exit = vi.fn() as any;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    process.exit = originalExit;
  });

  describe('prepare (issue #5121)', () => {
    it('should handle missing public directory gracefully', async () => {
      // If the user has no public/ dir, prepare() should not fail
      const projectRoot = '.test-no-public-tmp';
      const mastraDir = join(projectRoot, 'src', 'mastra');
      const dotMastraPath = join(projectRoot, '.mastra');

      try {
        mkdirSync(mastraDir, { recursive: true });

        const devBundler = new DevBundler(undefined, mastraDir);
        await devBundler.prepare(dotMastraPath);

        // Should complete without error even with no public/ directory
        expect(existsSync(join(dotMastraPath, 'output'))).toBe(true);
      } finally {
        await remove(projectRoot);
      }
    });
  });

  describe('watch - public files (issue #5121)', () => {
    it('should include public-files-copier plugin in watcher', async () => {
      const devBundler = new DevBundler(undefined, '/fake/src/mastra');
      const { createWatcher } = await import('@mastra/deployer/build');

      const tmpDir = '.test-watch-public-tmp';
      try {
        await devBundler.watch('test-entry.js', tmpDir, []);

        // Verify createWatcher was called with the public-files-copier plugin
        const call = vi.mocked(createWatcher).mock.calls[0]!;
        const inputOptions = call[0] as { plugins: Array<{ name: string }> };
        const pluginNames = inputOptions.plugins.map((p: { name: string }) => p.name).filter(Boolean);

        expect(pluginNames).toContain('public-files-copier');
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
