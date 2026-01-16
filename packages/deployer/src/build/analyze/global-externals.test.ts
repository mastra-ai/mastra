import { describe, it, expect } from 'vitest';
import { GLOBAL_EXTERNALS } from './constants';
import { isDependencyPartOfPackage } from '../utils';
import type { DependencyMetadata } from '../types';

/**
 * This test validates that packages required by the CloudDeployer are properly
 * configured in GLOBAL_EXTERNALS to prevent circular dependency errors during bundling.
 *
 * GitHub Issue #11982: When deploying to Mastra Cloud, the bundler fails with
 * "HttpTransport cannot be exported from .mastra/.build/@mastra-loggers-http.mjs
 * as it is a reexport that references itself"
 *
 * The CloudDeployer injects imports for @mastra/loggers and @mastra/libsql in its
 * generated entry code. When externals: true is set, the bundler tries to analyze
 * these workspace packages, which causes circular dependency detection to fail.
 *
 * The fix is to add these packages to GLOBAL_EXTERNALS so they're completely skipped
 * during bundler analysis.
 */
describe('GLOBAL_EXTERNALS configuration for CloudDeployer', () => {
  // These are the imports from CloudDeployer.getEntry() in deployers/cloud/src/index.ts
  const cloudDeployerImports = [
    '@mastra/loggers', // PinoLogger
    '@mastra/loggers/http', // HttpTransport
    '@mastra/libsql', // LibSQLStore, LibSQLVector
  ];

  describe('packages required by CloudDeployer should be in GLOBAL_EXTERNALS', () => {
    it.each(cloudDeployerImports)('%s should be covered by GLOBAL_EXTERNALS', importPath => {
      const isExternal = GLOBAL_EXTERNALS.some(external => isDependencyPartOfPackage(importPath, external));

      expect(isExternal).toBe(true);
    });
  });

  describe('GLOBAL_EXTERNALS should include @mastra/loggers and @mastra/libsql', () => {
    it('should include @mastra/loggers', () => {
      expect(GLOBAL_EXTERNALS).toContain('@mastra/loggers');
    });

    it('should include @mastra/libsql', () => {
      expect(GLOBAL_EXTERNALS).toContain('@mastra/libsql');
    });
  });

  describe('subpath imports should be properly matched', () => {
    it('@mastra/loggers/http should match @mastra/loggers', () => {
      const isMatch = isDependencyPartOfPackage('@mastra/loggers/http', '@mastra/loggers');
      expect(isMatch).toBe(true);
    });

    it('@mastra/core/logger should match @mastra/core', () => {
      const isMatch = isDependencyPartOfPackage('@mastra/core/logger', '@mastra/core');
      expect(isMatch).toBe(true);
    });
  });
});

/**
 * These tests verify the actual filtering behavior that happens during bundling.
 * This simulates the logic in analyzeBundle() that determines which packages
 * get bundled vs treated as external.
 *
 * The key insight is that GLOBAL_EXTERNALS packages are filtered out BEFORE
 * any Rollup analysis happens, which means:
 * 1. They don't need to be installed in the user's project
 * 2. They don't trigger circular dependency detection
 * 3. They get added to the final package.json as dependencies to install
 */
