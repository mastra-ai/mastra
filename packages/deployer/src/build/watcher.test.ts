// Mock bundler module at the top level
vi.mock('./bundler', () => ({
  getInputOptions: vi.fn().mockResolvedValue({ plugins: [] }),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getInputOptions } from './watcher';

describe('watcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getInputOptions', () => {
    it('should pass NODE_ENV to bundler when provided', async () => {
      // Arrange
      const env = { 'process.env.NODE_ENV': JSON.stringify('test') };
      const bundlerGetInputOptions = vi.mocked(await import('./bundler')).getInputOptions;

      // Act
      await getInputOptions('test-entry.js', 'node', env);

      // Assert
      expect(bundlerGetInputOptions).toHaveBeenCalledWith('test-entry.js', expect.anything(), 'node', env);
    });

    it('should not pass NODE_ENV to bundler when not provided', async () => {
      // Act
      await getInputOptions('test-entry.js', 'node');
      const bundlerGetInputOptions = vi.mocked(await import('./bundler')).getInputOptions;

      // Assert
      expect(bundlerGetInputOptions).toHaveBeenCalledWith('test-entry.js', expect.anything(), 'node', undefined);
    });
  });
});
