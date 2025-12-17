import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET_SYSTEM_PACKAGES_ROUTE } from './system';

describe('System Handlers', () => {
  const originalEnv = process.env;
  let tempDir: string;
  let tempFilePath: string;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    tempDir = mkdtempSync(join(tmpdir(), 'mastra-test-'));
    tempFilePath = join(tempDir, 'packages.json');
  });

  afterEach(() => {
    process.env = originalEnv;
    try {
      unlinkSync(tempFilePath);
    } catch {
      // File may not exist
    }
  });

  describe('GET_SYSTEM_PACKAGES_ROUTE', () => {
    it('should return packages when MASTRA_PACKAGES_FILE is set', async () => {
      const packages = [
        { name: '@mastra/core', version: '1.0.0' },
        { name: 'mastra', version: '1.0.0' },
      ];
      writeFileSync(tempFilePath, JSON.stringify(packages), 'utf-8');
      process.env.MASTRA_PACKAGES_FILE = tempFilePath;

      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler();

      expect(result).toEqual({ packages });
    });

    it('should return empty array when MASTRA_PACKAGES_FILE is not set', async () => {
      delete process.env.MASTRA_PACKAGES_FILE;

      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler();

      expect(result).toEqual({ packages: [] });
    });

    it('should return empty array when MASTRA_PACKAGES_FILE points to invalid JSON', async () => {
      writeFileSync(tempFilePath, 'not-valid-json', 'utf-8');
      process.env.MASTRA_PACKAGES_FILE = tempFilePath;

      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler();

      expect(result).toEqual({ packages: [] });
    });

    it('should return empty array when MASTRA_PACKAGES_FILE points to non-existent file', async () => {
      process.env.MASTRA_PACKAGES_FILE = '/non/existent/path/packages.json';

      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler();

      expect(result).toEqual({ packages: [] });
    });
  });
});
