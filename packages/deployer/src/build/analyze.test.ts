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
   * Tests for GitHub issue #10893: https://github.com/mastra-ai/mastra/issues/10893
   *
   * Packages in the `externals` config should always be included in externalDependencies,
   * even if they aren't detected during static analysis. This is important for packages
   * that are dynamically imported at runtime (e.g., pino.transport({ target: "pkg-name" })).
   */
  describe('externals config handling', () => {
    it('should include dynamically-imported externals in externalDependencies', async () => {
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
            externals: ['pino-opentelemetry-transport'],
            enableSourcemap: false,
          },
        },
        noopLogger,
      );

      expect(result.externalDependencies.has('pino-opentelemetry-transport')).toBe(true);
    });

    it('should include all externals even when none are statically imported', async () => {
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
            externals: ['package-a', 'package-b', 'package-c'],
            enableSourcemap: false,
          },
        },
        noopLogger,
      );

      expect(result.externalDependencies.has('package-a')).toBe(true);
      expect(result.externalDependencies.has('package-b')).toBe(true);
      expect(result.externalDependencies.has('package-c')).toBe(true);
    });

    it('should include both detected and undetected externals', async () => {
      // lodash is statically imported, undetected-package is not
      const entryContent = `
        import lodash from 'lodash';
        export const map = lodash.map;
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
            externals: ['lodash', 'undetected-package'],
            enableSourcemap: false,
          },
        },
        noopLogger,
      );

      expect(result.externalDependencies.has('lodash')).toBe(true);
      expect(result.externalDependencies.has('undetected-package')).toBe(true);
    });
  });
});
