import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET_SYSTEM_PACKAGES_ROUTE } from './system';

const createMockMastra = (hasEditor: boolean) =>
  ({
    getEditor: () => (hasEditor ? {} : undefined),
  }) as any;

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

      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler({ mastra: createMockMastra(false) } as any);

      expect(result).toEqual({ packages, isDev: false, cmsEnabled: false });
    });

    it('should return empty array when MASTRA_PACKAGES_FILE is not set', async () => {
      delete process.env.MASTRA_PACKAGES_FILE;

      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler({ mastra: createMockMastra(false) } as any);

      expect(result).toEqual({ packages: [], isDev: false, cmsEnabled: false });
    });

    it('should return empty array when MASTRA_PACKAGES_FILE points to invalid JSON', async () => {
      writeFileSync(tempFilePath, 'not-valid-json', 'utf-8');
      process.env.MASTRA_PACKAGES_FILE = tempFilePath;

      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler({ mastra: createMockMastra(false) } as any);

      expect(result).toEqual({ packages: [], isDev: false, cmsEnabled: false });
    });

    it('should return empty array when MASTRA_PACKAGES_FILE points to non-existent file', async () => {
      process.env.MASTRA_PACKAGES_FILE = '/non/existent/path/packages.json';

      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler({ mastra: createMockMastra(false) } as any);

      expect(result).toEqual({ packages: [], isDev: false, cmsEnabled: false });
    });

    it('should return isDev true when MASTRA_DEV is set', async () => {
      process.env.MASTRA_DEV = 'true';
      delete process.env.MASTRA_PACKAGES_FILE;

      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler({ mastra: createMockMastra(false) } as any);

      expect(result).toEqual({ packages: [], isDev: true, cmsEnabled: false });
    });

    it('should return cmsEnabled true when editor is configured', async () => {
      delete process.env.MASTRA_PACKAGES_FILE;

      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler({ mastra: createMockMastra(true) } as any);

      expect(result).toEqual({ packages: [], isDev: false, cmsEnabled: true });
    });

    it('should return cmsEnabled false when editor is not configured', async () => {
      delete process.env.MASTRA_PACKAGES_FILE;

      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler({ mastra: createMockMastra(false) } as any);

      expect(result).toEqual({ packages: [], isDev: false, cmsEnabled: false });
    });
  });
});
