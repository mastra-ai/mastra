import { cp } from 'node:fs/promises';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock node:fs/promises - BuildBundler uses cp from this module
vi.mock('node:fs/promises', async importOriginal => {
  const original = await importOriginal();
  return {
    ...original,
    cp: vi.fn(),
    mkdir: vi.fn(),
    rm: vi.fn(),
  };
});

vi.mock('@mastra/deployer/build', () => {
  class MockFileService {
    getFirstExistingFile = vi.fn().mockReturnValue('.env');
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

      expect(cp).toHaveBeenCalledTimes(1);
      expect(cp).toHaveBeenCalledWith(expect.stringContaining('dist/studio'), expect.stringContaining('studio'), {
        recursive: true,
      });
    });

    it('should not copy studio assets when studio is false', async () => {
      const { BuildBundler } = await import('./BuildBundler');
      const bundler = new BuildBundler({ studio: false });

      await bundler.prepare('/output/dir');

      expect(cp).not.toHaveBeenCalled();
    });

    it('should not copy studio assets when studio is not provided', async () => {
      const { BuildBundler } = await import('./BuildBundler');
      const bundler = new BuildBundler();

      await bundler.prepare('/output/dir');

      expect(cp).not.toHaveBeenCalled();
    });
  });
});
