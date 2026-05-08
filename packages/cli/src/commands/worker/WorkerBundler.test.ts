import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('fs-extra/esm', () => ({
  copy: vi.fn(),
  emptyDir: vi.fn().mockResolvedValue(undefined),
  ensureDir: vi.fn().mockResolvedValue(undefined),
  default: {},
}));

vi.mock('fs-extra', () => ({
  copy: vi.fn(),
}));

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

describe('WorkerBundler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getEntry', () => {
    it('emits a role-agnostic worker entry that calls startWorkers() with no arg', async () => {
      const { WorkerBundler } = await import('./WorkerBundler');
      const bundler = new WorkerBundler();

      const entry = (bundler as any).getEntry();

      expect(entry).toContain("import { mastra } from '#mastra'");
      expect(entry).toContain('mastra.startWorkers()');
      expect(entry).toContain('mastra.stopWorkers()');
      expect(entry).toContain("process.on('SIGINT'");
      expect(entry).toContain("process.on('SIGTERM'");
    });

    it('does not interpolate a worker name into the entry source', async () => {
      const { WorkerBundler } = await import('./WorkerBundler');
      const bundler = new WorkerBundler();

      const entry = (bundler as any).getEntry();

      // role is determined at runtime via MASTRA_WORKERS, not baked into the bundle
      expect(entry).not.toMatch(/startWorkers\(['"`]/);
    });
  });

  describe('bundle', () => {
    it('passes "worker" as the entry name so rollup writes worker.mjs', async () => {
      const { WorkerBundler } = await import('./WorkerBundler');
      const bundler = new WorkerBundler();

      const calls: unknown[][] = [];
      (bundler as unknown as { _bundle: (...args: unknown[]) => Promise<void> })._bundle = async (
        ...args: unknown[]
      ) => {
        calls.push(args);
      };

      await bundler.bundle('/path/to/mastra/index.ts', '/output', { toolsPaths: [], projectRoot: '/proj' });

      expect(calls).toHaveLength(1);
      // [virtualEntrySource, mastraEntryFile, opts, toolsPaths, bundleLocation, entryName]
      expect(calls[0][5]).toBe('worker');
    });
  });
});
