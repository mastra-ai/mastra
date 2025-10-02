import { remove } from 'fs-extra/esm';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock process.exit and process.argv to avoid CLI triggering
const mockExit = vi.hoisted(() => vi.fn());
vi.stubGlobal('process', {
  ...process,
  exit: mockExit,
  argv: ['node', 'test'], // Override command line args
});

// Mock commander to prevent CLI from running
vi.mock('commander', () => ({
  Command: vi.fn(() => ({
    name: vi.fn().mockReturnThis(),
    version: vi.fn().mockReturnThis(),
    addHelpText: vi.fn().mockReturnThis(),
    action: vi.fn().mockReturnThis(),
    command: vi.fn().mockReturnThis(),
    description: vi.fn().mockReturnThis(),
    option: vi.fn().mockReturnThis(),
    parse: vi.fn(),
    help: vi.fn(),
  })),
}));

import { DevBundler } from './DevBundler';

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
    writeTelemetryConfig: vi.fn(),
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
