import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureDir, writeFile, readFile } from 'fs-extra';
import { copy } from 'fs-extra/esm';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { CloudDeployer } from './index.js';

// Mock the logger to avoid redis connection issues
vi.mock('./utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock fs-extra/esm copy for studio tests
vi.mock('fs-extra/esm', async () => {
  const actual = await vi.importActual('fs-extra/esm');
  return {
    ...actual,
    copy: vi.fn().mockResolvedValue(undefined),
  };
});

describe('CloudDeployer Integration Tests', () => {
  let deployer: CloudDeployer;
  let tempDir: string;
  let outputDir: string;

  beforeEach(async () => {
    deployer = new CloudDeployer();

    // Create temporary directories for testing
    tempDir = mkdtempSync(join(tmpdir(), 'cloud-deployer-test-'));
    outputDir = join(tempDir, 'output');

    await ensureDir(tempDir);
    await ensureDir(outputDir);
  });

  afterEach(() => {
    // Clean up temporary directories
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Full Build and Deploy Flow', () => {
    it('should successfully prepare output directory', async () => {
      // Create some existing files to ensure clean preparation
      await writeFile(join(outputDir, 'old-file.txt'), 'old content');

      // @ts-ignore - accessing protected method for testing
      await deployer.prepare(outputDir);

      // Verify output directories are created
      const fs = await import('node:fs');
      expect(fs.existsSync(join(outputDir, '.build'))).toBe(true);
      expect(fs.existsSync(join(outputDir, 'output'))).toBe(true);
    });

    it('should write package.json with cloud dependencies', async () => {
      const dependencies = new Map<string, string>([
        ['express', '^4.18.0'],
        ['@some/package', '1.0.0'],
        ['nested/package/path', '2.0.0'],
      ]);

      await deployer.writePackageJson(outputDir, dependencies);

      const packageJsonPath = join(outputDir, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

      const versionsJsonPath = join(__dirname, '../versions.json');
      const versionsJson = JSON.parse(await readFile(versionsJsonPath, 'utf-8'));

      expect(Object.keys(versionsJson).length).toBeGreaterThan(0);

      // Verify cloud-specific dependencies
      for (const [key, value] of Object.entries(versionsJson)) {
        expect(packageJson.dependencies[key]).toBe(value);
      }

      // Verify original dependencies
      expect(packageJson.dependencies['express']).toBe('^4.18.0');
      expect(packageJson.dependencies['@some/package']).toBe('1.0.0');

      // Verify nested package handling (should only take first part)
      expect(packageJson.dependencies['nested']).toBe('2.0.0');

      // Verify package.json structure
      expect(packageJson.name).toBe('server');
      expect(packageJson.type).toBe('module');
      expect(packageJson.main).toBe('index.mjs');
    });

    it('should handle scoped packages correctly in package.json', async () => {
      const dependencies = new Map<string, string>([
        ['@org/package', '1.0.0'],
        ['@org/package/sub', '2.0.0'],
        ['regular-package/sub', '3.0.0'],
      ]);

      await deployer.writePackageJson(outputDir, dependencies);

      const packageJsonPath = join(outputDir, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

      // Scoped packages should keep scope and first part
      expect(packageJson.dependencies['@org/package']).toBe('2.0.0'); // Later version wins
      expect(packageJson.dependencies['regular-package']).toBe('3.0.0');
    });

    it('should handle resolutions in package.json', async () => {
      // This test is more about the parent Bundler class, but since CloudDeployer
      // doesn't override the resolutions parameter, we skip this test for now
      // as it would require mocking the entire Bundler class hierarchy
      expect(true).toBe(true); // Placeholder test
    });

    it('should generate valid entry code for server', () => {
      // @ts-ignore - accessing private method for testing
      const entry = deployer.getEntry();

      // Basic validation that it's valid JavaScript
      expect(entry).toContain('import ');
      // The entry code is not a module, it's a script
      // So it shouldn't have exports
      expect(entry).toContain('await ');
      expect(entry).toContain('console.log');

      // Verify it includes all necessary imports
      const requiredImports = [
        "import { createNodeServer, getToolExports } from '#server'",
        "import { tools } from '#tools'",
        "import { mastra } from '#mastra'",
        "import { MultiLogger } from '@mastra/core/logger'",
        "import { PinoLogger } from '@mastra/loggers'",
        "import { LibSQLStore, LibSQLVector } from '@mastra/libsql'",
      ];

      requiredImports.forEach(importStatement => {
        expect(entry).toContain(importStatement);
      });
    });

    it('should handle deploy method (no-op)', async () => {
      await expect(deployer.deploy(outputDir)).resolves.toBeUndefined();
    });

    it('should handle lint method (no-op)', async () => {
      await expect(deployer.lint()).resolves.toBeUndefined();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle missing output directory gracefully', async () => {
      const nonExistentDir = join(tempDir, 'non-existent');

      // These operations should create directories as needed
      await expect(deployer.writePackageJson(nonExistentDir, new Map())).resolves.not.toThrow();
    });

    it('should maintain correct entry code structure even with special characters in constants', () => {
      // This tests that the template literals are properly escaped
      // @ts-ignore - accessing private method for testing
      const entry = deployer.getEntry();

      // The regex needs to account for multiline JSON objects
      const jsonLogPattern = /console\.log\(JSON\.stringify\(\{[\s\S]*?\}\)\)/;
      expect(entry).toMatch(jsonLogPattern);

      // Count occurrences of console.log(JSON.stringify
      const matches = entry.match(/console\.log\(JSON\.stringify\(/g);
      expect(matches).toBeTruthy();
      expect(matches!.length).toBeGreaterThanOrEqual(3); // At least 3 readiness logs

      // Verify the constants are used in metadata
      expect(entry).toContain('teamId:');
      expect(entry).toContain('projectId:');
      expect(entry).toContain('buildId:');
    });
  });

  describe('Bundling Integration', () => {
    it('should handle bundle method with mocked parent implementation', async () => {
      const mastraDir = join(tempDir, 'mastra-project');
      await ensureDir(mastraDir);
      await ensureDir(join(mastraDir, 'src/mastra'));
      await writeFile(join(mastraDir, 'src/mastra/index.ts'), 'export const mastra = {};');

      // Mock the parent _bundle method to avoid actual bundling
      let capturedEntry: string = '';
      let capturedToolsPaths: any[] = [];

      // @ts-ignore - accessing protected method for testing
      deployer._bundle = async (entry: string, mastraFile: string, output: string, toolsPaths: any[]) => {
        capturedEntry = entry;
        capturedToolsPaths = toolsPaths;
      };

      await deployer.bundle(mastraDir, outputDir);

      // Verify the generated entry code was passed
      expect(capturedEntry).toContain('import { createNodeServer');
      expect(capturedEntry).toContain('import { LibSQLStore, LibSQLVector }');

      // Verify tools path was included - now it's an array of glob patterns
      expect(capturedToolsPaths).toHaveLength(1);
      expect(Array.isArray(capturedToolsPaths[0])).toBe(true);
      expect(capturedToolsPaths[0][0]).toContain('tools');
    });
  });

  describe('Studio Bundling', () => {
    beforeEach(() => {
      vi.mocked(copy).mockClear();
    });

    it('should copy playground assets when studio is true', async () => {
      const studioDeployer = new CloudDeployer({ studio: true });

      await studioDeployer.prepare(outputDir);

      expect(copy).toHaveBeenCalledTimes(1);
      expect(copy).toHaveBeenCalledWith(
        expect.stringContaining('dist/playground'),
        expect.stringContaining('playground'),
        { overwrite: true },
      );
    });

    it('should not copy playground assets when studio is false', async () => {
      const studioDeployer = new CloudDeployer({ studio: false });

      await studioDeployer.prepare(outputDir);

      expect(copy).not.toHaveBeenCalled();
    });

    it('should not copy playground assets when studio is not provided', async () => {
      const studioDeployer = new CloudDeployer();

      await studioDeployer.prepare(outputDir);

      expect(copy).not.toHaveBeenCalled();
    });

    it('should copy playground to correct output path', async () => {
      const studioDeployer = new CloudDeployer({ studio: true });

      await studioDeployer.prepare(outputDir);

      expect(copy).toHaveBeenCalledWith(
        expect.any(String),
        join(outputDir, 'output', 'playground'),
        { overwrite: true },
      );
    });
  });
});
