import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET_SYSTEM_PACKAGES_ROUTE } from './system';

describe('System Handlers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('GET_SYSTEM_PACKAGES_ROUTE', () => {
    it('should return packages when MASTRA_PACKAGES is set', async () => {
      const packages = [
        { name: '@mastra/core', version: '1.0.0' },
        { name: 'mastra', version: '1.0.0' },
      ];
      process.env.MASTRA_PACKAGES = JSON.stringify(packages);

      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler();

      expect(result).toEqual({ packages });
    });

    it('should return empty array when MASTRA_PACKAGES is not set', async () => {
      delete process.env.MASTRA_PACKAGES;

      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler();

      expect(result).toEqual({ packages: [] });
    });

    it('should return empty array when MASTRA_PACKAGES is invalid JSON', async () => {
      process.env.MASTRA_PACKAGES = 'not-valid-json';

      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler();

      expect(result).toEqual({ packages: [] });
    });
  });
});
