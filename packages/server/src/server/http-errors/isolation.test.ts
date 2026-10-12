import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = fileURLToPath(new URL('.', import.meta.url));

const sourceFiles = readdirSync(dir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));

function importSpecifiers(src: string): string[] {
  const specs: string[] = [];
  const pattern = /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;
  for (const match of src.matchAll(pattern)) specs.push(match[1]!);
  return specs;
}

describe('http-errors module isolation', () => {
  it('has the expected source files', () => {
    expect(sourceFiles.sort()).toEqual(['build-problem.ts', 'codes.ts', 'index.ts', 'problem.ts']);
  });

  describe.each(sourceFiles)('given %s', file => {
    const specs = importSpecifiers(readFileSync(join(dir, file), 'utf8'));

    it('only imports zod/v4 or sibling files', () => {
      for (const spec of specs) {
        expect(spec === 'zod/v4' || spec.startsWith('./')).toBe(true);
      }
    });

    it('does not import @mastra/core or server internals', () => {
      for (const spec of specs) {
        expect(spec).not.toMatch(/@mastra\//);
        expect(spec).not.toMatch(/\.\.\//);
      }
    });
  });

  describe('given the package build configuration', () => {
    const pkgRoot = join(dir, '../../..');

    it('exposes the module as the @mastra/server/http-errors subpath', () => {
      const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'));
      expect(pkg.exports['./http-errors']).toEqual({
        import: { types: './dist/server/http-errors/index.d.ts', default: './dist/server/http-errors/index.js' },
        require: { types: './dist/server/http-errors/index.d.ts', default: './dist/server/http-errors/index.cjs' },
      });
    });

    const distEntry = join(pkgRoot, 'dist/server/http-errors/index.js');

    it.runIf(existsSync(distEntry))('ships a bundle whose only external dependency is zod/v4', () => {
      const seen = new Set<string>();
      const externals = new Set<string>();
      const visit = (file: string) => {
        if (seen.has(file)) return;
        seen.add(file);
        for (const spec of importSpecifiers(readFileSync(file, 'utf8'))) {
          if (spec.startsWith('.')) visit(join(dirname(file), spec));
          else externals.add(spec);
        }
      };
      visit(distEntry);
      expect([...externals]).toEqual(['zod/v4']);
    });

    it('builds the module as its own entry point', () => {
      const config = readFileSync(join(pkgRoot, 'tsdown.config.ts'), 'utf8');
      expect(config).toContain("'src/server/http-errors/index.ts'");
      expect(config).toContain("'!src/server/http-errors/*.test.ts'");
    });
  });

  it('exposes only schema, type, builder and error codes from the barrel', async () => {
    const mod = await import('./index');
    expect(Object.keys(mod).sort()).toEqual(
      ['MASTRA_ERROR_CODES', 'buildProblem', 'isMastraErrorCode', 'problemDetailsSchema'].sort(),
    );
  });
});
