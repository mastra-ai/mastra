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

  describe('output directory', () => {
    it('defaults to the same "output" folder as the server build (overwriting is the default)', async () => {
      const { WorkerBundler } = await import('./WorkerBundler');
      const bundler = new WorkerBundler();

      expect((bundler as unknown as { outputDir: string }).outputDir).toBe('output');
    });

    it('honors a user-supplied outputDir leaf', async () => {
      const { WorkerBundler } = await import('./WorkerBundler');
      const bundler = new WorkerBundler({ outputDir: '.' });

      expect((bundler as unknown as { outputDir: string }).outputDir).toBe('.');
    });
  });
});
