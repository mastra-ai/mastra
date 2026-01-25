/**
 * Tests for AdminBundler.
 *
 * Verifies that AdminBundler correctly:
 * - Finds Mastra entry files (getMastraEntryFile)
 * - Finds Mastra app directories (getMastraAppDir)
 * - Generates valid entry code with FileExporter injection (getEntry)
 */

import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AdminBundler, type AdminBundlerOptions } from './admin-bundler';

describe('AdminBundler', () => {
  let testDir: string;
  let bundler: AdminBundler;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'admin-bundler-test-'));
    bundler = new AdminBundler();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should create AdminBundler instance', () => {
      const b = new AdminBundler();
      expect(b).toBeDefined();
    });
  });

  describe('getMastraEntryFile', () => {
    it('should find entry file at src/mastra/index.ts', async () => {
      // Create src/mastra/index.ts
      const mastraDir = path.join(testDir, 'src', 'mastra');
      await fs.mkdir(mastraDir, { recursive: true });
      await fs.writeFile(path.join(mastraDir, 'index.ts'), 'export const mastra = {};');

      const result = bundler['getMastraEntryFile'](testDir);
      expect(result).toBe(path.join(testDir, 'src', 'mastra', 'index.ts'));
    });

    it('should find entry file at src/mastra/index.js', async () => {
      // Create src/mastra/index.js
      const mastraDir = path.join(testDir, 'src', 'mastra');
      await fs.mkdir(mastraDir, { recursive: true });
      await fs.writeFile(path.join(mastraDir, 'index.js'), 'export const mastra = {};');

      const result = bundler['getMastraEntryFile'](testDir);
      expect(result).toBe(path.join(testDir, 'src', 'mastra', 'index.js'));
    });

    it('should find entry file at mastra/index.ts', async () => {
      // Create mastra/index.ts (not in src)
      const mastraDir = path.join(testDir, 'mastra');
      await fs.mkdir(mastraDir, { recursive: true });
      await fs.writeFile(path.join(mastraDir, 'index.ts'), 'export const mastra = {};');

      const result = bundler['getMastraEntryFile'](testDir);
      expect(result).toBe(path.join(testDir, 'mastra', 'index.ts'));
    });

    it('should find entry file at mastra/index.js', async () => {
      // Create mastra/index.js (not in src)
      const mastraDir = path.join(testDir, 'mastra');
      await fs.mkdir(mastraDir, { recursive: true });
      await fs.writeFile(path.join(mastraDir, 'index.js'), 'export const mastra = {};');

      const result = bundler['getMastraEntryFile'](testDir);
      expect(result).toBe(path.join(testDir, 'mastra', 'index.js'));
    });

    it('should prefer src/mastra/index.ts over mastra/index.ts', async () => {
      // Create both locations
      const srcMastraDir = path.join(testDir, 'src', 'mastra');
      const mastraDir = path.join(testDir, 'mastra');
      await fs.mkdir(srcMastraDir, { recursive: true });
      await fs.mkdir(mastraDir, { recursive: true });
      await fs.writeFile(path.join(srcMastraDir, 'index.ts'), 'export const mastra = {};');
      await fs.writeFile(path.join(mastraDir, 'index.ts'), 'export const mastra = {};');

      const result = bundler['getMastraEntryFile'](testDir);
      // src/mastra/index.ts should be preferred (first in search order)
      expect(result).toBe(path.join(testDir, 'src', 'mastra', 'index.ts'));
    });

    it('should throw error when no entry file found', async () => {
      // Empty directory - no mastra entry file
      expect(() => bundler['getMastraEntryFile'](testDir)).toThrow('No Mastra entry file found');
    });

    it('should include searched paths in error message', async () => {
      try {
        bundler['getMastraEntryFile'](testDir);
        expect.fail('Should have thrown');
      } catch (err) {
        const message = (err as Error).message;
        expect(message).toContain('src/mastra/index.ts');
        expect(message).toContain('src/mastra/index.js');
        expect(message).toContain('mastra/index.ts');
        expect(message).toContain('mastra/index.js');
        expect(message).toContain('Ensure your project has a mastra/index.ts');
      }
    });
  });

  describe('getMastraAppDir', () => {
    it('should find mastra directory at src/mastra/', async () => {
      // Create src/mastra/
      const mastraDir = path.join(testDir, 'src', 'mastra');
      await fs.mkdir(mastraDir, { recursive: true });
      await fs.writeFile(path.join(mastraDir, 'index.ts'), '');

      const result = bundler['getMastraAppDir'](testDir);
      expect(result).toBe(mastraDir);
    });

    it('should find mastra directory at mastra/', async () => {
      // Create mastra/ (not in src)
      const mastraDir = path.join(testDir, 'mastra');
      await fs.mkdir(mastraDir, { recursive: true });
      await fs.writeFile(path.join(mastraDir, 'index.ts'), '');

      const result = bundler['getMastraAppDir'](testDir);
      expect(result).toBe(mastraDir);
    });

    it('should prefer src/mastra/ over mastra/', async () => {
      // Create both locations
      const srcMastraDir = path.join(testDir, 'src', 'mastra');
      const mastraDir = path.join(testDir, 'mastra');
      await fs.mkdir(srcMastraDir, { recursive: true });
      await fs.mkdir(mastraDir, { recursive: true });

      const result = bundler['getMastraAppDir'](testDir);
      // src/mastra/ should be preferred
      expect(result).toBe(srcMastraDir);
    });

    it('should throw error when no mastra directory found', async () => {
      // Empty directory - no mastra directory
      expect(() => bundler['getMastraAppDir'](testDir)).toThrow('No Mastra directory found');
    });

    it('should include expected paths in error message', async () => {
      try {
        bundler['getMastraAppDir'](testDir);
        expect.fail('Should have thrown');
      } catch (err) {
        const message = (err as Error).message;
        expect(message).toContain('src/mastra');
        expect(message).toContain('/mastra');
        expect(message).toContain('Expected one of:');
      }
    });
  });

  describe('getEntry', () => {
    const testOptions: AdminBundlerOptions = {
      projectId: 'proj_test_123',
      deploymentId: 'dep_test_456',
      serverId: 'server_test_789',
      observabilityPath: '/path/to/observability',
    };

    it('should generate valid JavaScript entry code', () => {
      const entry = bundler['getEntry'](testOptions);

      // Should be a non-empty string
      expect(typeof entry).toBe('string');
      expect(entry.length).toBeGreaterThan(0);
    });

    it('should include ADMIN_CONFIG constant with correct values', () => {
      const entry = bundler['getEntry'](testOptions);

      expect(entry).toContain('ADMIN_CONFIG');
      expect(entry).toContain(`projectId: '${testOptions.projectId}'`);
      expect(entry).toContain(`deploymentId: '${testOptions.deploymentId}'`);
      expect(entry).toContain(`serverId: '${testOptions.serverId}'`);
      expect(entry).toContain(`observabilityPath: '${testOptions.observabilityPath}'`);
    });

    it('should include FileExporter import', () => {
      const entry = bundler['getEntry'](testOptions);

      expect(entry).toContain("import('@mastra/observability')");
      expect(entry).toContain('FileExporter');
    });

    it('should include FileExporter initialization with correct config', () => {
      const entry = bundler['getEntry'](testOptions);

      expect(entry).toContain('new FileExporter({');
      expect(entry).toContain('outputPath: ADMIN_CONFIG.observabilityPath');
      expect(entry).toContain('projectId: ADMIN_CONFIG.projectId');
      expect(entry).toContain('deploymentId: ADMIN_CONFIG.deploymentId');
      expect(entry).toContain('maxBatchSize: 50');
      expect(entry).toContain('maxBatchWaitMs: 3000');
    });

    it('should include observability injection code', () => {
      const entry = bundler['getEntry'](testOptions);

      expect(entry).toContain('mastra.observability');
      expect(entry).toContain('addExporter');
      expect(entry).toContain('registerExporter');
    });

    it('should include admin initialization logging', () => {
      const entry = bundler['getEntry'](testOptions);

      expect(entry).toContain('[Admin] Initializing observability');
      expect(entry).toContain('[Admin] Added FileExporter');
      expect(entry).toContain('[Admin] Registered FileExporter');
      expect(entry).toContain('[Admin] Storage initialized');
      expect(entry).toContain('[Admin] Starting server');
      expect(entry).toContain('[Admin] Server started successfully');
    });

    it('should include graceful shutdown handlers', () => {
      const entry = bundler['getEntry'](testOptions);

      expect(entry).toContain("process.on('SIGTERM'");
      expect(entry).toContain("process.on('SIGINT'");
      expect(entry).toContain('[Admin] Shutting down FileExporter');
      expect(entry).toContain('fileExporter.shutdown()');
    });

    it('should include standard server imports', () => {
      const entry = bundler['getEntry'](testOptions);

      expect(entry).toContain("import { createNodeServer, getToolExports } from '#server'");
      expect(entry).toContain("import { tools } from '#tools'");
      expect(entry).toContain("import { mastra } from '#mastra'");
    });

    it('should include storage initialization', () => {
      const entry = bundler['getEntry'](testOptions);

      expect(entry).toContain('mastra.storage');
      expect(entry).toContain('mastra.storage.init()');
    });

    it('should include server creation with correct options', () => {
      const entry = bundler['getEntry'](testOptions);

      expect(entry).toContain('createNodeServer(mastra');
      expect(entry).toContain('studio: false');
      expect(entry).toContain('swaggerUI: false');
      expect(entry).toContain('tools: getToolExports(tools)');
    });

    it('should handle special characters in paths safely', () => {
      const specialOptions: AdminBundlerOptions = {
        projectId: "proj'test",
        deploymentId: 'dep"test',
        serverId: 'server\\test',
        observabilityPath: "/path/with spaces/and'quotes",
      };

      // Should not throw
      const entry = bundler['getEntry'](specialOptions);
      expect(entry).toContain(specialOptions.projectId);
    });

    it('should include error handling for FileExporter initialization', () => {
      const entry = bundler['getEntry'](testOptions);

      expect(entry).toContain('try {');
      expect(entry).toContain('} catch (err) {');
      expect(entry).toContain('[Admin] Failed to initialize FileExporter');
    });

    it('should include warning for missing observability instance', () => {
      const entry = bundler['getEntry'](testOptions);

      expect(entry).toContain('[Admin] Could not inject FileExporter - no compatible observability instance');
    });
  });

  describe('getStandardEntry', () => {
    it('should generate standard entry without admin injection', () => {
      const entry = bundler['getStandardEntry']();

      expect(entry).toContain("import { createNodeServer, getToolExports } from '#server'");
      expect(entry).toContain("import { tools } from '#tools'");
      expect(entry).toContain("import { mastra } from '#mastra'");
      expect(entry).toContain('createNodeServer(mastra');
      expect(entry).toContain('mastra.storage');
    });

    it('should not include admin-specific code', () => {
      const entry = bundler['getStandardEntry']();

      expect(entry).not.toContain('ADMIN_CONFIG');
      expect(entry).not.toContain('FileExporter');
      expect(entry).not.toContain('[Admin]');
    });
  });

  describe('getEnvFiles', () => {
    it('should return empty array', async () => {
      const result = await bundler.getEnvFiles();
      expect(result).toEqual([]);
    });
  });
});
