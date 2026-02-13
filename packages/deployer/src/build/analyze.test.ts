import { describe, it, expect } from 'vitest';
import { getPackageName, isBuiltinModule } from './utils';

describe('external import filtering (issue #13022)', () => {
  /**
   * Mirrors the filtering logic from analyzeBundle's rollup output loop.
   */
  function filterImports(imports: string[], workspacePaths: string[]): Map<string, {}> {
    const result = new Map<string, {}>();

    for (const i of imports) {
      if (isBuiltinModule(i)) {
        continue;
      }

      if (i.startsWith('.') || i.startsWith('/')) {
        continue;
      }

      if (/\.(m?[jt]sx?|cjs)$/.test(i)) {
        continue;
      }

      if (workspacePaths.some(wp => i.startsWith(wp))) {
        continue;
      }

      const pkgName = getPackageName(i);
      if (pkgName && !result.has(pkgName)) {
        result.set(pkgName, {});
      }
    }

    return result;
  }

  it('should skip rollup inter-chunk file references', () => {
    const result = filterImports(['apps/@agents/devstudio/.mastra/.build/chunk-ILQXPZCD.mjs', 'zod'], []);

    expect(result.has('apps')).toBe(false);
    expect(result.has('zod')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('should skip builtin and relative imports', () => {
    const result = filterImports(['fs', 'node:crypto', './chunk.mjs', '../shared.mjs', 'zod'], []);

    expect(result.has('zod')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('should keep real npm package imports', () => {
    const result = filterImports(['zod', 'pino', '@mastra/core'], []);

    expect(result.has('zod')).toBe(true);
    expect(result.has('pino')).toBe(true);
    expect(result.has('@mastra/core')).toBe(true);
    expect(result.size).toBe(3);
  });
});
