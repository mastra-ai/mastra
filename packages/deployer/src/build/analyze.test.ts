import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyzeBundle } from './analyze';
import { noopLogger } from '@mastra/core/logger';
import { join } from 'node:path';
import { ensureDir, remove, writeFile, pathExists } from 'fs-extra';
import { tmpdir } from 'node:os';

vi.mock('../bundler/workspaceDependencies', () => ({
  getWorkspaceInformation: vi.fn().mockResolvedValue({
    workspaceMap: new Map(),
    workspaceRoot: null,
    isWorkspacePackage: false,
  }),
}));

describe('analyzeBundle', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), 'analyzeBundle-test-' + Date.now());
    await ensureDir(testDir);
    await ensureDir(join(testDir, '.mastra', '.build'));
  });

  afterEach(async () => {
    if (await pathExists(testDir)) {
      await remove(testDir);
    }
  });

  /**
   * Tests for pino transport auto-detection and dynamicPackages config.
   * Packages that are loaded dynamically at runtime (e.g., pino.transport({ target: "pkg-name" }))
   * should be automatically detected or manually specified via dynamicPackages.
   */
  describe('dynamicPackages config handling', () => {
    it('should auto-detect pino transport targets in externalDependencies', async () => {
      // pino-opentelemetry-transport is loaded via string target, not static import
      const entryContent = `
        import pino from 'pino';
        
        const transport = pino.transport({
          target: "pino-opentelemetry-transport",
          options: { resourceAttributes: { "service.name": "test" } },
        });
        
        export const logger = pino(transport);
      `;

      const mastraEntry = join(testDir, 'mastra.ts');
      await writeFile(mastraEntry, `export const mastra = {};`);

      const result = await analyzeBundle(
        [entryContent],
        mastraEntry,
        {
          outputDir: join(testDir, '.mastra', '.build'),
          projectRoot: testDir,
          platform: 'node',
          bundlerOptions: {
            externals: [],
            enableSourcemap: false,
          },
        },
        noopLogger,
      );

      // pino-opentelemetry-transport should be auto-detected from the code
      expect(result.externalDependencies.has('pino-opentelemetry-transport')).toBe(true);
    });

    it('should include dynamicPackages even when none are statically imported', async () => {
      const entryContent = `export const config = { foo: "bar" };`;

      const mastraEntry = join(testDir, 'mastra.ts');
      await writeFile(mastraEntry, `export const mastra = {};`);

      const result = await analyzeBundle(
        [entryContent],
        mastraEntry,
        {
          outputDir: join(testDir, '.mastra', '.build'),
          projectRoot: testDir,
          platform: 'node',
          bundlerOptions: {
            externals: [],
            dynamicPackages: ['package-a', 'package-b', 'package-c'],
            enableSourcemap: false,
          },
        },
        noopLogger,
      );

      expect(result.externalDependencies.has('package-a')).toBe(true);
      expect(result.externalDependencies.has('package-b')).toBe(true);
      expect(result.externalDependencies.has('package-c')).toBe(true);
    });

    it('should include both auto-detected and manually specified dynamicPackages', async () => {
      // pino transport is auto-detected, custom-plugin is manually specified
      const entryContent = `
        import pino from 'pino';
        const transport = pino.transport({ target: "pino-pretty" });
        export const logger = pino(transport);
      `;

      const mastraEntry = join(testDir, 'mastra.ts');
      await writeFile(mastraEntry, `export const mastra = {};`);

      const result = await analyzeBundle(
        [entryContent],
        mastraEntry,
        {
          outputDir: join(testDir, '.mastra', '.build'),
          projectRoot: testDir,
          platform: 'node',
          bundlerOptions: {
            externals: [],
            dynamicPackages: ['custom-plugin'],
            enableSourcemap: false,
          },
        },
        noopLogger,
      );

      // pino-pretty should be auto-detected and custom-plugin manually specified
      expect(result.externalDependencies.has('pino-pretty')).toBe(true);
      expect(result.externalDependencies.has('custom-plugin')).toBe(true);
    });

    it('should detect multiple pino transport targets', async () => {
      const entryContent = `
        import pino from 'pino';
        const transport = pino.transport({
          targets: [
            { target: "pino-pretty", level: "info" },
            { target: "pino-opentelemetry-transport", level: "debug" }
          ]
        });
        export const logger = pino(transport);
      `;

      const mastraEntry = join(testDir, 'mastra.ts');
      await writeFile(mastraEntry, `export const mastra = {};`);

      const result = await analyzeBundle(
        [entryContent],
        mastraEntry,
        {
          outputDir: join(testDir, '.mastra', '.build'),
          projectRoot: testDir,
          platform: 'node',
          bundlerOptions: {
            externals: [],
            enableSourcemap: false,
          },
        },
        noopLogger,
      );

      expect(result.externalDependencies.has('pino-pretty')).toBe(true);
      expect(result.externalDependencies.has('pino-opentelemetry-transport')).toBe(true);
    });
  });
});
