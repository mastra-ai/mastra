import { describe, it, expect } from 'vitest';
import { getPackageName, isBuiltinModule, slash } from './utils';

describe('external import filtering (issue #13022)', () => {
  /**
   * Mirrors the filtering logic from analyzeBundle's rollup output loop.
   */
  function filterImports(imports: string[], workspacePaths: string[]): Map<string, {}> {
    const result = new Map<string, {}>();
    const normalizedPaths = workspacePaths.map(p => slash(p));

    for (const i of imports) {
      if (isBuiltinModule(i)) {
        continue;
      }

      if (i.startsWith('.') || i.startsWith('/')) {
        continue;
      }

      if (normalizedPaths.some(wp => i.startsWith(wp))) {
        continue;
      }

      const pkgName = getPackageName(i);
      if (pkgName && !result.has(pkgName)) {
        result.set(pkgName, {});
      }
    }

    return result;
  }

  it('should filter workspace paths with backslashes (Windows)', () => {
    const result = filterImports(
      ['apps/@agents/devstudio/.mastra/.build/chunk-ILQXPZCD.mjs', 'zod'],
      ['apps\\@agents\\devstudio'],
    );

    expect(result.has('apps')).toBe(false);
    expect(result.has('zod')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('should filter workspace paths with forward slashes (Linux/macOS)', () => {
    const result = filterImports(
      ['apps/@agents/devstudio/.mastra/.build/chunk-ILQXPZCD.mjs', 'zod'],
      ['apps/@agents/devstudio'],
    );

    expect(result.has('apps')).toBe(false);
    expect(result.has('zod')).toBe(true);
    expect(result.size).toBe(1);
  });
});