describe('GLOBAL_EXTERNALS filtering behavior', () => {
  // This simulates the filtering logic from analyzeBundle() lines 344-350
  function filterDependencies(
    dependencies: Map<string, DependencyMetadata>,
    externalsPreset: boolean,
  ): { depsToOptimize: Map<string, DependencyMetadata>; usedExternals: Set<string> } {
    const allExternals = [...GLOBAL_EXTERNALS];
    const depsToOptimize = new Map<string, DependencyMetadata>();
    const usedExternals = new Set<string>();

    for (const [dep, metadata] of dependencies.entries()) {
      const isPartOfExternals = allExternals.some(external => isDependencyPartOfPackage(dep, external));
      if (isPartOfExternals || (externalsPreset && !metadata.isWorkspace)) {
        usedExternals.add(dep);
        continue;
      }
      depsToOptimize.set(dep, metadata);
    }

    return { depsToOptimize, usedExternals };
  }

  describe('when user HAS the packages installed (workspace packages)', () => {
    it('should exclude @mastra/loggers from bundling even if it is a workspace package', () => {
      const dependencies = new Map<string, DependencyMetadata>([
        [
          '@mastra/loggers',
          {
            exports: ['PinoLogger', 'default'],
            rootPath: '/workspace/packages/loggers',
            isWorkspace: true,
          },
        ],
        [
          '@mastra/loggers/http',
          {
            exports: ['HttpTransport'],
            rootPath: '/workspace/packages/loggers',
            isWorkspace: true,
          },
        ],
      ]);

      const { depsToOptimize, usedExternals } = filterDependencies(dependencies, true);

      // Should NOT be bundled (not in depsToOptimize)
      expect(depsToOptimize.has('@mastra/loggers')).toBe(false);
      expect(depsToOptimize.has('@mastra/loggers/http')).toBe(false);

      // Should be marked as external
      expect(usedExternals.has('@mastra/loggers')).toBe(true);
      expect(usedExternals.has('@mastra/loggers/http')).toBe(true);
    });

    it('should exclude @mastra/libsql from bundling even if it is a workspace package', () => {
      const dependencies = new Map<string, DependencyMetadata>([
        [
          '@mastra/libsql',
          {
            exports: ['LibSQLStore', 'LibSQLVector'],
            rootPath: '/workspace/stores/libsql',
            isWorkspace: true,
          },
        ],
      ]);

      const { depsToOptimize, usedExternals } = filterDependencies(dependencies, true);

      expect(depsToOptimize.has('@mastra/libsql')).toBe(false);
      expect(usedExternals.has('@mastra/libsql')).toBe(true);
    });
  });

  describe('when user does NOT have the packages installed', () => {
    it('should exclude @mastra/loggers from bundling when not installed', () => {
      // When not installed, the package would still be detected as a dependency
      // from the CloudDeployer's entry code, but with no rootPath
      const dependencies = new Map<string, DependencyMetadata>([
        [
          '@mastra/loggers',
          {
            exports: ['PinoLogger'],
            rootPath: null,
            isWorkspace: false,
          },
        ],
        [
          '@mastra/loggers/http',
          {
            exports: ['HttpTransport'],
            rootPath: null,
            isWorkspace: false,
          },
        ],
      ]);

      const { depsToOptimize, usedExternals } = filterDependencies(dependencies, true);

      // Should NOT be bundled - this is the key fix!
      // Without GLOBAL_EXTERNALS, these would be added to depsToOptimize
      // and cause circular dependency errors during Rollup analysis
      expect(depsToOptimize.has('@mastra/loggers')).toBe(false);
      expect(depsToOptimize.has('@mastra/loggers/http')).toBe(false);

      // Should be marked as external (will be installed later)
      expect(usedExternals.has('@mastra/loggers')).toBe(true);
      expect(usedExternals.has('@mastra/loggers/http')).toBe(true);
    });

    it('should exclude @mastra/libsql from bundling when not installed', () => {
      const dependencies = new Map<string, DependencyMetadata>([
        [
          '@mastra/libsql',
          {
            exports: ['LibSQLStore', 'LibSQLVector'],
            rootPath: null,
            isWorkspace: false,
          },
        ],
      ]);

      const { depsToOptimize, usedExternals } = filterDependencies(dependencies, true);

      expect(depsToOptimize.has('@mastra/libsql')).toBe(false);
      expect(usedExternals.has('@mastra/libsql')).toBe(true);
    });
  });

  describe('other packages should still be handled correctly', () => {
    it('should still bundle workspace packages not in GLOBAL_EXTERNALS', () => {
      const dependencies = new Map<string, DependencyMetadata>([
        [
          '@mastra/core',
          {
            exports: ['Mastra'],
            rootPath: '/workspace/packages/core',
            isWorkspace: true,
          },
        ],
      ]);

      const { depsToOptimize, usedExternals } = filterDependencies(dependencies, true);

      // @mastra/core is NOT in GLOBAL_EXTERNALS, so it should be bundled
      // (when externalsPreset is true, workspace packages are still bundled)
      expect(depsToOptimize.has('@mastra/core')).toBe(true);
      expect(usedExternals.has('@mastra/core')).toBe(false);
    });

    it('should externalize non-workspace packages when externalsPreset is true', () => {
      const dependencies = new Map<string, DependencyMetadata>([
        [
          'lodash',
          {
            exports: ['map', 'filter'],
            rootPath: '/node_modules/lodash',
            isWorkspace: false,
          },
        ],
      ]);

      const { depsToOptimize, usedExternals } = filterDependencies(dependencies, true);

      // Non-workspace packages are externalized when externalsPreset is true
      expect(depsToOptimize.has('lodash')).toBe(false);
      expect(usedExternals.has('lodash')).toBe(true);
    });

    it('should bundle non-workspace packages when externalsPreset is false', () => {
      const dependencies = new Map<string, DependencyMetadata>([
        [
          'lodash',
          {
            exports: ['map', 'filter'],
            rootPath: '/node_modules/lodash',
            isWorkspace: false,
          },
        ],
      ]);

      const { depsToOptimize, usedExternals } = filterDependencies(dependencies, false);

      // Non-workspace packages are bundled when externalsPreset is false
      expect(depsToOptimize.has('lodash')).toBe(true);
      expect(usedExternals.has('lodash')).toBe(false);
    });
  });

  describe('complete CloudDeployer scenario', () => {
    it('should handle all CloudDeployer imports correctly regardless of installation status', () => {
      // This simulates the exact scenario from CloudDeployer.getEntry()
      // Some packages might be installed, some might not
      const dependencies = new Map<string, DependencyMetadata>([
        // CloudDeployer imports - may or may not be installed
        ['@mastra/loggers', { exports: ['PinoLogger'], rootPath: null, isWorkspace: false }],
        ['@mastra/loggers/http', { exports: ['HttpTransport'], rootPath: null, isWorkspace: false }],
        ['@mastra/libsql', { exports: ['LibSQLStore', 'LibSQLVector'], rootPath: null, isWorkspace: false }],
        // User's mastra instance - typically a workspace package
        ['@mastra/core', { exports: ['Mastra'], rootPath: '/workspace/packages/core', isWorkspace: true }],
        ['@mastra/core/logger', { exports: ['MultiLogger'], rootPath: '/workspace/packages/core', isWorkspace: true }],
        // Other dependencies user might have
        ['openai', { exports: ['OpenAI'], rootPath: '/node_modules/openai', isWorkspace: false }],
      ]);

      const { depsToOptimize, usedExternals } = filterDependencies(dependencies, true);

      // CloudDeployer packages should be external (not bundled)
      expect(depsToOptimize.has('@mastra/loggers')).toBe(false);
      expect(depsToOptimize.has('@mastra/loggers/http')).toBe(false);
      expect(depsToOptimize.has('@mastra/libsql')).toBe(false);
      expect(usedExternals.has('@mastra/loggers')).toBe(true);
      expect(usedExternals.has('@mastra/loggers/http')).toBe(true);
      expect(usedExternals.has('@mastra/libsql')).toBe(true);

      // @mastra/core should be bundled (workspace package, not in GLOBAL_EXTERNALS)
      expect(depsToOptimize.has('@mastra/core')).toBe(true);
      expect(depsToOptimize.has('@mastra/core/logger')).toBe(true);

      // Other non-workspace deps should be external when externalsPreset is true
      expect(depsToOptimize.has('openai')).toBe(false);
      expect(usedExternals.has('openai')).toBe(true);
    });
  });
});
