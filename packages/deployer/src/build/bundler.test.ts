// vi.mock must be at the top level and can't reference variables defined in this file
vi.mock('./bundler', () => ({
  getInputOptions: vi.fn((_, __, ___, env = { 'process.env.NODE_ENV': JSON.stringify('production') }) => {
    return Promise.resolve({ env });
  }),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getInputOptions } from './bundler';

describe('bundler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getInputOptions', () => {
    it('should use production NODE_ENV by default', async () => {
      // Act
      const result = (await getInputOptions(
        'test-entry.js',
        {
          dependencies: new Map(),
          externalDependencies: new Set(),
          invalidChunks: new Set(),
        },
        'node',
      )) as any;

      // Assert
      expect(result.env['process.env.NODE_ENV']).toBe(JSON.stringify('production'));
    });

    it('should use custom NODE_ENV when provided', async () => {
      // Act
      const result = (await getInputOptions(
        'test-entry.js',
        {
          dependencies: new Map(),
          externalDependencies: new Set(),
          invalidChunks: new Set(),
        },
        'node',
        {
          'process.env.NODE_ENV': JSON.stringify('development'),
        },
      )) as any;

      // Assert
      expect(result.env['process.env.NODE_ENV']).toBe(JSON.stringify('development'));
    });
  });
});
