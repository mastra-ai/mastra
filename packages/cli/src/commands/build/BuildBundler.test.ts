import { copy } from 'fs-extra';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs-extra/esm - parent Bundler uses this import path
vi.mock('fs-extra/esm', () => ({
  copy: vi.fn(),
  emptyDir: vi.fn().mockResolvedValue(undefined),
  ensureDir: vi.fn().mockResolvedValue(undefined),
  default: {},
}));

// Mock fs-extra - BuildBundler uses this import path
vi.mock('fs-extra', () => ({
  copy: vi.fn(),
}));

vi.mock('@mastra/deployer/build', () => {
  class MockFileService {
    getFirstExistingFile = vi.fn().mockReturnValue('.env');
    getExistingFiles = vi.fn((files: string[]) => files);
  }

  return {
    FileService: MockFileService,
  };
});

vi.mock('../utils.js', () => ({
  shouldSkipDotenvLoading: vi.fn().mockReturnValue(false),
}));

describe('BuildBundler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should default studio to false when not provided', async () => {
      const { BuildBundler } = await import('./BuildBundler');
      const bundler = new BuildBundler();

      // Access the protected getEntry method to verify studio value
      const entry = (bundler as any).getEntry();
      expect(entry).toContain('studio: false');
    });

    it('should default studio to false when empty options provided', async () => {
      const { BuildBundler } = await import('./BuildBundler');
      const bundler = new BuildBundler({});

      const entry = (bundler as any).getEntry();
      expect(entry).toContain('studio: false');
    });

    it('should set studio to true when provided', async () => {
      const { BuildBundler } = await import('./BuildBundler');
      const bundler = new BuildBundler({ studio: true });

      const entry = (bundler as any).getEntry();
      expect(entry).toContain('studio: true');
    });

    it('should set studio to false when explicitly provided', async () => {
      const { BuildBundler } = await import('./BuildBundler');
      const bundler = new BuildBundler({ studio: false });

      const entry = (bundler as any).getEntry();
      expect(entry).toContain('studio: false');
    });
  });

  describe('getEnvFiles', () => {
    it('layers default dotenv files from base to production override', async () => {
      const { BuildBundler } = await import('./BuildBundler');

      await expect(new BuildBundler().getEnvFiles()).resolves.toEqual(['.env', '.env.local', '.env.production']);
    });
  });

  describe('bundler options', () => {
    it('defaults to externals true when no bundler config is provided', async () => {
      const { Bundler, IS_DEFAULT } = await import('@mastra/deployer/bundler');
      vi.spyOn(Bundler.prototype as any, 'getUserBundlerOptions').mockResolvedValueOnce({
        externals: [],
        sourcemap: false,
        transpilePackages: [],
        [IS_DEFAULT]: true,
      });
      const { BuildBundler } = await import('./BuildBundler');
      const bundler = new BuildBundler();

      const options = await (bundler as any).getUserBundlerOptions('/entry.ts', '/output');

      expect(options).toMatchObject({
        externals: true,
        sourcemap: false,
      });
    });

    it('defaults to externals true when a bundler config omits externals', async () => {
      const { Bundler } = await import('@mastra/deployer/bundler');
      vi.spyOn(Bundler.prototype as any, 'getUserBundlerOptions').mockResolvedValueOnce({ sourcemap: true });
      const { BuildBundler } = await import('./BuildBundler');
      const bundler = new BuildBundler();

      const options = await (bundler as any).getUserBundlerOptions('/entry.ts', '/output');

      expect(options).toEqual({
        externals: true,
        sourcemap: true,
      });
    });

    it('keeps configured externals as runtime dependencies while preserving externals true', async () => {
      const { Bundler } = await import('@mastra/deployer/bundler');
      vi.spyOn(Bundler.prototype as any, 'getUserBundlerOptions').mockResolvedValueOnce({
        externals: ['@duckdb/node-bindings', 'existing-package'],
        dynamicPackages: ['existing-package', 'dynamic-package'],
      });
      const { BuildBundler } = await import('./BuildBundler');
      const bundler = new BuildBundler();

      const options = await (bundler as any).getUserBundlerOptions('/entry.ts', '/output');

      expect(options).toEqual({
        externals: true,
        dynamicPackages: ['existing-package', 'dynamic-package', '@duckdb/node-bindings'],
      });
    });

    it.each([true, false])('preserves explicit externals %s in a custom bundler config', async externals => {
      const { Bundler } = await import('@mastra/deployer/bundler');
      vi.spyOn(Bundler.prototype as any, 'getUserBundlerOptions').mockResolvedValueOnce({
        externals,
        sourcemap: true,
      });
      const { BuildBundler } = await import('./BuildBundler');
      const bundler = new BuildBundler();

      const options = await (bundler as any).getUserBundlerOptions('/entry.ts', '/output');

      expect(options).toEqual({
        externals,
        sourcemap: true,
      });
    });
  });

  describe('getEntry', () => {
    it('should include studio: true when studio is enabled', async () => {
      const { BuildBundler } = await import('./BuildBundler');
      const bundler = new BuildBundler({ studio: true });

      const entry = (bundler as any).getEntry();

      expect(entry).toContain('studio: true');
      expect(entry).toContain('createNodeServer');
      expect(entry).toContain('getToolExports');
    });

    it('should include studio: false when studio is disabled', async () => {
      const { BuildBundler } = await import('./BuildBundler');
      const bundler = new BuildBundler({ studio: false });

      const entry = (bundler as any).getEntry();

      expect(entry).toContain('studio: false');
      expect(entry).toContain('createNodeServer');
      expect(entry).toContain('getToolExports');
    });
  });

  describe('prepare', () => {
    it('should copy studio assets when studio is true', async () => {
      const { BuildBundler } = await import('./BuildBundler');
      const bundler = new BuildBundler({ studio: true });

      await bundler.prepare('/output/dir');

      expect(copy).toHaveBeenCalledTimes(1);
      expect(copy).toHaveBeenCalledWith(expect.stringContaining('dist/studio'), expect.stringContaining('studio'), {
        overwrite: true,
      });
    });

    it('should not copy studio assets when studio is false', async () => {
      const { BuildBundler } = await import('./BuildBundler');
      const bundler = new BuildBundler({ studio: false });

      await bundler.prepare('/output/dir');

      expect(copy).not.toHaveBeenCalled();
    });

    it('should not copy studio assets when studio is not provided', async () => {
      const { BuildBundler } = await import('./BuildBundler');
      const bundler = new BuildBundler();

      await bundler.prepare('/output/dir');

      expect(copy).not.toHaveBeenCalled();
    });
  });
});
