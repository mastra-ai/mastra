import { describe, it, expect } from 'vitest';
import { collectExternalImports } from './analyze';
import type { ExternalDependencyInfo } from './types';

describe('collectExternalImports (issue #13022)', () => {
  function collect(imports: string[], workspacePaths: string[]) {
    const result = new Map<string, ExternalDependencyInfo>();
    collectExternalImports(imports, workspacePaths, result);
    return result;
  }

  it('should skip rollup inter-chunk file references', () => {
    const result = collect(['apps/@agents/devstudio/.mastra/.build/chunk-ILQXPZCD.mjs', 'zod'], []);

    expect(result.has('apps')).toBe(false);
    expect(result.has('zod')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('should skip builtin and relative imports', () => {
    const result = collect(['fs', 'node:crypto', './chunk.mjs', '../shared.mjs', 'zod'], []);

    expect(result.has('zod')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('should keep real npm package imports', () => {
    const result = collect(['zod', 'pino', '@mastra/core'], []);

    expect(result.has('zod')).toBe(true);
    expect(result.has('pino')).toBe(true);
    expect(result.has('@mastra/core')).toBe(true);
    expect(result.size).toBe(3);
  });
});
