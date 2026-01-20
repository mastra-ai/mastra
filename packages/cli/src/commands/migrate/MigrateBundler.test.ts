import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the module
vi.mock('@mastra/deployer/build', () => ({
  FileService: vi.fn().mockImplementation(() => ({
    getFirstExistingFile: vi.fn().mockImplementation((files: string[]) => files[0]),
  })),
}));

vi.mock('@mastra/deployer/bundler', () => ({
  Bundler: class MockBundler {
    protected platform = 'node';
    constructor(_name: string) {}
    __setLogger(_logger: unknown) {}
    getAllToolPaths(_dir: string, _extra: unknown[]) {
      return [];
    }
    prepare(_path: string) {
      return Promise.resolve();
    }
    loadEnvVars() {
      return Promise.resolve(new Map());
    }
    protected _bundle(
      _entry: string,
      _entryFile: string,
      _options: unknown,
      _toolsPaths: unknown,
    ): Promise<void> {
      return Promise.resolve();
    }
  },
}));

// Import after mocks are set up
import { MigrateBundler } from './MigrateBundler';

describe('MigrateBundler', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    delete process.env.MASTRA_SKIP_DOTENV;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create bundler with Migrate name', () => {
      const bundler = new MigrateBundler();
      expect(bundler).toBeInstanceOf(MigrateBundler);
    });

    it('should accept custom env file', () => {
      const bundler = new MigrateBundler('.env.custom');
      expect(bundler).toBeInstanceOf(MigrateBundler);
    });
  });

  describe('getEntry', () => {
    it('should generate entry script that imports mastra from #mastra', () => {
      const bundler = new MigrateBundler();
      const entry = (bundler as any).getEntry();

      expect(entry).toContain("import { mastra } from '#mastra'");
    });

    it('should generate entry script that calls mastra.getStorage()', () => {
      const bundler = new MigrateBundler();
      const entry = (bundler as any).getEntry();

      expect(entry).toContain('mastra.getStorage()');
    });

    it('should generate entry script that calls storage.init()', () => {
      const bundler = new MigrateBundler();
      const entry = (bundler as any).getEntry();

      expect(entry).toContain('await storage.init()');
    });

    it('should generate entry script that calls observabilityStore.migrateSpans()', () => {
      const bundler = new MigrateBundler();
      const entry = (bundler as any).getEntry();

      expect(entry).toContain("storage.getStore('observability')");
      expect(entry).toContain('observabilityStore.migrateSpans()');
    });

    it('should generate entry script that outputs JSON result', () => {
      const bundler = new MigrateBundler();
      const entry = (bundler as any).getEntry();

      // Should output JSON with success, alreadyMigrated, duplicatesRemoved, message
      expect(entry).toContain('JSON.stringify');
      expect(entry).toContain('success');
      expect(entry).toContain('alreadyMigrated');
      expect(entry).toContain('duplicatesRemoved');
      expect(entry).toContain('message');
    });

    it('should generate entry script that handles missing storage', () => {
      const bundler = new MigrateBundler();
      const entry = (bundler as any).getEntry();

      expect(entry).toContain('Storage not configured');
    });

    it('should generate entry script that handles missing observability store', () => {
      const bundler = new MigrateBundler();
      const entry = (bundler as any).getEntry();

      expect(entry).toContain('Observability storage not configured');
    });

    it('should generate entry script that handles missing migrateSpans method', () => {
      const bundler = new MigrateBundler();
      const entry = (bundler as any).getEntry();

      expect(entry).toContain("typeof observabilityStore.migrateSpans !== 'function'");
      expect(entry).toContain('Migration not supported for this storage backend');
    });

    it('should generate entry script that catches and reports errors', () => {
      const bundler = new MigrateBundler();
      const entry = (bundler as any).getEntry();

      expect(entry).toContain('catch (error)');
      expect(entry).toContain('error instanceof Error ? error.message');
    });
  });

  describe('getEnvFiles', () => {
    it('should return env files when no custom env file specified', async () => {
      const bundler = new MigrateBundler();
      const envFiles = await bundler.getEnvFiles();

      expect(Array.isArray(envFiles)).toBe(true);
    });

    it('should accept custom env file', async () => {
      const bundler = new MigrateBundler('.env.production');
      const envFiles = await bundler.getEnvFiles();

      expect(Array.isArray(envFiles)).toBe(true);
    });

    it('should return empty array when MASTRA_SKIP_DOTENV is set to "true"', async () => {
      process.env.MASTRA_SKIP_DOTENV = 'true';

      const bundler = new MigrateBundler();
      const envFiles = await bundler.getEnvFiles();

      expect(envFiles).toEqual([]);
    });

    it('should return empty array when MASTRA_SKIP_DOTENV is "1"', async () => {
      process.env.MASTRA_SKIP_DOTENV = '1';

      const bundler = new MigrateBundler();
      const envFiles = await bundler.getEnvFiles();

      expect(envFiles).toEqual([]);
    });
  });
});

describe('MigrateBundler entry script behavior', () => {
  /**
   * These tests verify the expected runtime behavior of the generated entry script
   * by analyzing its structure. The actual runtime is tested in E2E tests.
   */

  it('should exit with code 1 when storage is not configured', () => {
    const bundler = new MigrateBundler();
    const entry = (bundler as any).getEntry();

    // The script should exit(1) after logging "Storage not configured"
    expect(entry).toMatch(/Storage not configured.*process\.exit\(1\)/s);
  });

  it('should exit with code 0 when observability storage is not configured', () => {
    const bundler = new MigrateBundler();
    const entry = (bundler as any).getEntry();

    // The script should exit(0) after logging "Observability storage not configured"
    expect(entry).toMatch(/Observability storage not configured.*process\.exit\(0\)/s);
  });

  it('should exit with code 1 when migrateSpans is not supported', () => {
    const bundler = new MigrateBundler();
    const entry = (bundler as any).getEntry();

    // The script should exit(1) after logging "Migration not supported"
    expect(entry).toMatch(/Migration not supported.*process\.exit\(1\)/s);
  });

  it('should exit based on migration result success', () => {
    const bundler = new MigrateBundler();
    const entry = (bundler as any).getEntry();

    // The script should exit based on result.success
    expect(entry).toContain('process.exit(result.success ? 0 : 1)');
  });
});
