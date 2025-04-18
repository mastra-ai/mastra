import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
import { DevBundler } from './DevBundler';

describe('DevBundler', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('watch', () => {
    it('should use NODE_ENV from environment when available', async () => {
      // Arrange
      process.env.NODE_ENV = 'test-env';
      const devBundler = new DevBundler();
      const { getWatcherInputOptions } = await import('@mastra/deployer/build');

      // Act
      await devBundler.watch('test-entry.js', 'output-dir', []);

      // Assert
      expect(getWatcherInputOptions).toHaveBeenCalledWith('test-entry.js', 'node', {
        'process.env.NODE_ENV': JSON.stringify('test-env'),
      });
    });

    it('should default to development when NODE_ENV is not set', async () => {
      // Arrange
      delete process.env.NODE_ENV;
      const devBundler = new DevBundler();
      const { getWatcherInputOptions } = await import('@mastra/deployer/build');

      // Act
      await devBundler.watch('test-entry.js', 'output-dir', []);

      // Assert
      expect(getWatcherInputOptions).toHaveBeenCalledWith('test-entry.js', 'node', {
        'process.env.NODE_ENV': JSON.stringify('development'),
      });
    });
  });
});
