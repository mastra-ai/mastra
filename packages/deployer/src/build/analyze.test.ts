import { describe, it, expect } from 'vitest';
import { getPackageName, isBuiltinModule } from './utils';

/**
 * Mirrors the filtering logic from analyzeBundle (analyze.ts lines 434-462).
 */
function filterImportsForExternalDeps(imports: string[], workspacePackageNames: Set<string>): Map<string, {}> {
  const allUsedExternals = new Map<string, {}>();

  for (const i of imports) {
    if (isBuiltinModule(i)) {
      continue;
    }

    if (i.startsWith('.') || i.startsWith('/')) {
      continue;
    }

    const pkgName = getPackageName(i);

    // Do not include workspace packages
    if (pkgName && workspacePackageNames.has(pkgName)) {
      continue;
    }

    if (pkgName && !allUsedExternals.has(pkgName)) {
      allUsedExternals.set(pkgName, {});
    }
  }

  return allUsedExternals;
}

describe('workspace package filtering in analyzeBundle (issue #13022)', () => {
  describe('filters workspace packages by npm name', () => {
    it('should filter scoped workspace packages at nested filesystem paths', () => {
      const workspacePackageNames = new Set(['@agents/devstudio']);

      const imports = ['@agents/devstudio', 'zod', 'pino'];
      const result = filterImportsForExternalDeps(imports, workspacePackageNames);

      expect(result.has('@agents/devstudio')).toBe(false);
      expect(result.has('zod')).toBe(true);
      expect(result.has('pino')).toBe(true);
      expect(result.size).toBe(2);
    });

    it('should filter workspace packages imported by subpath', () => {
      const workspacePackageNames = new Set(['@internal/shared']);

      const imports = ['@internal/shared/utils', 'zod'];
      const result = filterImportsForExternalDeps(imports, workspacePackageNames);

      expect(result.has('@internal/shared')).toBe(false);
      expect(result.has('zod')).toBe(true);
      expect(result.size).toBe(1);
    });

    it('should filter unscoped workspace packages', () => {
      const workspacePackageNames = new Set(['my-shared-lib']);

      const imports = ['my-shared-lib', 'my-shared-lib/utils', 'express'];
      const result = filterImportsForExternalDeps(imports, workspacePackageNames);

      expect(result.has('my-shared-lib')).toBe(false);
      expect(result.has('express')).toBe(true);
      expect(result.size).toBe(1);
    });

    it('should handle multiple workspace packages', () => {
      const workspacePackageNames = new Set(['@agents/devstudio', '@internal/shared', 'utils-lib']);

      const imports = ['@agents/devstudio', '@internal/shared/helpers', 'utils-lib', 'zod', 'pino'];
      const result = filterImportsForExternalDeps(imports, workspacePackageNames);

      expect(result.has('@agents/devstudio')).toBe(false);
      expect(result.has('@internal/shared')).toBe(false);
      expect(result.has('utils-lib')).toBe(false);
      expect(result.has('zod')).toBe(true);
      expect(result.has('pino')).toBe(true);
      expect(result.size).toBe(2);
    });
  });

  describe('does not produce spurious directory-name dependencies', () => {
    it('should not add "apps" as a dependency from workspace-relative path imports', () => {
      const workspacePackageNames = new Set(['@agents/devstudio']);

      const imports = ['apps/@agents/devstudio/utils', 'zod'];
      const result = filterImportsForExternalDeps(imports, workspacePackageNames);

      expect(result.has('zod')).toBe(true);
    });

    it('should not confuse directory names with npm package names', () => {
      const workspacePackageNames = new Set(['@scope/my-pkg']);

      const imports = ['@scope/my-pkg', '@scope/my-pkg/sub', 'express'];
      const result = filterImportsForExternalDeps(imports, workspacePackageNames);

      expect(result.has('@scope/my-pkg')).toBe(false);
      expect(result.has('express')).toBe(true);
      expect(result.size).toBe(1);
    });
  });

  describe('preserves correct external dependency handling', () => {
    it('should skip builtin modules', () => {
      const workspacePackageNames = new Set<string>();

      const imports = ['fs', 'path', 'node:crypto', 'zod'];
      const result = filterImportsForExternalDeps(imports, workspacePackageNames);

      expect(result.has('fs')).toBe(false);
      expect(result.has('path')).toBe(false);
      expect(result.has('node:crypto')).toBe(false);
      expect(result.has('zod')).toBe(true);
      expect(result.size).toBe(1);
    });

    it('should skip relative and absolute imports', () => {
      const workspacePackageNames = new Set<string>();

      const imports = ['./chunk-abc.mjs', '../shared/chunk.mjs', '/absolute/path.mjs', 'zod'];
      const result = filterImportsForExternalDeps(imports, workspacePackageNames);

      expect(result.has('zod')).toBe(true);
      expect(result.size).toBe(1);
    });

    it('should handle empty workspace map', () => {
      const workspacePackageNames = new Set<string>();

      const imports = ['zod', 'pino', '@mastra/core'];
      const result = filterImportsForExternalDeps(imports, workspacePackageNames);

      expect(result.has('zod')).toBe(true);
      expect(result.has('pino')).toBe(true);
      expect(result.has('@mastra/core')).toBe(true);
      expect(result.size).toBe(3);
    });

    it('should deduplicate subpath imports to root package name', () => {
      const workspacePackageNames = new Set<string>();

      const imports = ['@mastra/core/agent', '@mastra/core/mastra', '@mastra/core/logger'];
      const result = filterImportsForExternalDeps(imports, workspacePackageNames);

      expect(result.has('@mastra/core')).toBe(true);
      expect(result.size).toBe(1);
    });
  });
});
